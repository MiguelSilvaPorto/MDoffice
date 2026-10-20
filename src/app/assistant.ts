// Assistente de escrita no Markdown: correção automática, avisos e revisão.

import type { App } from "./app";
import { checkText, checkStyle, marcarAplicacao, planejarVarredura, stats as writingStats, spellIsReady, spellHasFailed, type WritingIssue } from "../broker/writing";
import { openReviewModal } from "../broker/review";
import { diag, janelaDe } from "../broker/diag";
import { corrigirFormal, type ResultadoFormal } from "../broker/formal";
import { usaAcentos } from "../broker/regime";
import { limparAplicadasAuto, marcarAplicadasAuto, registrarCorrecao } from "../broker/aprendizado";
import { contarVarredura } from "../broker/personal/metricas";
import { esquecerTermo, marcarPromovidoManual } from "../broker/personal/termos";
import { importarAprendizado } from "../broker/personal/aprendizadoArquivo";
import { registrarAplicacaoAuto, registrarMantidaSePendente } from "../broker/spell/decisao";
import { enviarLimiar } from "../broker/spell";
import { $, toast, saveJSON } from "../util";

/** Chave estável de um aviso de estilo (mensagem + trecho), para o "Ignorar neste texto". */
const styleKey = (i: WritingIssue): string => `${i.message}\u0000${i.word.trim().toLowerCase()}`;

export const assistantMethods = {
  /**
   * Varredura da pausa: passado o tempo do ritmo aprendido, aplica sozinha as correções seguras
   * do documento inteiro — vírgulas, limpeza (pontos/vírgulas duplicados, frases coladas) e o
   * ponto final dos parágrafos concluídos. No parágrafo em que a pessoa está, o ponto só entra
   * quando o cursor está no fim dele; a palavra sob o cursor nunca é tocada. Tudo numa transação
   * (um Ctrl+Z desfaz a varredura inteira).
   */
  runIdleFix(this: App): void {
    if (!this.autoFix || !this.autoFixArmed) return;
    const texto = this.editor.getText();
    // Regime sem acento (informal deliberado): a varredura automática não mexe. O que
    // ela faria — acentuar, pôr vírgula, fechar parágrafo — é justamente o que quem
    // escreveu assim não quer. Fica a sugestão; a correção formal é ação explícita.
    if (!usaAcentos(texto)) {
      diag({ gatilho: "pausa", regra: "varredura de pausa", veredito: "ignorado", motivo: "documento sem acento por escolha: correção automática quieta" });
      return;
    }
    const pos = this.editor.view.state.selection.main.head;
    const par = this.paragrafoDoCursor(pos);
    // O parágrafo do cursor NUNCA recebe o ponto final na pausa: "cursor no fim" é o estado
    // normal de quem está escrevendo. O ponto entra quando a pessoa muda de parágrafo (aí ele
    // já é o parágrafo de cima) ou numa ação explícita (salvar/formatar).
    const correcoes = planejarVarredura(texto, { pos, from: 0, to: texto.length, parFrom: par.from, parTo: par.to, parConcluido: false });
    if (!correcoes.length) return;
    // esta varredura não troca palavras: o que estava pendente de outra ficou de pé
    limparAplicadasAuto();
    registrarMantidaSePendente();
    enviarLimiar();
    this.editor.replaceRanges(correcoes, -1);
    marcarAplicacao(texto);
  },

  /** Parágrafo em que o cursor está: limites e se ele está concluído (cursor no fim do texto dele). */
  paragrafoDoCursor(this: App, pos: number): { from: number; to: number; concluido: boolean } {
    const doc = this.editor.view.state.doc;
    const line = doc.lineAt(pos);
    let first = line.number;
    while (first > 1 && doc.line(first - 1).text.trim() !== "") first--;
    let last = line.number;
    while (last < doc.lines && doc.line(last + 1).text.trim() !== "") last++;
    const fim = doc.line(last);
    const ultimoTexto = fim.text.replace(/\s+$/, "").length;
    return { from: doc.line(first).from, to: fim.to, concluido: pos >= fim.from + ultimoTexto };
  },

  /** Correção automática: não depende do dicionário, roda logo depois de você pausar. */
  runAutoFix(this: App): void {
    if (!this.autoFix || !this.autoFixArmed) return;
    // Mesmo regime da varredura: sem acento por escolha, nada entra sozinho.
    if (!usaAcentos(this.editor.getText())) return;
    let typed = 0;
    let ended = 0;
    // repete algumas vezes porque uma correção pode abrir caminho para outra
    // (ex.: maiúscula no começo e depois “a gente vai” → “Nós vamos”)
    for (let i = 0; i < 3; i++) {
      const t = this.autoFixSafe();
      const e = this.autoFixFinishedParagraph();
      typed += t;
      ended += e;
      if (!t && !e) break;
    }
    if (typed + ended > 0) {
      diag({ gatilho: "pausa", regra: "varredura da pausa", veredito: "aplicado", motivo: `${typed} palavra(s) e ${ended} ajuste(s) de estilo` });
      void this.runWritingCheck();
    }
    if (ended) toast(`Correção automática: ${ended} ajuste${ended === 1 ? "" : "s"}.`, "ok", 2400);
  },

  async runWritingCheck(this: App): Promise<void> {
    if (this.tab.kind === "word") {
      this.wordHost.recheckSpelling();
      return;
    }
    const text = this.editor.getText();
    try {
      const achados = await checkText(text, new Set([...this.ignoreWords, ...this.ignoredHere]));
      // "Ignorar neste texto" só vale para avisos de estilo; ortografia continua no dicionário/ignoradas.
      this.issues = achados.filter((i) => i.kind !== "style" || !this.tab.ignoredStyle.has(styleKey(i)));
      // O ponto final do ÚLTIMO parágrafo não é aviso enquanto ele está sendo escrito: o
      // cursor "no fim" é o estado normal de quem digita, e o aviso só faz sentido quando
      // o parágrafo já ficou para trás (ou no salvamento).
      const doc = this.editor.view.state.doc;
      const pos = this.editor.view.state.selection.main.head;
      const par = this.paragrafoDoCursor(pos);
      if (doc.sliceString(par.to, doc.length).trim() === "") {
        this.issues = this.issues.filter((i) => !(i.classe === "ponto-final" && i.from >= par.from && i.to <= par.to));
      }
    } catch {
      this.issues = [];
    }
    this.editor.setIssues(this.issues);
    this.updateWritingBadge();
    // F4: métricas do corretor (precisão percebida e avisos por 1.000 palavras, em Configurações)
    contarVarredura(writingStats(text).words, this.issues.filter((i) => i.kind === "spell").length);
    this.reviewHandle?.refresh(this.issues, writingStats(text));
    // com o resultado da ortografia em mãos, a correção automática ganha o que fazer
    if (this.autoFix && this.autoFixArmed) this.autoFixSoon();
  },

  /**
   * "Formatar texto": arruma o documento inteiro de uma vez.
   *
   * Roda a verificação na hora (não usa o resultado da última), então pega o que
   * apareceu desde então. Aplica só o que é DETERMINÍSTICO — espaçamento,
   * maiúsculas, pontuação obrigatória, abreviações, concordância e ortografia.
   * Fica de fora o que precisa de leitura humana: quebrar frase comprida e
   * trocar palavra por sinônimo, que são propostas, não correções.
   *
   * Tudo vai numa transação só: Ctrl+Z desfaz de uma vez.
   */
  async formatarTexto(this: App): Promise<void> {
    // Só o editor Markdown tem as ferramentas de formatação; Word e PowerPoint
    // têm as próprias. Atenção: nas abas Markdown comuns `kind` é indefinido,
    // então a checagem é por EXCLUSÃO, não por igualdade.
    const tipo = this.tab.kind;
    if (tipo === "word" || tipo === "ppt" || tipo === "settings") {
      toast("A formatação do texto está disponível no editor Markdown.", "info", 3400);
      return;
    }
    const texto = this.editor.getText();
    if (!texto.trim()) {
      toast("Não há texto para formatar.", "info", 2600);
      return;
    }
    const ignore = new Set([...this.ignoreWords, ...this.ignoredHere]);
    let resultado: ResultadoFormal;
    try {
      // Correção formal: forma (acento, pontuação, espaço, maiúscula), nunca vocabulário.
      // `curtas` inclui as palavras de duas letras na restauração de acento ("ja" → "já").
      resultado = await corrigirFormal(texto, (t) => checkText(t, ignore, { curtas: true }), 4);
    } catch {
      toast("Não foi possível verificar o texto agora.", "err", 3200);
      return;
    }
    if (resultado.texto === texto) {
      toast("O texto já está formatado.", "ok", 2600);
      return;
    }
    this.editor.replaceRanges([{ from: 0, to: texto.length, insert: resultado.texto }]);
    this.updateWritingBadge();
    diag({ gatilho: "formatar", regra: "correção formal", veredito: "aplicado", motivo: `${resultado.mudancas} ajuste(s) em ${resultado.rodadas} rodada(s)` });
    toast(`${resultado.mudancas} ajuste(s) de formatação aplicado(s). Ctrl+Z desfaz.`, "ok", 4200);
    this.checkWritingSoon();
  },

  /** Liga/desliga a correção automática (guardada entre sessões). */
  setAutoFix(this: App, on: boolean): void {
    this.autoFix = on;
    saveJSON("mdc.autofix", on);
    toast(
      on
        ? "Correção automática ligada: ponto, vírgulas, maiúsculas e ortografia segura entram sozinhos. Gíria e registro ficam como sugestão."
        : "Correção automática desligada.",
      "info",
      3400
    );
  },

  /** Liga/desliga sugestões inline estilo Copilot (guardadas entre sessões). */
  setCopilot(this: App, on: boolean): void {
    this.copilot = on;
    saveJSON("mdc.copilot", on);
    this.editor.setGhostTextEnabled(on);
    toast(
      on
        ? "Sugestões inline ligadas (estilo Copilot): use Tab para aceitar ou Alt+Seta para palavra por palavra."
        : "Sugestões inline desativadas.",
      "ok",
      2800
    );
  },

  /** Substituição de um aviso: estilo usa `fix`; ortografia usa `auto` (correção confiável). */
  replacementFor(this: App, issue: WritingIssue): string | undefined {
    return issue.kind === "spell" ? issue.auto : issue.fix;
  },

  /**
   * Correções automáticas ao salvar (Ctrl+S): mesma política da varredura — o parágrafo em que
   * o cursor está só é fechado com ponto quando ele está concluído, nada que toque a palavra sob
   * o cursor é trocado e a ortografia só corrige palavras que ficaram para trás.
   */
  applySaveFixes(this: App): number {
    const pos = this.editor.view.state.selection.main.head;
    const texto = this.editor.getText();
    // Salvar também respeita o regime: texto sem acento por escolha não é "corrigido" ao salvar.
    if (!usaAcentos(texto)) return 0;
    const par = this.paragrafoDoCursor(pos);
    const correcoes = planejarVarredura(texto, { pos, from: 0, to: texto.length, parFrom: par.from, parTo: par.to, parConcluido: par.concluido });
    if (correcoes.length) this.editor.replaceRanges(correcoes, -1);
    return correcoes.length + this.autoFixWords(0, texto.length, true, true);
  },

  /**
   * Aplica as correções disponíveis numa só ação (um único desfazer).
   * `automatico` diz que quem mandou foi a correção automática: além de aprender as
   * trocas, elas ficam anotadas para o Ctrl+Z seguinte valer como recusa.
   */
  applyFixes(this: App, issues: WritingIssue[], automatico = false): number {
    const aplicaveis = issues.filter((i) => this.replacementFor(i) !== undefined);
    if (!aplicaveis.length) return 0;
    this.editor.replaceRanges(
      aplicaveis.map((i) => ({ from: i.from, to: i.to, insert: this.replacementFor(i)! }))
    );
    // Aprende com o que foi aceito: a próxima vez que a mesma troca aparecer,
    // o corretor já a conhece (e, repetida o bastante, aplica sozinho). Cada decisão
    // também conta para a CLASSE de erro (transposição, tecla vizinha, acento…).
    const pares: [string, string][] = [];
    for (const i of aplicaveis) {
      const certo = this.replacementFor(i)!;
      registrarCorrecao(i.word, certo);
      if (automatico) pares.push([i.word, certo]);
    }
    if (automatico && pares.length) {
      // a leva anterior ficou de pé (uma nova varredura só chega depois de o texto continuar
      // corrigido): fecha o veredito dela como MANTIDA antes de abrir o da nova
      registrarMantidaSePendente();
      registrarAplicacaoAuto();
      marcarAplicadasAuto(pares);
      enviarLimiar();
    }
    return aplicaveis.length;
  },

  /** Primeira coluna do parágrafo que contém a posição. */
  paragraphStartAt(this: App, pos: number): number {
    const doc = this.editor.view.state.doc;
    let line = doc.lineAt(pos);
    while (line.number > 1 && doc.line(line.number - 1).text.trim() !== "") line = doc.line(line.number - 1);
    return line.from;
  },

  /**
   * Corrige sozinho as palavras erradas em que dá para confiar ("responsavo" → "responsável").
   * Nunca mexe na palavra em que o cursor está (ela pode estar pela metade) e confere se o
   * texto naquele ponto continua igual antes de trocar. O Ctrl+Z seguinte vale como recusa
   * (o ritmo espera mais e o par aprendido é descontado).
   */
  autoFixWords(this: App, from: number, to: number, soDepoisDoCursor = true, permitirPontuacao = false): number {
    const view = this.editor.view;
    const doc = view.state.doc;
    const pos = view.state.selection.main.head;
    const texto = doc.toString();
    // A correção automática de palavra troca PALAVRA: ponto/vírgula que vierem junto
    // (o aviso fundido com "falta o ponto final") só entram no fim do parágrafo ou numa
    // ação explícita — nunca no meio da frase que está sendo escrita.
    const temPontuacao = (s: string) => /[^\p{L}\p{N}'-]/u.test(s);
    const candidatos = this.issues.filter((i) => i.kind === "spell" && i.from >= from && i.to <= to);
    const alvos = candidatos.filter(
      (i) =>
        i.auto &&
        (!soDepoisDoCursor || pos > i.to) &&
        doc.sliceString(i.from, i.to) === i.word &&
        (permitirPontuacao || !temPontuacao(i.auto))
    );
    // Log de decisões: por que CADA candidato foi aplicado ou ficou de fora. É o que explica a
    // "correção lixo" (palavra pela metade, texto que mudou, falta de confiança).
    for (const i of candidatos) {
      const base = {
        gatilho: "pausa" as const,
        tipo: i.kind,
        regra: i.message,
        from: i.from,
        to: i.to,
        palavra: i.word,
        auto: i.auto,
        sugestao: i.suggestions[0],
        janela: janelaDe(texto, i.from, i.to),
      };
      if (!i.auto) diag({ ...base, veredito: "ignorado", motivo: "sem confiança para aplicar sozinho (fica como sugestão)" });
      else if (soDepoisDoCursor && pos <= i.to) diag({ ...base, veredito: "ignorado", motivo: "é (ou encosta n)a palavra sob o cursor — pode estar pela metade" });
      else if (doc.sliceString(i.from, i.to) !== i.word) diag({ ...base, veredito: "ignorado", motivo: "o texto naquele ponto mudou desde a verificação" });
      else if (!permitirPontuacao && temPontuacao(i.auto)) diag({ ...base, veredito: "ignorado", motivo: "a correção automática não acrescenta pontuação (o ponto entra quando o parágrafo termina)" });
      else diag({ ...base, veredito: "aplicado", motivo: `vira “${i.auto}”` });
    }
    if (!alvos.length) return 0;
    const antes = this.editor.getText();
    const quantos = this.applyFixes(alvos, true);
    // com o veredito aberto, o Ctrl+Z que desfizer estas trocas também ensina
    if (quantos) marcarAplicacao(antes);
    return quantos;
  },

  /** Enquanto se digita: aplica só o que é seguro (maiúsculas, espaços, abreviações) + palavras. */
  autoFixSafe(this: App): number {
    const view = this.editor.view;
    const doc = view.state.doc;
    const pos = view.state.selection.main.head;
    const line = doc.lineAt(pos);
    // recalcula na hora: as posições antigas podem ter mudado
    const fresh = checkStyle(doc.toString()).filter((i) => i.safe && i.from >= line.from && i.to <= line.to);
    const parFrom = this.paragraphStartAt(pos);
    // log de decisões: o que a regra segura aplicou na linha do cursor (e por quê)
    for (const i of fresh) {
      diag({
        gatilho: "pausa",
        tipo: i.kind,
        regra: i.message,
        from: i.from,
        to: i.to,
        palavra: i.word,
        safe: i.safe,
        fix: i.fix,
        sugestao: i.suggestions[0],
        veredito: "aplicado",
        motivo: `regra segura vira “${i.fix ?? i.suggestions[0] ?? ""}” na linha do cursor`,
        janela: janelaDe(doc.toString(), i.from, i.to),
      });
    }
    return this.applyFixes(fresh) + this.autoFixWords(parFrom, pos);
  },

  /**
   * Correção automática de parágrafo: quando o cursor está numa linha vazia e existe uma
   * linha em branco antes (parágrafo concluído), corrige o parágrafo que ficou para trás.
   */
  autoFixFinishedParagraph(this: App): number {
    const view = this.editor.view;
    const doc = view.state.doc;
    const line = doc.lineAt(view.state.selection.main.head);
    const texto = line.text.trim();
    // Linha vazia (parágrafo terminado) OU já começando um bloco novo (imagem, título,
    // lista, tabela, citação, cerca de código): nos dois casos o parágrafo de cima acabou.
    const vazia = texto === "";
    const bloco = /^(#|!\[|\||```|>|[-*+]\s|\d+\.\s)/.test(texto);
    if (!vazia && !bloco) return 0;
    // Linha vazia: só vale se a de cima também está vazia (a pessoa apertou Enter duas vezes). Com uma linha só ainda
    // é o mesmo parágrafo. Em qualquer caso, o parágrafo que acabou é o último texto acima.
    let ultimaAcima = line.number - 1;
    if (vazia && (ultimaAcima < 1 || doc.line(ultimaAcima).text.trim() !== "")) return 0;
    while (ultimaAcima >= 1 && doc.line(ultimaAcima).text.trim() === "") ultimaAcima--;
    if (ultimaAcima < 1) return 0;
    let first = ultimaAcima;
    while (first > 1 && doc.line(first - 1).text.trim() !== "") first--;
    const from = doc.line(first).from;
    const to = doc.line(ultimaAcima).to;
    const todoTexto = doc.toString();
    const correcoes = planejarVarredura(todoTexto, { pos: view.state.selection.main.head, from, to, parFrom: from, parTo: to, parConcluido: true });
    if (correcoes.length) {
      // a varredura de estilo não troca palavras: o pendente anterior ficou de pé
      limparAplicadasAuto();
      this.editor.replaceRanges(correcoes, -1);
      marcarAplicacao(todoTexto);
      diag({ gatilho: "paragrafo", regra: "varredura do parágrafo concluído", veredito: "aplicado", motivo: `${correcoes.length} ajuste(s) de estilo` });
    }
    return correcoes.length + this.autoFixWords(from, to, true, true);
  },

  updateWritingBadge(this: App): void {
    const btn = document.querySelector<HTMLButtonElement>("#st-writing");
    if (!btn) return;
    const count = this.issues.length;
    const loading = !spellIsReady() && !spellHasFailed();
    if (!count && !loading) {
      btn.hidden = true;
      return;
    }
    const spell = this.issues.filter((i) => i.kind === "spell").length;
    const parts = [count ? `${count} aviso${count === 1 ? "" : "s"}` : "nenhum aviso"];
    if (spell) parts.push(`${spell} de escrita`);
    btn.hidden = false;
    btn.textContent = `Revisar: ${parts.join(" · ")}${loading ? " · carregando dicionário…" : ""}`;
  },

  ignoreWord(this: App, word: string): void {
    this.ignoreWords.add(word.toLowerCase());
    saveJSON("mdc.ignore-words", Array.from(this.ignoreWords));
    // F4: entrou no dicionário à mão — sai da lista de "termos que o app insiste em marcar"
    marcarPromovidoManual(word);
    toast(`“${word}” foi adicionada ao dicionário pessoal.`, "ok", 3000);
    void this.runWritingCheck();
    this.wordHost?.recheckSpelling();
  },

  /**
   * F4: o corretor aprendeu sozinho o termo (3 sinais de "não é erro") — ele entra no dicionário
   * pessoal e para de ser marcado. O aviso diz o que aconteceu, porque o app mudou sozinho.
   */
  adotarTermo(this: App, palavra: string): void {
    const p = palavra.trim();
    if (!p) return;
    this.ignoreWords.add(p.toLowerCase());
    saveJSON("mdc.ignore-words", Array.from(this.ignoreWords));
    toast(`O corretor aprendeu: “${p}” entrou no seu dicionário e não será mais marcada.`, "ok", 6500);
    void this.runWritingCheck();
    this.wordHost?.recheckSpelling();
  },

  /** Configurações: promove um termo candidato na hora (mesmo caminho de "Adicionar ao dicionário"). */
  promoverTermo(this: App, palavra: string): void {
    this.ignoreWord(palavra);
  },

  /** Configurações: esquece um termo aprendido (sai da lista e volta a ser verificado). */
  esquecerTermoAprendido(this: App, palavra: string): void {
    esquecerTermo(palavra);
    const k = palavra.trim().toLowerCase();
    if (this.ignoreWords.delete(k)) saveJSON("mdc.ignore-words", Array.from(this.ignoreWords));
    toast(`“${palavra}” foi esquecida e volta a ser verificada.`, "info", 3200);
    void this.runWritingCheck();
    this.wordHost?.recheckSpelling();
  },

  /** Configurações: importa um arquivo de aprendizado (substitui o atual) e recarrega o dicionário. */
  importarAprendizadoTexto(this: App, texto: string): { ok: boolean; resumo?: string; erro?: string } {
    const r = importarAprendizado(texto);
    if (r.ok && r.dicionario) {
      this.ignoreWords = new Set(r.dicionario.map((p) => p.toLowerCase()));
      saveJSON("mdc.ignore-words", Array.from(this.ignoreWords));
      void this.runWritingCheck();
      this.wordHost?.recheckSpelling();
    }
    return { ok: r.ok, resumo: r.resumo, erro: r.erro };
  },

  /** "Ignorar neste texto": dispensa um aviso de ESTILO neste documento (dicionário não se aplica). */
  ignoreStyleIssue(this: App, issue: WritingIssue): void {
    this.tab.ignoredStyle.add(styleKey(issue));
    toast("Aviso dispensado neste texto (nos outros documentos ele continua aparecendo).", "info", 3600);
    void this.runWritingCheck();
  },

  openReview(this: App): void {
    if (this.semDocumento()) return;
    if (this.tab.kind === "word") {
      toast("Em documentos (.docx), clique nas palavras sublinhadas para ver as sugestões.", "info", 3600);
      return;
    }
    if (this.reviewHandle) return;
    this.reviewHandle = openReviewModal({
      issues: this.issues,
      stats: writingStats(this.editor.getText()),
      onGoTo: (issue) => {
        this.editor.gotoRange(issue.from, issue.to);
        this.reviewHandle?.close();
      },
      onFix: (issue) => {
        const replacement = issue.fix ?? issue.suggestions[0];
        if (!replacement) return;
        this.editor.replaceRange(issue.from, issue.to, replacement);
        this.checkWritingSoon();
      },
      onFixAllStyle: () => {
        const count = this.applyFixes(this.issues);
        if (!count) {
          toast("Nenhuma correção automática de estilo disponível.", "info", 2600);
          return;
        }
        toast(`${count} correção(ões) de estilo aplicada(s).`, "ok", 3200);
        this.checkWritingSoon();
      },
      onIgnore: (word) => this.ignoreWord(word),
      onFormalizar: () => {
        this.reviewHandle?.close();
        this.openFormalizar();
      },
      onRecheck: () => void this.runWritingCheck(),
      onClose: () => {
        this.reviewHandle = null;
      },
    });
  },
};
