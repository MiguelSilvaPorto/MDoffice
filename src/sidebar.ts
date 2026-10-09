// Painel lateral: abas de painéis (Início, Projetos, Estrutura, Contexto IA), busca e
// árvore de projetos (pastas com documentos .md).
import * as files from "./files";
import { fileIcon, kindOfPath, type FileKind } from "./fileIcons";
import { $, baseName, docDirOf, h, loadJSON, saveJSON, stripExt } from "./util";

export type SidePanel = "projects" | "outline" | "context";

export interface OpenDocInfo {
  id: string;
  path: string | null;
  label: string;
  dirty: boolean;
  active: boolean;
  /** tipo do documento (Markdown, Word, Excel, PowerPoint) */
  kind: FileKind;
}

export interface SidebarHooks {
  openPath: (path: string) => void;
  activateTab: (id: string) => void;
  openDocs: () => OpenDocInfo[];
  recents: () => string[];
  pickFolders: () => Promise<string[]>;
  defaultDir: () => Promise<string>;
  newDocIn: (dir: string) => void;
  reveal: (path: string) => void;
  /** Procura no conteúdo dos documentos (disco + abas abertas). */
  searchContent: (query: string, roots: string[]) => Promise<files.ContentHit[]>;
  openAt: (path: string, line: number) => void;
  /** Filtro de texto do painel Estrutura. */
  outlineFilter: (query: string) => void;
  /** Abre o menu de contexto (x, y) de um item. */
  contextMenu: (x: number, y: number, items: { label: string; run: () => void }[]) => void;
  /** Abre o menu do botão "⋯" de um arquivo, ancorado no elemento. */
  fileMenu: (anchor: HTMLElement, path: string) => void;
  /** Abre ou alterna o Início (Hub de documentos) na área de edição. */
  onHome: () => void;
}

const SIDE_KEY = "mdc.side-panel";
const PROJECTS_KEY = "mdc.projects";
const OPEN_KEY = "mdc.proj-open";

export class Sidebar {
  private hooks: SidebarHooks;
  private active: SidePanel = "projects";
  private projects: string[] = loadJSON<string[]>(PROJECTS_KEY, []);
  private open = new Set<string>(loadJSON<string[]>(OPEN_KEY, []));
  private selected: string | null = null;
  private trees = new Map<string, files.MdNode[] | string>();
  private query = "";
  private refreshing = false;
  private hits: files.ContentHit[] = [];
  private hitsFor = "";
  private searching = false;
  private searchTimer: number | undefined;

  constructor(hooks: SidebarHooks) {
    this.hooks = hooks;
  }

  async init(): Promise<void> {
    const saved = loadJSON<string>(SIDE_KEY, "projects");
    this.active = (["projects", "outline", "context"] as string[]).includes(saved) ? (saved as SidePanel) : "projects";
    document.querySelectorAll<HTMLElement>(".sb-tab").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.side === "home") {
          this.hooks.onHome();
          return;
        }
        this.show(b.dataset.side as SidePanel);
      })
    );
    const search = $("#sb-search") as HTMLInputElement;
    search.addEventListener("input", () => {
      this.query = search.value.trim().toLowerCase();
      // buscar no conteúdo é coisa de projetos: sai do Contexto para ver os resultados
      if (this.query.length >= 2 && this.active === "context") this.show("projects");
      this.render();
      this.scheduleContentSearch();
    });
    search.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        search.value = "";
        this.query = "";
        this.render();
      }
    });
    $("#proj-add").addEventListener("click", () => void this.addFolder());
    $("#proj-new").addEventListener("click", () => this.newDoc());

    // primeiro uso: a pasta padrão de documentos vira o primeiro projeto
    if (!this.projects.length && !loadJSON<boolean>("mdc.projects-init", false)) {
      saveJSON("mdc.projects-init", true);
      try {
        const dir = await this.hooks.defaultDir();
        this.projects = [dir];
        this.open.add(dir);
        this.persist();
      } catch {
        /* sem backend (navegador) */
      }
    }
    this.selected = this.projects[0] ?? null;
    this.show(this.active);
    await this.refresh();
    window.addEventListener("focus", () => void this.refresh());
  }

  show(panel: SidePanel): void {
    this.active = panel;
    saveJSON(SIDE_KEY, panel);
    document.querySelectorAll<HTMLElement>(".sb-tab").forEach((b) => {
      const on = b.dataset.side === panel;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
    });
    document.querySelectorAll<HTMLElement>(".sb-panel").forEach((p) => (p.hidden = p.id !== `sp-${panel}`));
    ($("#sb-search") as HTMLInputElement).placeholder = panel === "outline" ? "Buscar título" : "Buscar";
    this.render();
  }

  setHomeActive(active: boolean): void {
    const homeBtn = document.querySelector<HTMLElement>('.sb-tab[data-side="home"]');
    if (homeBtn) {
      homeBtn.classList.toggle("active", active);
      homeBtn.setAttribute("aria-selected", String(active));
    }
  }

  private persist(): void {
    saveJSON(PROJECTS_KEY, this.projects);
    saveJSON(OPEN_KEY, [...this.open]);
  }

  /** Recarrega a lista de documentos de todos os projetos. */
  async refresh(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;
    try {
      await Promise.all(
        this.projects.map(async (p) => {
          try {
            this.trees.set(p, await files.listMarkdown(p));
          } catch (e) {
            this.trees.set(p, String(e));
          }
        })
      );
    } finally {
      this.refreshing = false;
    }
    this.render();
  }

  /** Focar a busca (usado pelo comando "Buscar no conteúdo"). */
  focusSearch(): void {
    this.show("projects");
    const el = $("#sb-search") as HTMLInputElement;
    el.focus();
    el.select();
  }

  private scheduleContentSearch(): void {
    window.clearTimeout(this.searchTimer);
    if (this.query.length < 2) {
      this.hits = [];
      this.hitsFor = "";
      this.searching = false;
      return;
    }
    this.searching = true;
    this.searchTimer = window.setTimeout(async () => {
      const asked = this.query;
      let found: files.ContentHit[] = [];
      try {
        found = await this.hooks.searchContent(asked, this.projects);
      } catch {
        found = [];
      }
      if (asked !== this.query) return;
      this.hits = found;
      this.hitsFor = asked;
      this.searching = false;
      if (this.active === "projects") this.renderProjects();
    }, 280);
  }

  /** Resultados da busca no conteúdo, agrupados por arquivo. */
  private renderHits(host: HTMLElement): void {
    host.append(h("div", { class: "sb-label", text: "No conteúdo" }));
    if (this.searching && this.hitsFor !== this.query) {
      host.append(h("div", { class: "sb-note", text: "Procurando…" }));
      return;
    }
    if (!this.hits.length) {
      host.append(h("div", { class: "sb-note", text: this.projects.length ? "Nada encontrado nos documentos." : "Adicione uma pasta para buscar no conteúdo." }));
      return;
    }
    const total = this.hits.length;
    host.append(h("div", { class: "sb-note", text: `${total} resultado${total === 1 ? "" : "s"}${total >= 150 ? " (mostrando os primeiros)" : ""}` }));
    let lastPath = "";
    for (const hit of this.hits) {
      if (hit.path !== lastPath) {
        lastPath = hit.path;
        const title = h("div", { class: "ch-file", title: hit.path });
        title.innerHTML = fileIcon(kindOfPath(hit.path));
        title.append(h("span", { text: stripExt(hit.name) }));
        host.append(title);
      }
      const row = h("button", { class: "ch-hit", type: "button", title: `Linha ${hit.line}` });
      row.append(h("span", { class: "ch-line", text: String(hit.line) }));
      const snip = h("span", { class: "ch-text" });
      snip.append(
        document.createTextNode(hit.text.slice(0, hit.start)),
        h("mark", { text: hit.text.slice(hit.start, hit.end) }),
        document.createTextNode(hit.text.slice(hit.end))
      );
      row.append(snip);
      row.addEventListener("click", () => this.hooks.openAt(hit.path, hit.line));
      host.append(row);
    }
  }

  /** O que está aberto/ativo mudou: redesenha os realces. */
  render(): void {
    if (this.active === "projects") this.renderProjects();
    else if (this.active === "outline") this.filterOutline();
  }

  filterOutline(): void {
    this.hooks.outlineFilter(this.query);
  }

  // ---------- projetos ----------

  private async addFolder(): Promise<void> {
    const picked = await this.hooks.pickFolders();
    for (const p of picked) {
      if (!this.projects.some((x) => x.toLowerCase() === p.toLowerCase())) this.projects.push(p);
      this.open.add(p);
      this.selected = p;
    }
    this.persist();
    this.show("projects");
    await this.refresh();
  }

  private newDoc(): void {
    const dir = this.selected ?? this.projects[0];
    if (!dir) {
      void this.addFolder();
      return;
    }
    this.hooks.newDocIn(dir);
  }

  private matches(node: files.MdNode): boolean {
    if (!this.query) return true;
    if (!node.directory) return node.name.toLowerCase().includes(this.query);
    return node.name.toLowerCase().includes(this.query) || node.children.some((c) => this.matches(c));
  }

  private renderProjects(): void {
    const host = $("#projects-tree");
    host.textContent = "";
    if (!this.projects.length) {
      const empty = h("div", { class: "sb-empty" });
      empty.append(
        h("p", { text: "Nenhum projeto ainda." }),
        h("p", { class: "muted", text: "Um projeto é uma pasta do seu computador com documentos .md." })
      );
      const btn = h("button", { class: "btn small", type: "button", text: "Adicionar pasta…" });
      btn.addEventListener("click", () => void this.addFolder());
      empty.append(btn);
      host.append(empty);
      // mesmo sem projetos, a busca vale para os documentos abertos nas abas
      if (this.query.length >= 2) this.renderHits(host);
      return;
    }
    const openDocs = this.hooks.openDocs();
    for (const root of this.projects) {
      const tree = this.trees.get(root);
      const nodes = Array.isArray(tree) ? tree : [];
      const rootName = baseName(root) || root;
      const visible = nodes.filter((n) => this.matches(n));
      if (this.query && !visible.length && !rootName.toLowerCase().includes(this.query)) continue;
      const expanded = this.open.has(root) || !!this.query;

      const row = h("button", { class: `pj-folder${this.selected === root ? " selected" : ""}`, type: "button", title: root });
      row.innerHTML = '<svg class="ic pj-ic"><use href="#i-folder"/></svg>';
      row.append(h("span", { class: "pj-name", text: rootName }));
      row.insertAdjacentHTML("beforeend", `<svg class="ic pj-chev${expanded ? " open" : ""}"><use href="#i-chevron"/></svg>`);
      row.addEventListener("click", () => {
        this.selected = root;
        if (this.open.has(root)) this.open.delete(root);
        else this.open.add(root);
        this.persist();
        this.renderProjects();
      });
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.hooks.contextMenu(e.clientX, e.clientY, [
          { label: "Novo documento aqui", run: () => this.hooks.newDocIn(root) },
          { label: "Atualizar lista", run: () => void this.refresh() },
          { label: "Mostrar na pasta", run: () => this.hooks.reveal(root) },
          {
            label: "Remover da lista (não apaga nada)",
            run: () => {
              this.projects = this.projects.filter((p) => p !== root);
              this.open.delete(root);
              if (this.selected === root) this.selected = this.projects[0] ?? null;
              this.persist();
              this.renderProjects();
            },
          },
        ]);
      });
      host.append(row);

      if (!expanded) continue;
      const box = h("div", { class: "pj-children" });
      if (typeof tree === "string") box.append(h("div", { class: "sb-note", text: "Não consegui ler esta pasta." }));
      else if (!tree) box.append(h("div", { class: "sb-note", text: "Carregando…" }));
      else if (!visible.length) box.append(h("div", { class: "sb-note", text: this.query ? "Nada encontrado." : "Nenhum documento .md aqui ainda." }));
      else this.renderNodes(box, visible, openDocs, 0);
      host.append(box);
    }
    if (this.query.length >= 2) this.renderHits(host);
  }

  private renderNodes(host: HTMLElement, nodes: files.MdNode[], openDocs: OpenDocInfo[], depth: number): void {
    for (const node of nodes) {
      if (!this.matches(node)) continue;
      if (node.directory) {
        const expanded = this.open.has(node.path) || !!this.query;
        const row = h("button", { class: "pj-sub", type: "button", title: node.path });
        row.style.paddingLeft = `${20 + depth * 14}px`;
        row.innerHTML = `<svg class="ic pj-chev-s${expanded ? " open" : ""}"><use href="#i-chevron-r"/></svg><svg class="ic pj-sub-ic"><use href="#i-folder"/></svg>`;
        row.append(h("span", { class: "pj-name", text: node.name }));
        row.addEventListener("click", () => {
          if (this.open.has(node.path)) this.open.delete(node.path);
          else this.open.add(node.path);
          this.persist();
          this.renderProjects();
        });
        host.append(row);
        if (expanded) this.renderNodes(host, node.children, openDocs, depth + 1);
        continue;
      }
      const info = openDocs.find((d) => d.path && d.path.toLowerCase() === node.path.toLowerCase());
      const row = h("button", {
        class: `pj-doc${info?.active ? " active" : ""}`,
        type: "button",
        title: node.path,
      });
      row.style.paddingLeft = `${24 + depth * 14}px`;
      row.innerHTML = fileIcon(kindOfPath(node.path));
      row.append(h("span", { class: "pj-name", text: stripExt(node.name) }));
      if (info) {
        row.append(
          h("span", {
            class: `pj-state${info.dirty ? " dirty" : ""}`,
            text: info.dirty ? "●" : "✓",
            title: info.dirty ? "Aberto, com alterações" : "Aberto numa aba",
          })
        );
      }

      // Botão "⋯": abre as ações do arquivo sem precisar do clique direito.
      const more = h("span", {
        class: "pj-more",
        title: "Ações do arquivo",
        role: "button",
        "aria-label": `Ações de ${node.name}`,
      });
      more.innerHTML = '<svg class="ic"><use href="#i-more"/></svg>';
      more.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.hooks.fileMenu(more, node.path);
      });
      row.append(more);

      row.addEventListener("click", () => this.hooks.openPath(node.path));
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.hooks.contextMenu(e.clientX, e.clientY, [
          { label: "Abrir", run: () => this.hooks.openPath(node.path) },
          { label: "Mostrar na pasta", run: () => this.hooks.reveal(node.path) },
        ]);
      });
      host.append(row);
    }
  }

  // ---------- início ----------

  private async renderHome(): Promise<void> {
    const host = $("#home-list");
    host.textContent = "";
    const q = this.query;
    const openDocs = this.hooks.openDocs().filter((d) => !q || d.label.toLowerCase().includes(q));
    const section = (title: string) => host.append(h("div", { class: "sb-label", text: title }));
    const item = (name: string, sub: string, opts: { kind: FileKind; active?: boolean; dirty?: boolean; onClick: () => void; title?: string }) => {
      const row = h("button", { class: `hm-item${opts.active ? " active" : ""}`, type: "button", title: opts.title ?? sub });
      row.innerHTML = fileIcon(opts.kind);
      const text = h("span", { class: "hm-text" });
      text.append(h("span", { class: "hm-name", text: name }), h("span", { class: "hm-sub", text: sub }));
      row.append(text);
      if (opts.dirty) row.append(h("span", { class: "pj-state dirty", text: "●" }));
      row.addEventListener("click", opts.onClick);
      host.append(row);
    };

    if (openDocs.length) {
      section("Abertos agora");
      for (const d of openDocs) {
        item(d.label, d.path ? docDirOf(d.path) : "ainda não salvo", {
          kind: d.kind,
          active: d.active,
          dirty: d.dirty,
          onClick: () => this.hooks.activateTab(d.id),
        });
      }
    }
    const openPaths = new Set(this.hooks.openDocs().map((d) => (d.path ?? "").toLowerCase()));
    const recents = this.hooks
      .recents()
      .filter((p) => !openPaths.has(p.toLowerCase()) && (!q || baseName(p).toLowerCase().includes(q)))
      .slice(0, 8);
    if (recents.length) {
      section("Recentes");
      for (const p of recents) item(stripExt(baseName(p)), docDirOf(p), { kind: kindOfPath(p), onClick: () => this.hooks.openPath(p) });
    }
    let drafts: files.DraftInfo[] = [];
    try {
      drafts = (await files.listDrafts()).filter((d) => !openPaths.has(d.path.toLowerCase()) && (!q || baseName(d.path).toLowerCase().includes(q))).slice(0, 6);
    } catch {
      /* sem rascunhos (navegador) */
    }
    if (drafts.length) {
      section("Rascunhos do app");
      for (const d of drafts) item(stripExt(baseName(d.path)), "guardado no app", { kind: kindOfPath(d.path), onClick: () => this.hooks.openPath(d.path) });
    }
    if (!host.childElementCount) host.append(h("div", { class: "sb-note", text: q ? "Nada encontrado." : "Nada por aqui ainda. Escreva algo ou abra um arquivo." }));
  }
}
