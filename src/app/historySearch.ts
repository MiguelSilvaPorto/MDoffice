// Histórico de versões, tom do texto e busca no conteúdo dos documentos.

import type { App } from "./app";
import * as files from "../files";
import { setTone, type Tone } from "../broker/writing";
import { tabLabel } from "../tabs";
import { snapshot } from "../history";
import { openHistoryDialog } from "../historyUi";
import { $, h, toast, baseName, saveJSON } from "../util";

export const historySearchMethods = {
  /** Guarda uma versão do texto (automática, no máximo uma a cada 5 min — ou sempre, ao salvar). */
  recordVersion(this: App, path: string, text: string, force = false): void {
    if (!this.settings.historyOn) return;
    void snapshot(path, text, { max: this.settings.historyMax, force });
  },

  async openHistory(this: App): Promise<void> {
    const word = this.tab.kind === "word";
    if (word ? !(await this.ensureWordFile()) : !this.path && !(await this.ensureSaved())) return;
    const path = this.path;
    if (!path) return;
    const current = () => (word ? this.wordHost.serialized() : this.editor.getText());
    // garante que o estado de agora já esteja no histórico
    await snapshot(path, current(), { max: this.settings.historyMax });
    openHistoryDialog({
      doc: path,
      title: tabLabel(this.tab),
      max: this.settings.historyMax,
      getText: current,
      project: word ? (t) => this.wordProjection(t) : undefined,
      restore: (text) => {
        if (word) this.wordHost.restore(text);
        else this.editor.replaceRange(0, this.editor.getText().length, text);
      },
    });
  },

  async saveVersionNow(this: App): Promise<void> {
    const word = this.tab.kind === "word";
    if (word ? !(await this.ensureWordFile()) : !this.path && !(await this.ensureSaved())) return;
    if (!this.path) return;
    const ok = await snapshot(this.path, word ? this.wordHost.serialized() : this.editor.getText(), { manual: true, max: this.settings.historyMax });
    toast(ok ? "Versão salva no histórico." : "Esse texto já está no histórico.", ok ? "ok" : "info", 2400);
  },

  setTonePref(this: App, tone: Tone): void {
    this.settings = { ...this.settings, tone };
    saveJSON("mdc.settings", this.settings);
    setTone(tone);
    void this.runWritingCheck();
    toast(`Tom do texto: ${tone}.`, "ok", 2200);
  },

  /** Busca no conteúdo: arquivos dos projetos (disco) + o que está nas abas abertas (mesmo sem salvar). */
  async searchContent(this: App, query: string, roots: string[]): Promise<files.ContentHit[]> {
    const fold = (s: string) => Array.from(s, (c) => c.normalize("NFD")[0].toLowerCase()).join("");
    const needle = fold(query.trim());
    if (needle.length < 2) return [];
    const open = new Map<string, files.ContentHit[]>();
    for (const t of this.tabs) {
      if (!t.path) continue;
      const hits: files.ContentHit[] = [];
      this.textOf(t)
        .split("\n")
        .some((line, i) => {
          const pos = fold(line).indexOf(needle);
          if (pos < 0) return false;
          const from = Math.max(0, pos - 50);
          hits.push({
            path: t.path!,
            name: baseName(t.path!),
            line: i + 1,
            text: line.slice(from, pos + needle.length + 90),
            start: pos - from,
            end: pos - from + needle.length,
          });
          return hits.length >= 5;
        });
      open.set(t.path.toLowerCase(), hits);
    }
    let disk: files.ContentHit[] = [];
    if (roots.length) {
      try {
        disk = await files.searchMarkdown(roots, query);
      } catch {
        disk = [];
      }
    }
    const merged = disk.filter((h) => !open.has(h.path.toLowerCase()));
    for (const hits of open.values()) merged.push(...hits);
    return merged.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
  },

  async openAt(this: App, path: string, line: number): Promise<void> {
    if (await this.openPath(path)) {
      window.setTimeout(() => (this.tab.kind === "word" ? this.wordHost.gotoLine(line) : this.editor.gotoLine(line)), 80);
    }
  },
};
