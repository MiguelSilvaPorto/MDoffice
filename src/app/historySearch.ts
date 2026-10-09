// Histórico de versões, tom do texto e busca no conteúdo dos documentos.

import type { App } from "./app";
import * as files from "../files";
import * as backup from "../backup";
import { setTone, type Tone } from "../broker/writing";
import { tabLabel } from "../tabs";
import { snapshot } from "../history";
import { recordCommit, countCommits, ANCHOR_EVERY } from "../snapshots";
import { openHistoryDialog } from "../historyUi";
import { openMissingDialog } from "../backupUi";
import { $, h, toast, baseName, saveJSON, loadJSON } from "../util";

/**
 * Último texto registrado no log de alterações, junto do documento a que ele pertence.
 *
 * Guardar o caminho evita o erro que apareceria ao trocar de aba: o texto da aba nova é
 * comparado com o da aba antiga e o patch sairia sem sentido.
 */
const ultimo: { path: string | null; texto: string } = { path: null, texto: "" };
const CHAVE_DIA = "mdc.backup.dia";
/** Quantos commits já foram exportados para a pasta de backup, por documento. */
const logExportado = new Map<string, number>();

/**
 * Compara o texto de agora com o último registrado e guarda o patch, quando faz sentido.
 *
 * A gravação é agrupada: uma pausa na digitação vira um commit (como um commit do Git),
 * com tudo o que mudou desde o anterior. Assim o log não pesa no que você está
 * escrevendo e ainda dá para voltar a qualquer pausa.
 */
let flushTimer: number | undefined;
let pendente: { path: string; texto: string } | null = null;

/** Grava o commit que estiver pendente agora (ao salvar, trocar de aba ou fechar). */
function gravarCommitPendente(): void {
  if (flushTimer !== undefined) {
    window.clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  if (!pendente) return;
  const { path, texto } = pendente;
  pendente = null;
  const anterior = ultimo.texto;
  const mesmoDoc = ultimo.path === path;
  ultimo.path = path;
  ultimo.texto = texto;
  if (!mesmoDoc || anterior === texto) return;
  void recordCommit(path, anterior, texto);
}

/** Agenda a gravação do commit: uma pausa na digitação vira um commit. */
function agendarCommit(path: string, texto: string): void {
  pendente = { path, texto };
  if (flushTimer !== undefined) window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => gravarCommitPendente(), 1200);
}

/** Compara o texto de agora com o último registrado e agenda o patch, quando faz sentido. */
function registrarMudanca(path: string | null, texto: string): boolean {
  if (path !== ultimo.path) {
    // documento novo: o log começa daqui (senão o primeiro patch compararia dois textos
    // de documentos diferentes)
    gravarCommitPendente();
    ultimo.path = path;
    ultimo.texto = texto;
    return false;
  }
  if (path && texto !== ultimo.texto) agendarCommit(path, texto);
  return true;
}

export const historySearchMethods = {
  /** Guarda uma versão do texto (automática, no máximo uma a cada 5 min — ou sempre, ao salvar). */
  recordVersion(this: App, path: string, text: string, force = false): void {
    if (!this.settings.historyOn) return;
    void snapshot(path, text, { max: this.settings.historyMax, force });
  },

  /**
   * Guarda no log de alterações a mudança que acabou de acontecer.
   *
   * Não guarda o arquivo inteiro: guarda o patch (o que saiu, o que entrou). É leve,
   * roda a cada tecla e ainda assim permite voltar a qualquer ponto.
   */
  recordChange(this: App): void {
    if (!this.settings.commitsOn) return;
    registrarMudanca(this.path, this.editor.getText());
  },

  /** Marca o texto atual como "último registrado" (usado ao abrir/trocar de documento). */
  markText(this: App, text: string): void {
    ultimo.path = this.path;
    ultimo.texto = text;
  },

  /**
   * Grava uma cópia do documento em disco, nas duas pastas de backup.
   *
   * `motivo` é só para a mensagem: "salvar", "trocar de aba", "fechar o app"…
   */
  async backupNow(this: App, path: string | null, motivo: string): Promise<void> {
    if (!path || !this.settings.backupOn) return;
    // se houver um commit por gravar, ele entra antes da cópia (o log vai junto)
    gravarCommitPendente();
    const res = await backup.gravar(path);
    this.setBackupState(res.failed.length ? "degradado" : "ok", res.failed[0]);
    if (res.failed.length && motivo === "salvar") {
      toast(`Backup: ${res.failed[0]}`, "err", 6000);
    }
  },

  /** Uma cópia por dia na primeira alteração do dia (cobre o "esqueci de salvar"). */
  async backupOnceADay(this: App, path: string | null): Promise<void> {
    if (!path || !this.settings.backupOn) return;
    const hoje = backup.diaDeHoje();
    let dias: Record<string, string> = loadJSON(CHAVE_DIA, {});
    if (dias[path] === hoje) return;
    dias[path] = hoje;
    // guarda no máximo um mês de marcações por documento
    const chaves = Object.keys(dias);
    if (chaves.length > 500) for (const k of chaves.slice(0, chaves.length - 500)) delete dias[k];
    saveJSON(CHAVE_DIA, dias);
    await this.backupNow(path, "diário");
  },

  /** Grava a cópia quando o documento tem alterações e você sai dele (troca de aba, fecha). */
  backupOnLeave(this: App, path: string | null, dirty: boolean): void {
    if (!dirty) return;
    void this.backupNow(path, "trocar de aba");
  },

  /** Exporta o log de alterações para a pasta de backup (junto da âncora). */
  async exportLog(this: App, path: string | null, force = false): Promise<void> {
    if (!path || !this.settings.backupOn) return;
    // só regrava o log inteiro quando vale a pena: a cada âncora (20 commits) ou quando
    // pedido. Gravar a cada Ctrl+S custaria uma escrita grande sem necessidade.
    const total = await countCommits(path);
    const ultimo = logExportado.get(path) ?? 0;
    if (!force && total - ultimo < ANCHOR_EVERY) return;
    logExportado.set(path, total);
    await backup.exportarLog(path);
  },

  /** Procura documentos com backup cujo original sumiu do disco. */
  async checkMissing(this: App): Promise<void> {
    if (!this.settings.backupOn || !this.settings.backupWarnMissing) return;
    const perdidos = await backup.sumidos();
    if (!perdidos.length) {
      if (this.backupState === "perigo") this.setBackupState("ok", "");
      return;
    }
    this.missingBackups = perdidos;
    this.setBackupState("perigo", "");
    toast(
      `${perdidos.length} arquivo(s) com backup não estão mais no disco. Abrir o histórico para restaurar.`,
      "err",
      9000
    );
  },

  /**
   * Log de alterações para os motores que serializam em texto (Word, PowerPoint, Excel).
   *
   * O diff é o mesmo do Markdown: o app só passa o texto serializado da aba.
   */
  recordSerializedChange(this: App, texto: string): void {
    if (!this.settings.commitsOn) return;
    registrarMudanca(this.path, texto);
  },

  /** Abre a lista de arquivos que só existem no backup (indicador vermelho). */
  openMissingBackups(this: App): void {
    openMissingDialog(this.missingBackups, () => void this.checkMissing());
  },

  /** Atualiza o indicador de backup da barra inferior. */
  setBackupState(this: App, estado: "ok" | "degradado" | "perigo", detalhe = ""): void {
    this.backupState = estado;
    this.backupDetail = detalhe;
    const el = document.querySelector<HTMLElement>("#st-backup");
    if (!el) return;
    const on = this.settings.backupOn;
    el.hidden = !on;
    if (!on) return;
    const textos = {
      ok: "Backup em dia",
      degradado: `Backup parcial${detalhe ? `: ${detalhe}` : ""}`,
      perigo: `${this.missingBackups.length} arquivo(s) só existem no backup`,
    };
    el.textContent = { ok: "🟢", degradado: "🟡", perigo: "🔴" }[estado];
    el.title = textos[estado];
    el.className = `path-btn st-backup ${estado}`;
  },

  async openHistory(this: App): Promise<void> {
    const kind = this.tab.kind;
    // garante que o documento tenha arquivo (o histórico é por arquivo)
    if (kind === "word" && !(await this.ensureWordFile())) return;
    if (kind === "ppt" && !(await this.ensurePptFile())) return;
    if (kind === "xlsx" && !(await this.ensureExcelFile())) return;
    if ((!kind || kind === "doc") && !this.path && !(await this.ensureSaved())) return;
    const path = this.path;
    if (!path) return;

    // o texto do estado atual, no formato de cada motor (é o que vai para o histórico)
    const current = () =>
      kind === "word"
        ? this.wordHost.serialized()
        : kind === "ppt"
          ? this.pptHost.serialized()
          : kind === "xlsx"
            ? this.excelHost.serialized()
            : this.editor.getText();
    const project = (text: string) => {
      if (kind === "word") return this.wordProjection(text);
      if (kind === "ppt") return this.pptHost.projection(text);
      if (kind === "xlsx") return this.excelHost.projection(text);
      return text;
    };

    // garante que o estado de agora já esteja no histórico
    await snapshot(path, current(), { max: this.settings.historyMax });
    openHistoryDialog({
      doc: path,
      title: tabLabel(this.tab),
      max: this.settings.historyMax,
      getText: current,
      project,
      restore: (text) => {
        if (kind === "word") this.wordHost.restore(text);
        else if (kind === "ppt") this.pptHost.restoreSerialized(text);
        else if (kind === "xlsx") this.excelHost.restore(text);
        else this.editor.replaceRange(0, this.editor.getText().length, text);
      },
      // cópia restaurada em disco: lê o arquivo de volta para o editor
      reloadFromDisk: () => this.reloadCurrentFromDisk(path),
    });
  },

  /**
   * Relê do disco o documento aberto (depois de restaurar uma cópia de backup).
   *
   * Sem isso, o texto antigo que está no editor voltaria a ser gravado no próximo
   * salvamento automático — desfazendo a restauração que você acabou de pedir.
   */
  async reloadCurrentFromDisk(this: App, path: string): Promise<void> {
    const tab = this.tab;
    if (tab.path !== path) return;
    try {
      if (tab.kind === "word") {
        const { doc, setup } = await this.readDocx(path);
        this.wordHost.load(this.wordHost.createTab(doc, setup));
      } else if (tab.kind === "ppt") {
        const { deck, setup } = await this.readPptx(path);
        this.pptHost.load(this.pptHost.createTabFromDeck(deck, setup));
      } else if (tab.kind === "xlsx") {
        const { livro, config } = await this.readXlsx(path);
        this.excelHost.load({ livro, config, linha: 0, coluna: 0 });
      } else {
        const texto = await files.loadDoc(path);
        this.editor.replaceRange(0, this.editor.getText().length, texto);
      }
      tab.dirty = false;
      tab.statusSaved = "Recarregado do disco (cópia restaurada)";
      // o log de alterações continua do texto que está abrindo
      this.markText(this.tab.kind === "word" ? this.wordSerialized(tab) : this.tab.kind === "ppt" ? this.pptSerialized(tab) : this.tab.kind === "xlsx" ? this.excelSerialized(tab) : this.editor.getText());
      this.afterTabChange();
    } catch (e) {
      toast("A cópia foi restaurada, mas não consegui recarregar a tela: " + e, "err", 6000);
    }
  },

  async saveVersionNow(this: App): Promise<void> {
    const kind = this.tab.kind;
    if (kind === "word" && !(await this.ensureWordFile())) return;
    if (kind === "ppt" && !(await this.ensurePptFile())) return;
    if (kind === "xlsx" && !(await this.ensureExcelFile())) return;
    if ((!kind || kind === "doc") && !this.path && !(await this.ensureSaved())) return;
    if (!this.path) return;
    const texto =
      kind === "word"
        ? this.wordHost.serialized()
        : kind === "ppt"
          ? this.pptHost.serialized()
          : kind === "xlsx"
            ? this.excelHost.serialized()
            : this.editor.getText();
    const ok = await snapshot(this.path, texto, { manual: true, max: this.settings.historyMax });
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
