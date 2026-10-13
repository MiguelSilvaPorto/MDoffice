// Assistente de escrita no Markdown: correção automática, avisos e revisão.

import type { App } from "./app";
import { checkText, checkStyle, stats as writingStats, spellIsReady, spellHasFailed, type WritingIssue } from "../broker/writing";
import { openReviewModal } from "../broker/review";
import { registrarCorrecao } from "../broker/aprendizado";
import { $, toast, saveJSON } from "../util";

/**
 * A correção automática (sem a pessoa pedir) não mexe em pontuação de frase: não fecha frase com ponto nem quebra frase
 * comprida. Quem está pensando no meio da frase não pode ter o texto fechado por baixo da mão. Esses avisos continuam
 * aparecendo e entram quando a pessoa aceita ("Corrigir tudo", clique no aviso) ou ao concluir o parágrafo (ponto final).
 */
function autoNaoMexe(i: WritingIssue, text: string): boolean {
  if (/nova frase/i.test(i.message)) return true;
  const fix = i.fix ?? "";
  // qualquer correção que acrescente um ponto final / ponto de frase
  return /^\.\s/.test(fix) || (fix.endsWith(".") && !text.slice(i.from, i.to).endsWith("."));
}

export const assistantMethods = {
  runIdleFix(this: App): void {
    if (!this.autoFix || !this.autoFixArmed) return;
    const view = this.editor.view;
    const doc = view.state.doc;
    const pos = view.state.selection.main.head;
    const line = doc.lineAt(pos);
    if (line.text.trim() === "") return; // linha vazia: o gatilho do parágrafo cuida
    // parágrafo em que o cursor está (linhas seguidas não vazias)
    let first = line.number;
    while (first > 1 && doc.line(first - 1).text.trim() !== "") first--;
    let last = line.number;
    while (last < doc.lines && doc.line(last + 1).text.trim() !== "") last++;
    const from = doc.line(first).from;
    const to = doc.line(last).to;
    const texto = doc.toString();
    const fresh = checkStyle(texto).filter((i) => i.fix && i.from >= from && i.to <= to && !autoNaoMexe(i, texto));
    if (!fresh.length) return;
    this.editor.replaceRanges(
      fresh.map((i) => ({ from: i.from, to: i.to, insert: i.fix! })),
      -1
    );
  },

  /** Correção automática: não depende do dicionário, roda logo depois de você pausar. */
  runAutoFix(this: App): void {
    if (!this.autoFix || !this.autoFixArmed) return;
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
    if (typed + ended > 0) void this.runWritingCheck();
    if (ended) toast(`Correção automática: ${ended} ajuste${ended === 1 ? "" : "s"}.`, "ok", 2400);
  },

  async runWritingCheck(this: App): Promise<void> {
    if (this.tab.kind === "word") {
      this.wordHost.recheckSpelling();
      return;
    }
    const text = this.editor.getText();
    try {
      this.issues = await checkText(text, new Set([...this.ignoreWords, ...this.ignoredHere]));
    } catch {
      this.issues = [];
    }
    this.editor.setIssues(this.issues);
    this.updateWritingBadge();
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
    let issues: WritingIssue[] = [];
    try {
      issues = await checkText(texto, new Set([...this.ignoreWords, ...this.ignoredHere]));
    } catch {
      toast("Não foi possível verificar o texto agora.", "err", 3200);
      return;
    }
    const aplicaveis = issues.filter((i) => this.replacementFor(i) !== undefined);
    if (!aplicaveis.length) {
      toast("O texto já está formatado.", "ok", 2600);
      return;
    }
    const quantos = this.applyFixes(aplicaveis);
    this.editor.setIssues(issues);
    this.updateWritingBadge();
    toast(`${quantos} ajuste(s) de formatação aplicado(s). Ctrl+Z desfaz.`, "ok", 4200);
    this.checkWritingSoon();
  },

  /** Liga/desliga a correção automática (guardada entre sessões). */
  setAutoFix(this: App, on: boolean): void {
    this.autoFix = on;
    saveJSON("mdc.autofix", on);
    toast(
      on
        ? "Correção automática ligada: ponto, vírgulas, maiúsculas e trocas formais entram sozinhos."
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
   * Correções automáticas ao salvar (Ctrl+S). Quem salva muitas vezes enquanto escreve não pode ter o texto mexido por
   * baixo da mão: o parágrafo em que o cursor está NÃO é fechado com ponto nem quebrado em frases (a pessoa ainda está
   * escrevendo), nada que toque a palavra sob o cursor é trocado e a ortografia só corrige palavras que ficaram para trás.
   */
  applySaveFixes(this: App): number {
    const view = this.editor.view;
    const doc = view.state.doc;
    const pos = view.state.selection.main.head;
    const texto = doc.toString();
    // o parágrafo do cursor
    const parFrom = this.paragraphStartAt(pos);
    let last = doc.lineAt(pos);
    while (last.number < doc.lines && doc.line(last.number + 1).text.trim() !== "") last = doc.line(last.number + 1);
    const parTo = last.to;
    const fresh = checkStyle(texto).filter((i) => {
      if (i.from <= pos && pos <= i.to) return false; // a palavra que está sendo digitada
      if (i.from >= parFrom && i.to <= parTo && autoNaoMexe(i, texto)) return false; // fechar frase no parágrafo em andamento
      return true;
    });
    return this.applyFixes(fresh) + this.autoFixWords(0, texto.length, true);
  },

  /** Aplica as correções disponíveis numa só ação (um único desfazer). */
  applyFixes(this: App, issues: WritingIssue[]): number {
    const aplicaveis = issues.filter((i) => this.replacementFor(i) !== undefined);
    if (!aplicaveis.length) return 0;
    this.editor.replaceRanges(
      aplicaveis.map((i) => ({ from: i.from, to: i.to, insert: this.replacementFor(i)! }))
    );
    // Aprende com o que foi aceito: a próxima vez que a mesma troca aparecer,
    // o corretor já a conhece (e, repetida o bastante, aplica sozinho).
    for (const i of aplicaveis) registrarCorrecao(i.word, this.replacementFor(i)!);
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
   * texto naquele ponto continua igual antes de trocar.
   */
  autoFixWords(this: App, from: number, to: number, soDepoisDoCursor = true): number {
    const view = this.editor.view;
    const doc = view.state.doc;
    const pos = view.state.selection.main.head;
    const alvos = this.issues.filter(
      (i) =>
        i.kind === "spell" &&
        i.auto &&
        i.from >= from &&
        i.to <= to &&
        (!soDepoisDoCursor || pos > i.to) &&
        doc.sliceString(i.from, i.to) === i.word
    );
    return this.applyFixes(alvos);
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
    const fresh = checkStyle(todoTexto).filter((i) => i.from >= from && i.to <= to && !/nova frase/i.test(i.message));
    return this.applyFixes(fresh) + this.autoFixWords(from, to);
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
    toast(`“${word}” foi adicionada ao dicionário pessoal.`, "ok", 3000);
    void this.runWritingCheck();
    this.wordHost?.recheckSpelling();
  },

  openReview(this: App): void {
    if (this.tab.kind === "word") {
      toast("Em documentos Word, clique nas palavras sublinhadas para ver as sugestões.", "info", 3600);
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
      onRecheck: () => void this.runWritingCheck(),
      onClose: () => {
        this.reviewHandle = null;
      },
    });
  },
};
