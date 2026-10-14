// Painel lateral: abas de painéis (Início, Projetos, Estrutura), busca e
// árvore de projetos (pastas com documentos .md).
import * as files from "./files";
import { fileIcon, kindOfPath, type FileKind } from "./fileIcons";
import { $, baseName, docDirOf, h, loadJSON, saveJSON, stripExt } from "./util";

export type SidePanel = "projects" | "outline";

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
  /** Abre o menu do arquivo na posição do clique direito (os mesmos itens do "⋯"). */
  fileMenuAt: (x: number, y: number, path: string) => void;
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
  /** pasta que deve entrar animada no próximo desenho ("" = nada, "*" = tudo) */
  private animar: "" | "*" | string = "";
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
    this.active = (["projects", "outline"] as string[]).includes(saved) ? (saved as SidePanel) : "projects";
    // barra recolhida já na abertura: tira do Tab e dos leitores de tela (a animação é só visual)
    document.getElementById("sidebar")?.toggleAttribute("inert", document.body.classList.contains("no-sidebar"));
    document.querySelectorAll<HTMLElement>(".sb-tab").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.side === "home") {
          this.hooks.onHome();
          return;
        }
        if (b.dataset.side === "projects") this.animar = "*";
        this.show(b.dataset.side as SidePanel);
      })
    );
    const search = $("#sb-search") as HTMLInputElement;
    search.addEventListener("input", () => {
      this.query = search.value.trim().toLowerCase();
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
    const btnAtualizar = $("#proj-refresh") as HTMLButtonElement;
    btnAtualizar.addEventListener("click", async () => {
      if (btnAtualizar.classList.contains("girando")) return;
      btnAtualizar.classList.add("girando");
      try {
        // um giro mínimo para o clique parecer respondido, mesmo em pastas rápidas
        await Promise.all([this.refresh(), new Promise((r) => window.setTimeout(r, 500))]);
      } finally {
        btnAtualizar.classList.remove("girando");
      }
    });

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
    // primeira pintura da árvore entra em cascata (só no carregamento)
    if (this.active === "projects") {
      this.animar = "*";
      this.renderProjects();
    }
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
    this.posicionarPilula();
    this.render();
  }

  /** Move a pílula do seletor de painéis para o botão ativo (ela desliza no CSS). */
  private posicionarPilula(alvo?: HTMLElement | null): void {
    const pilula = document.querySelector<HTMLElement>(".sb-pill");
    if (!pilula) return;
    const ativo =
      alvo ?? document.querySelector<HTMLElement>('.sb-tab.active:not([data-side="home"])') ?? document.querySelector<HTMLElement>(".sb-tab.active");
    if (!ativo) return;
    pilula.style.transform = `translate(${ativo.offsetLeft}px, ${ativo.offsetTop}px)`;
    pilula.classList.add("on");
  }

  setHomeActive(active: boolean): void {
    const homeBtn = document.querySelector<HTMLElement>('.sb-tab[data-side="home"]');
    if (homeBtn) {
      homeBtn.classList.toggle("active", active);
      homeBtn.setAttribute("aria-selected", String(active));
      this.posicionarPilula(active ? homeBtn : undefined);
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
    await this.refresh();
    this.animar = "*";
    this.show("projects");
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

  /** Resumo da pasta para o subtítulo do projeto ("6 documentos · 2 pastas"). */
  private resumoPasta(tree: files.MdNode[] | string | undefined): string {
    if (tree === undefined) return "carregando…";
    if (typeof tree === "string") return "não foi possível ler esta pasta";
    let docs = 0;
    let pastas = 0;
    const anda = (lista: files.MdNode[]) => {
      for (const n of lista) {
        if (n.directory) {
          pastas++;
          anda(n.children);
        } else docs++;
      }
    };
    anda(tree);
    if (!docs && !pastas) return "pasta vazia";
    const partes = [docs ? `${docs} documento${docs === 1 ? "" : "s"}` : "nenhum documento"];
    if (pastas) partes.push(`${pastas} pasta${pastas === 1 ? "" : "s"}`);
    return partes.join(" · ");
  }

  /** Nome com o trecho buscado destacado (quando a busca está ativa). */
  private pintarNome(el: HTMLElement, nome: string): void {
    const q = this.query;
    const i = q ? nome.toLowerCase().indexOf(q) : -1;
    if (i < 0) {
      el.textContent = nome;
      return;
    }
    el.append(
      document.createTextNode(nome.slice(0, i)),
      h("mark", { class: "pj-mark", text: nome.slice(i, i + q.length) }),
      document.createTextNode(nome.slice(i + q.length))
    );
  }

  /** Linha discreta de aviso dentro da árvore (pasta vazia, erro). */
  private vazioLinha(texto: string, icone = "i-doc"): HTMLElement {
    const vazio = h("div", { class: "pj-vazio", html: `<svg class="ic"><use href="#${icone}"/></svg>` });
    vazio.append(h("span", { text: texto }));
    return vazio;
  }

  /** Esqueleto animado enquanto a pasta ainda não foi lida. */
  private renderSkeleton(box: HTMLElement): void {
    [58, 42, 66, 36].forEach((w, i) => {
      const row = h("div", { class: "pj-skel-row" });
      row.style.setProperty("--w", `${w}%`);
      row.style.setProperty("--i", String(i));
      row.append(h("span", { class: "pj-skel-ic" }), h("span", { class: "pj-skel-bar" }));
      box.append(row);
    });
  }

  /** Fecha uma caixa da árvore animando a altura antes de redesenhar. */
  private recolher(box: HTMLElement): void {
    if (box.dataset.fechando || !box.isConnected || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      this.renderProjects();
      return;
    }
    box.dataset.fechando = "1";
    box.style.maxHeight = `${box.scrollHeight}px`;
    let feito = false;
    const fim = () => {
      if (feito) return;
      feito = true;
      box.removeEventListener("transitionend", aoTerminar);
      window.clearTimeout(relogio);
      this.renderProjects();
    };
    const aoTerminar = (e: TransitionEvent) => {
      if (e.target === box && e.propertyName === "max-height") fim();
    };
    const relogio = window.setTimeout(fim, 320);
    box.addEventListener("transitionend", aoTerminar);
    requestAnimationFrame(() => box.classList.add("pj-fechando"));
  }

  /** Abre uma caixa da árvore crescendo a altura (o inverso do recolher). */
  private expandir(box: HTMLElement): void {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const altura = box.scrollHeight;
    if (!altura) return;
    box.style.maxHeight = "0px";
    box.style.opacity = "0";
    let feito = false;
    const fim = () => {
      if (feito) return;
      feito = true;
      box.removeEventListener("transitionend", aoTerminar);
      window.clearTimeout(relogio);
      // solta a altura para o conteúdo poder crescer depois (um refresh, por exemplo)
      box.style.removeProperty("max-height");
      box.style.removeProperty("opacity");
    };
    const aoTerminar = (e: TransitionEvent) => {
      if (e.target === box && e.propertyName === "max-height") fim();
    };
    const relogio = window.setTimeout(fim, 360);
    box.addEventListener("transitionend", aoTerminar);
    requestAnimationFrame(() => {
      box.style.maxHeight = `${altura}px`;
      box.style.opacity = "1";
    });
  }

  private renderProjects(): void {
    const host = $("#projects-tree");
    host.textContent = "";
    const alvo = this.animar;
    this.animar = "";
    const cascata = alvo === "*";

    if (!this.projects.length) {
      const empty = h("div", { class: "sb-empty pj-empty" });
      const ic = h("span", { class: "pj-empty-ic", html: '<svg class="ic"><use href="#i-folder-plus"/></svg>' });
      const btn = h("button", { class: "btn small", type: "button", text: "Adicionar pasta…" });
      btn.addEventListener("click", () => void this.addFolder());
      empty.append(
        ic,
        h("b", { text: "Nenhum projeto ainda" }),
        h("p", { class: "muted", text: "Um projeto é uma pasta do seu computador com documentos .md." }),
        btn
      );
      if (cascata) empty.classList.add("pj-entrada");
      host.append(empty);
      // mesmo sem projetos, a busca vale para os documentos abertos nas abas
      if (this.query.length >= 2) this.renderHits(host);
      return;
    }

    const openDocs = this.hooks.openDocs();
    this.projects.forEach((root, idx) => {
      const tree = this.trees.get(root);
      const nodes = Array.isArray(tree) ? tree : [];
      const rootName = baseName(root) || root;
      const visible = nodes.filter((n) => this.matches(n));
      if (this.query && !visible.length && !rootName.toLowerCase().includes(this.query)) return;
      const expanded = this.open.has(root) || !!this.query;

      const row = h("button", {
        class: `pj-folder${this.selected === root ? " selected" : ""}${expanded ? " expanded" : ""}`,
        type: "button",
        title: root,
        "aria-expanded": String(expanded),
      });
      row.innerHTML = '<span class="pj-folder-ic"><svg class="ic"><use href="#i-folder"/></svg></span>';
      const txt = h("span", { class: "pj-txt" });
      const nome = h("b", { class: "pj-name" });
      this.pintarNome(nome, rootName);
      txt.append(nome, h("small", { class: "pj-subinfo", text: this.resumoPasta(tree) }));
      row.append(txt);
      row.insertAdjacentHTML("beforeend", `<svg class="ic pj-chev${expanded ? " open" : ""}"><use href="#i-chevron"/></svg>`);
      if (cascata) {
        row.classList.add("pj-entrada");
        row.style.setProperty("--i", String(Math.min(idx, 8)));
      }

      let box: HTMLElement | null = null;
      if (expanded) {
        box = h("div", { class: "pj-children" });
        if (typeof tree === "string") box.append(this.vazioLinha("Não consegui ler esta pasta."));
        else if (!tree) this.renderSkeleton(box);
        else if (!visible.length) box.append(this.vazioLinha(this.query ? "Nada encontrado." : "Nenhum documento .md aqui ainda.", this.query ? "i-search" : "i-doc"));
        else this.renderNodes(box, visible, openDocs, cascata || alvo === root, alvo);
      }

      row.addEventListener("click", () => {
        this.selected = root;
        if (this.open.has(root)) {
          this.open.delete(root);
          this.persist();
          row.classList.remove("expanded");
          row.querySelector(".pj-chev")?.classList.remove("open");
          if (box && !this.query) this.recolher(box);
          else this.renderProjects();
        } else {
          this.open.add(root);
          this.persist();
          this.animar = root;
          this.renderProjects();
        }
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
      if (box) host.append(box);
      if (box && alvo === root) this.expandir(box);
    });
    if (this.query.length >= 2) this.renderHits(host);
  }

  private renderNodes(host: HTMLElement, nodes: files.MdNode[], openDocs: OpenDocInfo[], novo: boolean, alvo: string): void {
    nodes.forEach((node, idx) => {
      if (!this.matches(node)) return;
      if (node.directory) {
        const expanded = this.open.has(node.path) || !!this.query;
        const row = h("button", { class: "pj-sub", type: "button", title: node.path, "aria-expanded": String(expanded) });
        row.innerHTML = `<svg class="ic pj-chev-s${expanded ? " open" : ""}"><use href="#i-chevron-r"/></svg><svg class="ic pj-sub-ic"><use href="#i-folder"/></svg>`;
        const nome = h("span", { class: "pj-name" });
        this.pintarNome(nome, node.name);
        row.append(nome);
        if (novo) {
          row.classList.add("pj-entrada");
          row.style.setProperty("--i", String(Math.min(idx, 9)));
        }
        let box: HTMLElement | null = null;
        if (expanded) {
          box = h("div", { class: "pj-children" });
          this.renderNodes(box, node.children, openDocs, novo || alvo === node.path, alvo);
        }
        row.addEventListener("click", () => {
          if (this.open.has(node.path)) {
            this.open.delete(node.path);
            this.persist();
            row.querySelector(".pj-chev-s")?.classList.remove("open");
            if (box && !this.query) this.recolher(box);
            else this.renderProjects();
          } else {
            this.open.add(node.path);
            this.persist();
            this.animar = node.path;
            this.renderProjects();
          }
        });
        host.append(row);
        if (box) host.append(box);
        if (box && alvo === node.path) this.expandir(box);
        return;
      }

      const info = openDocs.find((d) => d.path && d.path.toLowerCase() === node.path.toLowerCase());
      const row = h("button", {
        class: `pj-doc${info?.active ? " active" : ""}`,
        type: "button",
        title: node.path,
      });
      row.innerHTML = fileIcon(kindOfPath(node.path));
      const nome = h("span", { class: "pj-name" });
      this.pintarNome(nome, stripExt(node.name));
      row.append(nome);
      if (info) {
        if (info.dirty) {
          const st = h("span", { class: "pj-state dirty", title: "Aberto, com alterações" });
          st.append(h("span", { class: "pj-dot" }));
          row.append(st);
        } else {
          row.append(h("span", { class: "pj-state ok", title: "Aberto numa aba", html: '<svg class="ic"><use href="#i-check"/></svg>' }));
        }
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
      if (novo) {
        row.classList.add("pj-entrada");
        row.style.setProperty("--i", String(Math.min(idx, 9)));
      }

      row.addEventListener("click", () => this.hooks.openPath(node.path));
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        // mesmo menu do "⋯" (com a lixeira), só que na posição do clique
        this.hooks.fileMenuAt(e.clientX, e.clientY, node.path);
      });
      host.append(row);
    });
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
