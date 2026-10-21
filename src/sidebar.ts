// Painel lateral: abas de painéis (Início, Projetos, Estrutura), busca e
// árvore de projetos (pastas com documentos .md).
import * as files from "./files";
import { fileIcon, kindOfPath, type FileKind } from "./fileIcons";
import { juntarPasta } from "./pastas";
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
  /** Cria uma pasta dentro de `parent` (a pasta de um projeto ou uma subpasta). */
  newFolder: (parent: string) => void;
  /** Renomeia uma pasta (o app abre o diálogo e aplica). */
  renameFolder: (path: string) => void;
  /** Exclui uma pasta (o app confirma antes; só funciona com a pasta vazia). */
  deleteFolder: (path: string) => void;
  /** Move um documento para a pasta `dir` (arrastar e soltar). */
  moveDoc: (path: string, dir: string) => void;
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

/** Os pedaços de `alvo` abaixo da pasta `raiz` ("raiz/A/B" → ["A", "B"]); [] se não estiver dentro. */
function partesRelativas(raiz: string, alvo: string): string[] {
  const base = raiz.replace(/[\\/]+$/, "");
  if (alvo.length <= base.length || !alvo.toLowerCase().startsWith(base.toLowerCase())) return [];
  const resto = alvo.slice(base.length).replace(/^[\\/]+/, "");
  return resto.split(/[\\/]+/).filter(Boolean);
}

/** A pasta que contém `caminho` (para o arrasto e a trilha saberem o projeto dono). */
function pastaDe(caminho: string): string {
  const corte = Math.max(caminho.lastIndexOf("\\"), caminho.lastIndexOf("/"));
  return corte > 0 ? caminho.slice(0, corte) : caminho;
}

export class Sidebar {
  private hooks: SidebarHooks;
  private active: SidePanel = "projects";
  private projects: string[] = loadJSON<string[]>(PROJECTS_KEY, []);
  private open = new Set<string>(loadJSON<string[]>(OPEN_KEY, []));
  private selected: string | null = null;
  /** pasta em foco (a que a trilha de caminho mostra). */
  private atual: string | null = null;
  /** pastas visitadas antes da atual — é o que o botão Voltar percorre. */
  private historico: string[] = [];
  /** caminho do documento que está sendo arrastado para uma pasta. */
  private arrastando: string | null = null;
  /** a "pastilha" que acompanha o ponteiro durante o arrasto. */
  private pastilha: HTMLElement | null = null;
  /** instante até o qual um clique na linha deve ser ignorado (o arrasto acabou de soltar). */
  private arrastouAte = 0;
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
        if (document.body.classList.contains("home-open")) this.hooks.onHome();
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
    $("#proj-back").addEventListener("click", () => this.voltar());
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
    this.atual = this.selected;
    this.show(this.active);
    await this.refresh();
    // primeira pintura da árvore entra em cascata (só no carregamento)
    if (this.active === "projects") {
      this.animar = "*";
      this.renderProjects();
    }
    window.addEventListener("focus", () => void this.refresh());
    this.acompanharPilula();
  }

  show(panel: SidePanel): void {
    this.active = panel;
    saveJSON(SIDE_KEY, panel);
    const homeAberto = document.body.classList.contains("home-open");
    document.querySelectorAll<HTMLElement>(".sb-tab").forEach((b) => {
      const on = homeAberto ? b.dataset.side === "home" : b.dataset.side === panel;
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
    const homeBtn = document.body.classList.contains("home-open")
      ? document.querySelector<HTMLElement>('.sb-tab[data-side="home"]')
      : null;
    const ativo =
      alvo ?? homeBtn ?? document.querySelector<HTMLElement>('.sb-tab.active:not([data-side="home"])') ?? document.querySelector<HTMLElement>(".sb-tab.active");
    if (!ativo) return;
    // o tamanho vem do BOTÃO (não de um 30×28 fixo no CSS): se o tamanho da aba mudar num ajuste
    // de estilo, a pílula acompanha em vez de ficar deslocada (o print do usuário)
    pilula.style.width = `${ativo.offsetWidth}px`;
    pilula.style.height = `${ativo.offsetHeight}px`;
    pilula.style.transform = `translate(${ativo.offsetLeft}px, ${ativo.offsetTop}px)`;
    pilula.classList.add("on");
    this.pilulaAlvo = ativo;
  }

  /** O botão que a pílula está seguindo (para reposicionar quando o layout mudar). */
  private pilulaAlvo: HTMLElement | null = null;

  /** Reposiciona a pílula no próximo quadro e quando o layout mudar (fonte, zoom, redimensionar). */
  private acompanharPilula(): void {
    const reposicionar = () => this.posicionarPilula(this.pilulaAlvo);
    requestAnimationFrame(reposicionar);
    // a fonte da interface pode carregar depois do start e mexer nas medidas
    void document.fonts?.ready.then(reposicionar);
    window.addEventListener("resize", reposicionar);
    // a barra lateral pode mudar de largura (arrasto da alça) sem resize da janela
    const tabs = document.querySelector<HTMLElement>(".sb-tabs");
    if (tabs && typeof ResizeObserver !== "undefined") new ResizeObserver(reposicionar).observe(tabs);
  }

  setHomeActive(active: boolean): void {
    document.querySelectorAll<HTMLElement>(".sb-tab").forEach((b) => {
      const on = active ? b.dataset.side === "home" : b.dataset.side === this.active;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", String(on));
    });
    const homeBtn = document.querySelector<HTMLElement>('.sb-tab[data-side="home"]');
    this.posicionarPilula(active ? homeBtn : undefined);
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
    // sem pasta em foco ainda (primeira carga, ou a lista mudou): aponta para o projeto atual
    if (!this.atual) this.atual = this.selected ?? this.projects[0] ?? null;
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

  /**
   * Põe uma pasta na lista de projetos, por código (a pasta padrão do app entra assim).
   * Idempotente: se já estiver na lista, não duplica.
   */
  async addProjectPath(this: Sidebar, path: string): Promise<void> {
    if (!path) return;
    if (!this.projects.some((x) => x.toLowerCase() === path.toLowerCase())) {
      this.projects.push(path);
      this.open.add(path);
      this.persist();
      await this.refresh();
    }
    this.show("projects");
  }

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
    this.renderCrumbs();
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
      row.dataset.path = root;
      const txt = h("span", { class: "pj-txt" });
      const nome = h("b", { class: "pj-name" });
      this.pintarNome(nome, rootName);
      txt.append(nome, h("small", { class: "pj-subinfo", text: this.resumoPasta(tree) }));
      row.append(txt, this.botaoNovaSub(root));
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
        else if (!visible.length) box.append(this.vazioLinha(this.query ? "Nada encontrado." : "Nenhum documento aqui ainda.", this.query ? "i-search" : "i-doc"));
        else this.renderNodes(box, visible, openDocs, cascata || alvo === root, alvo);
      }

      row.addEventListener("click", () => {
        this.selected = root;
        this.definirAtual(root);
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
        this.menuDePasta(e.clientX, e.clientY, root, true);
      });
      host.append(row);
      if (box) host.append(box);
      if (box && alvo === root) this.expandir(box);
    });
    if (this.query.length >= 2) this.renderHits(host);
    this.realcarAtual();
  }

  private renderNodes(host: HTMLElement, nodes: files.MdNode[], openDocs: OpenDocInfo[], novo: boolean, alvo: string): void {
    nodes.forEach((node, idx) => {
      if (!this.matches(node)) return;
      if (node.directory) {
        const expanded = this.open.has(node.path) || !!this.query;
        const row = h("button", { class: "pj-sub", type: "button", title: node.path, "aria-expanded": String(expanded) });
        row.dataset.path = node.path;
        row.innerHTML = `<svg class="ic pj-chev-s${expanded ? " open" : ""}"><use href="#i-chevron-r"/></svg><svg class="ic pj-sub-ic"><use href="#i-folder"/></svg>`;
        const nome = h("span", { class: "pj-name" });
        this.pintarNome(nome, node.name);
        row.append(nome, this.botaoNovaSub(node.path));
        if (novo) {
          row.classList.add("pj-entrada");
          row.style.setProperty("--i", String(Math.min(idx, 9)));
        }
        let box: HTMLElement | null = null;
        if (expanded) {
          box = h("div", { class: "pj-children" });
          if (!node.children.length) box.append(this.vazioLinha("Pasta vazia — arraste documentos para cá.", "i-folder"));
          else this.renderNodes(box, node.children, openDocs, novo || alvo === node.path, alvo);
        }
        row.addEventListener("click", () => {
          this.definirAtual(node.path);
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
        row.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          this.menuDePasta(e.clientX, e.clientY, node.path, false);
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
      row.addEventListener("pointerdown", (e) => this.iniciarArrasto(e, node.path));
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

      row.addEventListener("click", () => {
        if (Date.now() < this.arrastouAte) return; // o clique veio de um arrasto que acabou de soltar
        this.hooks.openPath(node.path);
      });
      row.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        // mesmo menu do "⋯" (com a lixeira), só que na posição do clique
        this.hooks.fileMenuAt(e.clientX, e.clientY, node.path);
      });
      host.append(row);
    });
  }

  // ---------- trilha de caminho e navegação entre pastas ----------

  /** Desenha a trilha (breadcrumb) da pasta em foco e o estado do botão Voltar. */
  private renderCrumbs(): void {
    const trilha = document.getElementById("proj-path");
    const voltar = document.getElementById("proj-back") as HTMLButtonElement | null;
    if (!trilha || !voltar) return;
    voltar.disabled = !this.historico.length;
    trilha.textContent = "";

    const raiz = this.atual ? this.projetoDe(this.atual) : null;
    if (!this.atual || !raiz) {
      trilha.append(h("span", { class: "pj-crumb-none", text: this.projects.length ? "Nenhuma pasta selecionada" : "Nenhum projeto" }));
      return;
    }
    const partes = partesRelativas(raiz, this.atual);
    const caminhos = [raiz];
    let acc = raiz;
    for (const parte of partes) {
      acc = juntarPasta(acc, parte);
      caminhos.push(acc);
    }
    const nomes = [baseName(raiz) || raiz, ...partes];
    nomes.forEach((nome, i) => {
      if (i) trilha.append(h("span", { class: "pj-crumb-sep", html: '<svg class="ic"><use href="#i-chevron-r"/></svg>' }));
      const b = h("button", { class: "pj-crumb", type: "button", title: caminhos[i], text: nome });
      if (i === nomes.length - 1) b.classList.add("atual");
      b.addEventListener("click", () => this.irPara(caminhos[i]));
      trilha.append(b);
    });
    trilha.scrollLeft = trilha.scrollWidth;
  }

  /** Põe a pasta em foco e guarda a anterior no histórico (para o Voltar). */
  private definirAtual(path: string): void {
    if (!path) return;
    if (this.atual && this.atual.toLowerCase() === path.toLowerCase()) return;
    if (this.atual) {
      this.historico.push(this.atual);
      if (this.historico.length > 40) this.historico.shift();
    }
    this.atual = path;
    this.renderCrumbs();
  }

  /** Volta à pasta anterior do histórico. */
  private voltar(): void {
    const anterior = this.historico.pop();
    if (!anterior) return;
    this.atual = anterior;
    this.abrirAncestrais(anterior);
    this.renderProjects();
    this.scrollPara(anterior);
  }

  /** Clicar num segmento da trilha: abre o caminho até a pasta e leva a árvore até ela. */
  private irPara(path: string): void {
    this.definirAtual(path);
    this.abrirAncestrais(path);
    this.renderProjects();
    this.scrollPara(path);
  }

  /** Leva a trilha até `path` e abre os ancestrais (usado após criar/mover uma pasta). */
  focarPasta(path: string): void {
    this.irPara(path);
  }

  /** Garante abertas a pasta do projeto e todas as que levam até `path`. */
  private abrirAncestrais(path: string): void {
    const raiz = this.projetoDe(path);
    if (!raiz) return;
    let mudou = false;
    if (!this.open.has(raiz)) {
      this.open.add(raiz);
      mudou = true;
    }
    let acc = raiz;
    for (const parte of partesRelativas(raiz, path)) {
      acc = juntarPasta(acc, parte);
      if (!this.open.has(acc)) {
        this.open.add(acc);
        mudou = true;
      }
    }
    if (mudou) this.persist();
  }

  /** Rola a árvore até a linha da pasta (para a trilha/Voltar manterem a pasta à vista). */
  private scrollPara(path: string): void {
    const baixo = path.toLowerCase();
    const alvo = Array.from(document.querySelectorAll<HTMLElement>("#projects-tree [data-path]")).find(
      (el) => (el.dataset.path ?? "").toLowerCase() === baixo
    );
    alvo?.scrollIntoView({ block: "nearest" });
  }

  /** Realça a pasta em foco na árvore. */
  private realcarAtual(): void {
    const baixo = this.atual?.toLowerCase() ?? null;
    document.querySelectorAll<HTMLElement>("#projects-tree [data-path]").forEach((el) => {
      el.classList.toggle("atual", !!baixo && (el.dataset.path ?? "").toLowerCase() === baixo);
    });
  }

  /** A pasta de projeto que contém `path` (a de nome mais longo que encaixa). */
  private projetoDe(path: string): string | null {
    const baixo = path.toLowerCase();
    let achado: string | null = null;
    for (const p of this.projects) {
      const pb = p.replace(/[\\/]+$/, "").toLowerCase();
      if (baixo === pb || baixo.startsWith(`${pb}\\`) || baixo.startsWith(`${pb}/`)) {
        if (!achado || p.length > achado.length) achado = p;
      }
    }
    return achado;
  }

  /** Os nós (documentos e subpastas) de uma pasta, pela árvore já carregada. */
  private nosDe(dir: string): files.MdNode[] {
    const raiz = this.projetoDe(dir);
    if (!raiz) return [];
    const tree = this.trees.get(raiz);
    if (!Array.isArray(tree)) return [];
    let lista = tree;
    for (const parte of partesRelativas(raiz, dir)) {
      const achado = lista.find((n) => n.directory && n.name.toLowerCase() === parte.toLowerCase());
      if (!achado) return [];
      lista = achado.children;
    }
    return lista;
  }

  /** Nomes das subpastas diretas de `container` (para o diálogo não repetir um nome). */
  nomesDePastas(container: string): Set<string> {
    const nomes = new Set<string>();
    for (const n of this.nosDe(container)) if (n.directory) nomes.add(n.name.toLowerCase());
    return nomes;
  }

  /** Resumo do conteúdo de uma pasta ("3 documentos · 1 pasta"), para a confirmação de excluir. */
  resumoDe(dir: string): string {
    return this.resumoPasta(this.nosDe(dir));
  }

  /** Leva pastas e histórico para o caminho novo depois de renomear uma pasta. */
  repathPrefix(antigo: string, novo: string): void {
    const baixo = antigo.toLowerCase();
    const troca = (p: string): string => (p.toLowerCase().startsWith(baixo) ? novo + p.slice(antigo.length) : p);
    this.open = new Set([...this.open].map(troca));
    if (this.selected) this.selected = troca(this.selected);
    if (this.atual) this.atual = troca(this.atual);
    this.historico = this.historico.map(troca);
    this.persist();
  }

  /** Esquece uma pasta excluída (e o que estava dentro dela) do estado do painel. */
  forgetFolder(path: string): void {
    const baixo = path.toLowerCase();
    const dentro = (p: string) => {
      const l = p.toLowerCase();
      return l === baixo || l.startsWith(`${baixo}\\`) || l.startsWith(`${baixo}/`);
    };
    this.open = new Set([...this.open].filter((p) => !dentro(p)));
    this.historico = this.historico.filter((p) => !dentro(p));
    if (this.selected && dentro(this.selected)) this.selected = this.projects[0] ?? null;
    if (this.atual && dentro(this.atual)) this.atual = this.selected;
    this.persist();
  }

  /** Menu do clique direito de uma pasta (o mesmo para o projeto e para as subpastas). */
  private menuDePasta(x: number, y: number, dir: string, ehProjeto: boolean): void {
    this.definirAtual(dir);
    const itens: { label: string; run: () => void }[] = [
      { label: "Novo documento aqui", run: () => this.hooks.newDocIn(dir) },
      { label: "Nova pasta aqui", run: () => this.hooks.newFolder(dir) },
    ];
    // renomear/excluir valem para as SUBPASTAS: na pasta do projeto, a ação é tirá-la da lista
    // (renomear a raiz mudaria o caminho que o projeto guarda; excluir apagaria a pasta do usuário)
    if (!ehProjeto) {
      itens.push({ label: "Renomear pasta…", run: () => this.hooks.renameFolder(dir) });
      itens.push({ label: "Excluir pasta…", run: () => this.hooks.deleteFolder(dir) });
    }
    itens.push({ label: "Mostrar na pasta", run: () => this.hooks.reveal(dir) });
    if (ehProjeto) {
      itens.push({ label: "Atualizar lista", run: () => void this.refresh() });
      itens.push({ label: "Remover da lista (não apaga nada)", run: () => this.removerProjeto(dir) });
    }
    this.hooks.contextMenu(x, y, itens);
  }

  private removerProjeto(root: string): void {
    this.projects = this.projects.filter((p) => p !== root);
    this.open.delete(root);
    if (this.selected === root) this.selected = this.projects[0] ?? null;
    if (this.atual === root) this.atual = this.selected;
    this.historico = this.historico.filter((p) => p !== root);
    this.persist();
    void this.refresh();
  }

  /** Botão pequeno na linha da pasta: cria uma subpasta ali. */
  private botaoNovaSub(dir: string): HTMLElement {
    const b = h("span", {
      class: "pj-more pj-newsub",
      title: "Nova pasta aqui",
      role: "button",
      "aria-label": `Nova pasta em ${baseName(dir) || dir}`,
    });
    b.innerHTML = '<svg class="ic"><use href="#i-folder-plus"/></svg>';
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hooks.newFolder(dir);
    });
    return b;
  }

  /**
   * Arrastar um documento até uma pasta para movê-lo.
   *
   * O gesto é feito à mão com eventos de PONTEIRO: o arrastar-e-soltar do HTML disputa com
   * o arrastar de arquivos do sistema (que entrega os arquivos soltos na janela), então um
   * limiar de 5 px separa o clique (abre o documento) do arrasto.
   */
  private iniciarArrasto(e: PointerEvent, path: string): void {
    if (e.button !== 0 || e.pointerType === "touch") return; // só mouse/caneta; o toque rola a lista
    if ((e.target as HTMLElement).closest(".pj-more")) return; // o ⋯ e o "nova pasta" têm ação própria
    const linha = e.currentTarget as HTMLElement;
    const x0 = e.clientX;
    const y0 = e.clientY;
    let ativo = false;
    const encerrar = () => {
      window.removeEventListener("pointermove", aoMover, true);
      window.removeEventListener("pointerup", aoSoltar, true);
      window.removeEventListener("pointercancel", aoCancelar, true);
    };
    const aoMover = (ev: PointerEvent) => {
      if (!ativo) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
        ativo = true;
        this.arrastando = path;
        linha.classList.add("arrastando");
        document.body.classList.add("arrastando-doc");
        this.criarPastilha(ev.clientX, ev.clientY, baseName(path));
      }
      ev.preventDefault();
      this.moverPastilha(ev.clientX, ev.clientY);
      this.realcarAlvo(ev.clientX, ev.clientY);
    };
    const aoSoltar = (ev: PointerEvent) => {
      encerrar();
      if (!ativo) return;
      ev.preventDefault();
      this.soltarArrasto(ev.clientX, ev.clientY);
    };
    const aoCancelar = () => {
      encerrar();
      this.cancelarArrasto();
    };
    window.addEventListener("pointermove", aoMover, true);
    window.addEventListener("pointerup", aoSoltar, true);
    window.addEventListener("pointercancel", aoCancelar, true);
  }

  /** A linha de pasta sob o ponteiro (para onde o documento vai se for solto ali). */
  private elementoPastaEm(x: number, y: number): HTMLElement | null {
    const alvo = document.elementFromPoint(x, y) as HTMLElement | null;
    return alvo?.closest<HTMLElement>("#projects-tree .pj-folder[data-path], #projects-tree .pj-sub[data-path]") ?? null;
  }

  /** Acende a pasta sob o ponteiro durante o arrasto. */
  private realcarAlvo(x: number, y: number): void {
    const linha = this.elementoPastaEm(x, y);
    this.limparAlvos();
    if (!linha || !this.arrastando) return;
    const dir = linha.dataset.path ?? "";
    if (pastaDe(this.arrastando).toLowerCase() === dir.toLowerCase()) return; // já está nessa pasta
    linha.classList.add("pj-solta");
  }

  /** Solta o documento: move para a pasta sob o ponteiro (se houver e for outra). */
  private soltarArrasto(x: number, y: number): void {
    const linha = this.elementoPastaEm(x, y);
    const origem = this.arrastando;
    const dir = linha?.dataset.path ?? "";
    this.cancelarArrasto();
    if (!origem || !dir) return;
    if (pastaDe(origem).toLowerCase() === dir.toLowerCase()) return;
    this.arrastouAte = Date.now() + 250; // o clique que vem depois não pode abrir o documento
    this.hooks.moveDoc(origem, dir);
  }

  private cancelarArrasto(): void {
    this.arrastando = null;
    this.limparAlvos();
    document.body.classList.remove("arrastando-doc");
    this.pastilha?.remove();
    this.pastilha = null;
    document.querySelectorAll("#projects-tree .arrastando").forEach((el) => el.classList.remove("arrastando"));
  }

  private criarPastilha(x: number, y: number, texto: string): void {
    const p = h("div", { class: "pj-arrasto", text: texto });
    document.body.append(p);
    this.pastilha = p;
    this.moverPastilha(x, y);
  }

  private moverPastilha(x: number, y: number): void {
    if (!this.pastilha) return;
    this.pastilha.style.left = `${x + 12}px`;
    this.pastilha.style.top = `${y + 12}px`;
  }

  private limparAlvos(): void {
    document.querySelectorAll("#projects-tree .pj-solta").forEach((el) => el.classList.remove("pj-solta"));
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
