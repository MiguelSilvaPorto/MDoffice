// Documentos de planilha (.xlsx) dentro do app: criar, abrir, salvar e fechar
// com segurança. Espelha src/app/powerpointDocs.ts (mesmos nomes, mesma ordem).

import type { App } from "./app";
import * as files from "../files";
import { newTab, tabLabel, type DocTab } from "../tabs";
import { moveHistory } from "../history";
import { moveCommits } from "../snapshots";
import { avisoOfficeSemAutosave } from "./seloAutosave";
import { type ExcelTabData } from "../excel/host";
import { livroParaXlsx } from "../excel/xlsxexport";
import { xlsxParaLivro } from "../excel/xlsximport";
import type { ConfigPlanilha, Estilo, Folha, Livro } from "../excel/schema";
import { nomeColuna } from "../excel/refs";
import { bytesToBase64 } from "../util";
import { $, toast, baseName, joinPath, fmtTime, slugify } from "../util";

export const excelDocsMethods = {
  /** Cria uma aba de planilha (sem ativá-la). */
  addExcelTab(this: App, data: ExcelTabData, init: Partial<DocTab> = {}): DocTab {
    const tab = newTab(this.editor.createState(""), {
      kind: "xlsx",
      xlsx: data,
      title: "Planilha",
      statusSaved: "Nova planilha",
      ...init,
    });
    this.tabs.push(tab);
    return tab;
  },

  async newExcelDoc(this: App): Promise<void> {
    const tab = this.addExcelTab(this.excelHost.createTab());
    await this.switchTo(tab.id);
    this.excelHost.focus();
    // nasce salva na pasta padrão do app (Documentos/mdOffice/Excel), sem perguntar nada
    await this.nascerNoPadrao("excel");
  },

  /** Lê os bytes de um .xlsx do disco (data URL -> Uint8Array). */
  async readXlsx(this: App, path: string): Promise<{ livro: Livro; config: ConfigPlanilha }> {
    const url = await files.readDataUrl(path);
    const bin = atob(url.slice(url.indexOf(",") + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const { livro, grade } = await xlsxParaLivro(bytes);
    const config = this.excelHost.setup_();
    return { livro, config: { ...config, grade } };
  },

  async addXlsxTab(this: App, path: string, isDraft = false): Promise<DocTab> {
    const { livro, config } = await this.readXlsx(path);
    return this.addExcelTab({ livro, config, linha: 0, coluna: 0 }, {
      path,
      isDraft,
      title: null,
      statusSaved: isDraft ? "Rascunho guardado no app" : `Aberto às ${fmtTime()}`,
    });
  },

  async openXlsx(this: App, path: string): Promise<boolean> {
    try {
      const tab = await this.addXlsxTab(path);
      this.addRecent(path);
      const current = this.tab;
      const reuse =
        current.kind !== "xlsx" &&
        current.kind !== "word" &&
        current.kind !== "ppt" &&
        !current.path &&
        !current.dirty &&
        this.textOf(current).length === 0;
      await this.switchTo(tab.id);
      if (reuse && this.tab === tab) {
        this.tabs = this.tabs.filter((t) => t !== current);
        this.afterTabChange();
      }
      return true;
    } catch (e) {
      toast("Não foi possível abrir a planilha: " + e, "err", 7000);
      return false;
    }
  },

  enterXlsx(this: App, target: DocTab): void {
    document.body.classList.add("xlsx-open");
    $("#excel-pane").hidden = false;
    this.excelHost.load(target.xlsx!);
    this.outline?.useCollapsed(target.outlineCollapsed);
    this.afterTabChange();
    // o log de alterações começa do texto que está abrindo
    this.markText(this.excelSerialized(target));
    this.excelHost.focus();
  },

  leaveXlsx(this: App): void {
    document.body.classList.remove("xlsx-open");
  },

  onExcelChange(this: App): void {
    if (this.tab.kind !== "xlsx") return;
    const was = this.dirty;
    this.dirty = true;
    if (!was) this.refreshTitle();
    this.setSaveState();
    this.autosaveSoon();
    // log de alterações (a planilha também serializa em texto)
    this.recordSerializedChange(this.excelSerialized(this.tab));
  },

  /** Contagens da planilha mudaram: rodapé. */
  excelStatus(this: App): void {
    if (this.tab.kind !== "xlsx") return;
    const s = this.excelHost.stats();
    $("#st-words").textContent = `${s.celulas} célula${s.celulas === 1 ? "" : "s"} preenchida${s.celulas === 1 ? "" : "s"}`;
    $("#st-chars").textContent = `${s.abas} aba${s.abas === 1 ? "" : "s"}`;
    $("#st-lines").textContent = `Zoom ${s.zoom}%`;
    const badge = document.querySelector<HTMLElement>("#st-writing");
    if (badge) badge.hidden = true;
  },

  /** Grava o .xlsx de uma aba (a ativa lê do motor; as outras, do estado guardado). */
  async writeXlsx(this: App, tab: DocTab, path: string): Promise<void> {
    const live = tab === this.tab;
    const data = live ? this.excelHost.snapshot() : tab.xlsx!;
    const bytes = await livroParaXlsx(data.livro, {
      titulo: tabLabel(tab),
      autor: "mdOffice",
      grade: data.config.grade,
      casas: data.config.casas,
    });
    await files.saveBinary(path, bytesToBase64(bytes));
  },

  excelSerialized(this: App, tab: DocTab): string {
    return tab === this.tab ? this.excelHost.serialized() : JSON.stringify(tab.xlsx!.livro);
  },

  /** Documento novo ainda sem arquivo: cria o rascunho (.xlsx) na pasta do app. */
  async ensureExcelFile(this: App): Promise<boolean> {
    const tab = this.tab;
    if (tab.path) return true;
    try {
      tab.path = await files.draftPath(slugify(tabLabel(tab)) || "planilha", "xlsx");
      tab.isDraft = true;
      await this.writeXlsx(tab, tab.path);
      tab.dirty = false;
      tab.statusSaved = "Rascunho guardado no app";
      this.afterSave(tab);
      this.saveSession();
      return true;
    } catch (e) {
      toast("Não consegui guardar o rascunho: " + e, "err", 6000);
      return false;
    }
  },

  /**
   * Salvamento automático. Mesma regra do Word e do PowerPoint: rascunhos do
   * app são regravados sempre; arquivos SEUS só são gravados em Salvar — o motor
   * converte a planilha e recursos que ele ainda não entende podem ser
   * simplificados. O histórico guarda cópias de qualquer jeito, o selo da barra mostra
   * "Não salvo" e um aviso (uma vez por arquivo) explica o Ctrl+S.
   */
  async autosaveExcel(this: App): Promise<void> {
    const tab = this.tab;
    if (tab.kind !== "xlsx" || !tab.dirty) return;
    if (tab.path && !tab.isDraft) {
      this.recordVersion(tab.path, this.excelHost.serialized());
      if (this.avisosOffice.primeiraVez(tab.path)) toast(avisoOfficeSemAutosave("xlsx"), "info", 9000);
      return;
    }
    try {
      if (!tab.path) {
        tab.path = await files.draftPath(slugify(tabLabel(tab)) || "planilha", "xlsx");
        tab.isDraft = true;
      }
      await this.writeXlsx(tab, tab.path);
      tab.dirty = false;
      tab.statusSaved = `Rascunho atualizado às ${fmtTime()}`;
      this.recordVersion(tab.path, this.excelSerialized(tab));
      // uma cópia em disco por dia, mesmo sem salvar
      this.backupOnceADay(tab.path);
      this.afterSave(tab);
      this.saveSession();
    } catch {
      /* sem acesso a arquivos (navegador): segue sem salvar */
    }
  },

  async saveExcel(this: App, saveAs: boolean): Promise<boolean> {
    const tab = this.tab;
    try {
      const previous = tab.path;
      const wasDraft = tab.isDraft;
      // Rascunho NÃO é motivo para perguntar onde salvar: ele JÁ tem arquivo (o da pasta de
      // rascunhos). O Ctrl+S grava nele; "Salvar como…" é que escolhe uma pasta do usuário.
      // .xlsm continua forçando o seletor: o app não preserva macros, então salva como .xlsx.
      const macro = /\.xlsm$/i.test(tab.path ?? "");
      if (saveAs || !tab.path || macro) {
        const suggested = `${tabLabel(tab)}.xlsx`;
        let defaultPath = suggested;
        try {
          defaultPath = joinPath(await this.pastaPadraoDoTipo("excel"), suggested);
        } catch {
          /* só o nome */
        }
        const picked = await files.pickSaveAny(defaultPath, "Planilha (.xlsx)", ["xlsx"]);
        if (!picked) return false;
        tab.path = /\.xlsx$/i.test(picked) ? picked : `${picked.replace(/\.[a-zA-Z0-9]+$/, "")}.xlsx`;
        tab.isDraft = false;
        tab.title = null;
      }
      await this.writeXlsx(tab, tab.path!);
      if (wasDraft && previous && previous !== tab.path) void files.deleteDraft(previous).catch(() => {});
      if (previous && previous !== tab.path) {
        void moveHistory(previous, tab.path!);
        void moveCommits(previous, tab.path!);
      }
      tab.dirty = false;
      tab.statusSaved = tab.isDraft ? `Rascunho atualizado às ${fmtTime()}` : `Salvo às ${fmtTime()}`;
      this.recordVersion(tab.path!, this.excelSerialized(tab), true);
      // cópia real em disco
      void this.backupNow(tab.path!, "salvar");
      void this.exportLog(tab.path!);
      if (!tab.isDraft) this.addRecent(tab.path!);
      this.setPreviewPath(tab.path);
      this.afterTabChange();
      // No rascunho, quem avisa é o selo ("Rascunho atualizado") — não um toast a cada Ctrl+S.
      if (!tab.isDraft) {
        if (!this.xlsxNotice) {
          this.xlsxNotice = true;
          toast(
            "Salvo como .xlsx. Células, fórmulas, números, cores e mesclas vão como estão; gráficos, imagens e formatação condicional que o mdOffice ainda não entende não são exportados.",
            "info",
            8500
          );
        } else toast(`Planilha salva em ${baseName(tab.path!)}`, "ok", 2600);
      }
      return true;
    } catch (e) {
      toast("Erro ao salvar: " + e, "err", 7000);
      return false;
    }
  },

  /** Antes de fechar uma aba de planilha: rascunhos ficam guardados; arquivos seus perguntam. */
  async prepareCloseExcel(this: App, tab: DocTab): Promise<boolean> {
    if (!tab.dirty) return true;
    if (tab.isDraft || !tab.path) {
      try {
        if (tab === this.tab) await this.autosaveExcel();
        else {
          if (!tab.path) {
            tab.path = await files.draftPath(slugify(tabLabel(tab)) || "planilha", "xlsx");
            tab.isDraft = true;
          }
          await this.writeXlsx(tab, tab.path);
        }
      } catch {
        /* segue: nada a fazer sem acesso a arquivos */
      }
      return true;
    }
    const choice = await this.askSaveChanges(tabLabel(tab));
    if (choice === "cancel") return false;
    if (choice === "save") {
      if (tab !== this.tab) {
        await this.switchTo(tab.id);
        if (this.tab !== tab) return false;
      }
      if (!(await this.saveExcel(false))) return false;
    }
    return true;
  },

  /**
   * Modelo do Início ("Planilha Orçamentária"): uma aba só, com as contas de
   * previsão e realizado já em fórmula, para o motor mostrar o cálculo real.
   */
  async criarOrcamento(this: App): Promise<void> {
    const aba: Folha = {
      nome: "Orçamento",
      celulas: {},
      colunas: { 0: 190, 1: 230, 2: 120, 3: 120, 4: 120 },
      linhas: {},
      // o rótulo ocupa A6:D6 mesclado; a fórmula fica em E6
      mesclas: ["A6:D6"],
      congelado: { colunas: 0, linhas: 1 },
    };
    const cabecalho = { negrito: true, fundo: "E8F0FE", alinhamento: "centro" as const };
    const dinheiro: Estilo = { numero: "moeda" as const };
    const titulos = ["Categoria", "Descrição", "Previsão", "Realizado", "Diferença"];
    titulos.forEach((t, i) => {
      aba.celulas[`${nomeColuna(i)}1`] = { texto: t, estilo: cabecalho };
    });
    const linhas: [string, string, number, number][] = [
      ["Pessoal", "Desenvolvimento", 15000, 14200],
      ["Infraestrutura", "Servidores e nuvem", 3500, 3100],
      ["Marketing", "Lançamento", 5000, 5000],
    ];
    linhas.forEach(([categoria, descricao, prev, real], i) => {
      const r = i + 2;
      aba.celulas[`A${r}`] = { texto: categoria };
      aba.celulas[`B${r}`] = { texto: descricao };
      aba.celulas[`C${r}`] = { texto: String(prev).replace(".", ","), estilo: dinheiro };
      aba.celulas[`D${r}`] = { texto: String(real).replace(".", ","), estilo: dinheiro };
      aba.celulas[`E${r}`] = { texto: `=C${r}-D${r}`, formula: true, estilo: dinheiro };
    });
    // linha de totais: A6:D6 é o rótulo mesclado e as três colunas somam abaixo
    const totais: Estilo = { negrito: true, numero: "moeda", fundo: "F1F5F9" };
    aba.celulas.A6 = { texto: "Total", estilo: { negrito: true, fundo: "F1F5F9" } };
    aba.celulas.C6 = { texto: "=SOMA(C2:C4)", formula: true, estilo: totais };
    aba.celulas.D6 = { texto: "=SOMA(D2:D4)", formula: true, estilo: totais };
    aba.celulas.E6 = { texto: "=SOMA(E2:E4)", formula: true, estilo: totais };

    const data = this.excelHost.createEmpty();
    const tab = this.addExcelTab({
      livro: { folhas: [aba], ativa: 0 },
      config: data.config,
      linha: 0,
      coluna: 0,
    });
    await this.switchTo(tab.id);
    this.excelHost.focus();
    toast("Planilha orçamentária criada — os totais já são fórmulas. Ctrl+Shift+S salva como .xlsx.", "ok", 4200);
  },

};