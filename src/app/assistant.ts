// Assistente de escrita no Markdown: correção automática, avisos e revisão.

import type { App } from "./app";
import { checkText, checkStyle, marcarAplicacao, planejarVarredura, stats as writingStats, spellIsReady, spellHasFailed, type WritingIssue } from "../broker/writing";
import { openReviewModal } from "../broker/review";
import { $, toast, saveJSON } from "../util";

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
    const pos = this.editor.view.state.selection.main.head;
    const par = this.paragrafoDoCursor(pos);
    const correcoes = planejarVarredura(texto, { pos, from: 0, to: texto.length, parFrom: par.from, parTo: par.to, parConcluido: par.concluido });
    if (!correcoes.length) return;
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
   * Correções automáticas ao salvar (Ctrl+S): mesma política da varredura — o parágrafo em que
   * o cursor está só é fechado com ponto quando ele está concluído, nada que toque a palavra sob
   * o cursor é trocado e a ortografia só corrige palavras que ficaram para trás.
   */
  applySaveFixes(this: App): number {
    const pos = this.editor.view.state.selection.main.head;
    const texto = this.editor.getText();
    const par = this.paragrafoDoCursor(pos);
    const correcoes = planejarVarredura(texto, { pos, from: 0, to: texto.length, parFrom: par.from, parTo: par.to, parConcluido: par.concluido });
    if (correcoes.length) this.editor.replaceRanges(correcoes, -1);
    return correcoes.length + this.autoFixWords(0, texto.length, true);
  },

  /** Aplica as correções disponíveis numa só ação (um único desfazer). */
  applyFixes(this: App, issues: WritingIssue[]): number {
    const aplicaveis = issues.filter((i) => this.replacementFor(i) !== undefined);
    if (!aplicaveis.length) return 0;
    this.editor.replaceRanges(
      aplicaveis.map((i) => ({ from: i.from, to: i.to, insert: this.replacementFor(i)! }))
    );
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
    const correcoes = planejarVarredura(todoTexto, { pos: view.state.selection.main.head, from, to, parFrom: from, parTo: to, parConcluido: true });
    if (correcoes.length) {
      this.editor.replaceRanges(correcoes, -1);
      marcarAplicacao(todoTexto);
    }
    return correcoes.length + this.autoFixWords(from, to);
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
