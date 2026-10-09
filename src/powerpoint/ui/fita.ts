// A fita da apresentação, no desenho do PowerPoint: abas (Página Inicial, Inserir, Formato da Forma, Design, Exibir),
// grupos com o nome embaixo, botões grandes e pequenos. Tudo é despachado por `run(comando, valor)` para o host.
import { SOMBRAS_PRONTAS } from "../edicao/formato";
import { ROTULOS_PRESET, type PresetTabela } from "../edicao/tabela";
import type { SlideLayout } from "../schema";
import { abrirCores } from "./cores";
import { FONTES_COMUNS, TAMANHOS, cmParaPt, ptParaCm, type EstadoUI } from "./estado";
import { abrirGaleria, iconeDeForma } from "./galeria";
import { abrirPopup, fecharPopup } from "./popup";
import { GALERIA } from "../edicao/criar";
import { ORDEM_LAYOUTS, ROTULOS_LAYOUT } from "../edicao/layouts";

export interface HooksFita {
  estado: () => EstadoUI;
  run: (cmd: string, valor?: string) => void;
}

const ic = (n: string) => `<svg class="ic"><use href="#${n}"/></svg>`;

const btn = (cmd: string, conteudo: string, titulo: string, extra = "", menu = false) =>
  `<button type="button" class="ppr ${extra}${menu ? " tem-menu" : ""}" data-cmd="${cmd}"${menu ? ' data-menu="1"' : ""} title="${titulo}" aria-label="${titulo}">${conteudo}${menu ? '<span class="car">▾</span>' : ""}</button>`;

const grande = (cmd: string, icone: string, nome: string, titulo: string, menu = false) => btn(cmd, `${icone}<span>${nome}</span>`, titulo, "big", menu);
const pequeno = (cmd: string, icone: string, nome: string, titulo: string, menu = false) => btn(cmd, `${icone}<span>${nome}</span>`, titulo, "txt", menu);
const grupo = (nome: string, corpo: string) => `<div class="ppr-grupo"><div class="ppr-corpo">${corpo}</div><div class="ppr-rotulo">${nome}</div></div>`;

const ABAS = [
  { id: "inicio", nome: "Página Inicial" },
  { id: "inserir", nome: "Inserir" },
  { id: "formato", nome: "Formato da Forma" },
  { id: "tabela", nome: "Layout da Tabela" },
  { id: "design", nome: "Design" },
  { id: "exibir", nome: "Exibir" },
];

const LAYOUTS: [SlideLayout, string][] = ORDEM_LAYOUTS.map((id) => [id, ROTULOS_LAYOUT[id]]);

const ESTILOS_RAPIDOS: { nome: string; cmd: string }[] = [
  { nome: "Destaque cheio", cmd: "estilo:cheio" },
  { nome: "Só contorno", cmd: "estilo:contorno" },
  { nome: "Gradiente", cmd: "estilo:gradiente" },
  { nome: "Cartão branco com sombra", cmd: "estilo:cartao" },
  { nome: "Escuro", cmd: "estilo:escuro" },
  { nome: "Suave", cmd: "estilo:suave" },
];

export class Fita {
  readonly el: HTMLElement;
  private aba = "inicio";

  constructor(host: HTMLElement, private hooks: HooksFita) {
    this.el = host;
    host.innerHTML = `
      <div class="ppr-abas" role="tablist">
        ${ABAS.map((a) => `<button type="button" class="ppr-aba${a.id === "inicio" ? " on" : ""}" role="tab" data-aba="${a.id}"${a.id === "formato" || a.id === "tabela" ? " hidden" : ""}>${a.nome}</button>`).join("")}
        <span class="ppr-enche"></span>
        <button type="button" class="ppr-aba ppr-cfg" data-cmd="configure" title="Configurar apresentação">${ic("i-gear")}<span>Configurar</span></button>
      </div>
      <div class="ppr-paineis">
        <div class="ppr-painel" data-painel="inicio">${this.inicio()}</div>
        <div class="ppr-painel" data-painel="inserir" hidden>${this.inserir()}</div>
        <div class="ppr-painel" data-painel="formato" hidden>${this.formato()}</div>
        <div class="ppr-painel" data-painel="tabela" hidden>${this.tabela()}</div>
        <div class="ppr-painel" data-painel="design" hidden>${this.design()}</div>
        <div class="ppr-painel" data-painel="exibir" hidden>${this.exibir()}</div>
      </div>`;

    // os botões da fita não roubam o foco (a seleção do texto precisa continuar viva)
    host.addEventListener("mousedown", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("button") && !t.closest("select, input")) e.preventDefault();
    });
    host.addEventListener("click", (e) => this.aoClicar(e));
    host.addEventListener("change", (e) => this.aoMudar(e));
    host.addEventListener("keydown", (e) => {
      const t = e.target as HTMLElement;
      if (e.key === "Enter" && t.matches("input[data-in]")) (t as HTMLInputElement).blur();
    });
  }

  // ------------------------------------------------------------------
  // conteúdo das abas
  // ------------------------------------------------------------------

  private inicio(): string {
    return [
      grupo(
        "Área de Transferência",
        `${grande("colar", ic("i-paste"), "Colar", "Colar (Ctrl+V)")}
         <div class="ppr-col">
           ${pequeno("recortar", ic("i-cut"), "Recortar", "Recortar (Ctrl+X)")}
           ${pequeno("copiar", ic("i-copy"), "Copiar", "Copiar (Ctrl+C)")}
           ${pequeno("duplicar", ic("i-dup"), "Duplicar", "Duplicar a forma (Ctrl+D)")}
         </div>
         <div class="ppr-col">
           ${pequeno("desfazer", ic("i-undo"), "Desfazer", "Desfazer (Ctrl+Z)")}
           ${pequeno("refazer", ic("i-redo"), "Refazer", "Refazer (Ctrl+Y)")}
         </div>`
      ),
      grupo(
        "Lâminas",
        `${grande("slide-novo", ic("i-plus"), "Nova lâmina", "Nova lâmina depois da atual: escolha o layout", true)}
         <div class="ppr-col">
           ${pequeno("layout", ic("i-columns"), "Layout", "Layout da lâmina", true)}
           ${pequeno("slide-dup", ic("i-dup"), "Duplicar", "Duplicar lâmina")}
           ${pequeno("slide-del", ic("i-trash"), "Excluir", "Excluir lâmina")}
         </div>`
      ),
      grupo(
        "Fonte",
        `<div class="ppr-linhas">
           <div class="ppr-linha">
             <select class="ppr-sel fonte" data-sel="font" title="Fonte" aria-label="Fonte"></select>
             <select class="ppr-sel tam" data-sel="size" title="Tamanho da fonte" aria-label="Tamanho da fonte"></select>
             ${btn("maior", "A<sup>▲</sup>", "Aumentar fonte (Ctrl+Shift+>)", "fmt")}
             ${btn("menor", "A<sup>▼</sup>", "Diminuir fonte (Ctrl+Shift+<)", "fmt")}
           </div>
           <div class="ppr-linha">
             ${btn("negrito", "<b>N</b>", "Negrito (Ctrl+B)", "fmt")}
             ${btn("italico", "<i>I</i>", "Itálico (Ctrl+I)", "fmt")}
             ${btn("sublinhado", "<u>S</u>", "Sublinhado (Ctrl+U)", "fmt")}
             ${btn("tachado", "<s>ab</s>", "Tachado", "fmt")}
             ${btn("cor-texto", `<span class="ppr-a">A</span><span class="ppr-barra" data-barra="cor-texto"></span>`, "Cor da fonte", "fmt cor", true)}
           </div>
         </div>`
      ),
      grupo(
        "Parágrafo",
        `<div class="ppr-linhas">
           <div class="ppr-linha">
             ${btn("marcadores", ic("i-list"), "Marcadores", "fmt")}
             ${btn("numeracao", ic("i-list-num"), "Numeração", "fmt")}
             ${btn("recuo-menos", ic("i-outdent"), "Diminuir recuo", "fmt")}
             ${btn("recuo-mais", ic("i-indent"), "Aumentar recuo", "fmt")}
             ${btn("espaco", ic("i-line-spacing"), "Espaçamento entre linhas", "fmt", true)}
           </div>
           <div class="ppr-linha">
             ${btn("alinhar-esquerda", ic("i-align-left"), "Alinhar à esquerda (Ctrl+L)", "fmt")}
             ${btn("alinhar-centro", ic("i-align-center"), "Centralizar (Ctrl+E)", "fmt")}
             ${btn("alinhar-direita", ic("i-align-right"), "Alinhar à direita (Ctrl+R)", "fmt")}
             ${btn("alinhar-justificado", ic("i-align-justify"), "Justificar (Ctrl+J)", "fmt")}
             <span class="ppr-sep"></span>
             ${btn("v-topo", `<span class="ppr-v">⤒</span>`, "Alinhar o texto ao topo", "fmt")}
             ${btn("v-meio", `<span class="ppr-v">↕</span>`, "Centralizar o texto na vertical", "fmt")}
             ${btn("v-base", `<span class="ppr-v">⤓</span>`, "Alinhar o texto à base", "fmt")}
           </div>
         </div>`
      ),
      grupo(
        "Desenho",
        `${grande("galeria", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[6], 30)}</span>`, "Formas", "Inserir uma forma", true)}
         <div class="ppr-col">
           ${pequeno("preench", ic("i-bucket"), "Preenchimento", "Preenchimento da forma", true)}
           ${pequeno("contorno", ic("i-border"), "Contorno", "Contorno da forma", true)}
           ${pequeno("sombra", `<span class="ppr-sombra-ic"></span>`, "Efeitos", "Sombra e efeitos", true)}
         </div>
         <div class="ppr-col">
           ${pequeno("ordem", `<span class="ppr-seta">⧉</span>`, "Organizar", "Ordem, alinhamento, grupo e giro", true)}
         </div>`
      ),
      grupo("Edição", `<div class="ppr-col">${pequeno("sel-tudo", `<span class="ppr-seta">▦</span>`, "Selecionar tudo", "Selecionar todas as formas (Ctrl+A)")}</div>`),
    ].join("");
  }

  private inserir(): string {
    return [
      grupo("Lâminas", `${grande("slide-novo", ic("i-plus"), "Nova lâmina", "Nova lâmina depois da atual: escolha o layout", true)}`),
      grupo("Tabelas", `${grande("tabela-grade", ic("i-grid"), "Tabela", "Inserir uma tabela", true)}`),
      grupo(
        "Texto",
        `${grande("ferramenta:texto", ic("i-doc"), "Caixa de texto", "Desenhe uma caixa de texto na lâmina")}`
      ),
      grupo(
        "Ilustrações",
        `${grande("galeria", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[7], 30)}</span>`, "Formas", "Escolha uma forma e desenhe na lâmina", true)}
         ${grande("image", ic("i-image"), "Imagem", "Inserir imagem do computador")}`
      ),
      grupo(
        "Linhas",
        `<div class="ppr-col">
           ${pequeno("forma-rapida:0", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[0], 18)}</span>`, "Linha", "Desenhar uma linha")}
           ${pequeno("forma-rapida:1", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[1], 18)}</span>`, "Seta", "Desenhar uma seta")}
           ${pequeno("forma-rapida:3", `<span class="ppr-gal-ic">${iconeDeForma(GALERIA[3], 18)}</span>`, "Conector", "Desenhar um conector angular")}
         </div>`
      ),
    ].join("");
  }

  private tabela(): string {
    return [
      grupo(
        "Linhas e Colunas",
        `<div class="ppr-col">
           ${pequeno("tabela-linha-acima", ic("i-table-row-add"), "Inserir acima", "Inserir linha acima")}
           ${pequeno("tabela-linha-abaixo", ic("i-table-row-add"), "Inserir abaixo", "Inserir linha abaixo")}
           ${pequeno("tabela-del-linha", ic("i-table-row-del"), "Excluir linha", "Excluir as linhas escolhidas")}
         </div>
         <div class="ppr-col">
           ${pequeno("tabela-col-esquerda", ic("i-table-col-add"), "Inserir à esquerda", "Inserir coluna à esquerda")}
           ${pequeno("tabela-col-direita", ic("i-table-col-add"), "Inserir à direita", "Inserir coluna à direita")}
           ${pequeno("tabela-del-coluna", ic("i-table-col-del"), "Excluir coluna", "Excluir as colunas escolhidas")}
         </div>`
      ),
      grupo(
        "Mesclar",
        `<div class="ppr-col">
           ${pequeno("tabela-mesclar", ic("i-table-merge"), "Mesclar células", "Juntar as células escolhidas em uma")}
           ${pequeno("tabela-dividir", ic("i-table-split"), "Dividir célula", "Desfazer a mesclagem")}
         </div>`
      ),
      grupo(
        "Estilos de Tabela",
        `<div class="ppr-col">
           ${pequeno("tabela-estilos", "", "Estilos", "Estilos prontos de tabela", true)}
           ${pequeno("tabela-bordas-menu", ic("i-border"), "Bordas", "Bordas das células escolhidas", true)}
           ${pequeno("preench", ic("i-bucket"), "Sombreamento", "Cor de fundo das células escolhidas", true)}
         </div>
         <div class="ppr-col">
           <label class="ppr-opc"><input type="checkbox" data-opc="cabecalho"> Linha de cabeçalho</label>
           <label class="ppr-opc"><input type="checkbox" data-opc="faixas"> Linhas em faixas</label>
           <label class="ppr-opc"><input type="checkbox" data-opc="primeiraColuna"> Primeira coluna</label>
         </div>`
      ),
      grupo(
        "Alinhamento",
        `<div class="ppr-col">
           ${pequeno("v-topo", "", "Alinhar em cima", "Alinhar o texto ao topo da célula")}
           ${pequeno("v-meio", "", "Centralizar", "Centralizar o texto verticalmente")}
           ${pequeno("v-base", "", "Alinhar embaixo", "Alinhar o texto à base da célula")}
         </div>`
      ),
      grupo("Tabela", `${grande("tabela-excluir", ic("i-trash"), "Excluir tabela", "Excluir a tabela inteira")}`),
    ].join("");
  }

  private formato(): string {
    return [
      grupo(
        "Estilos de Forma",
        `<div class="ppr-estilos">${ESTILOS_RAPIDOS.map((e) => `<button type="button" class="ppr-estilo" data-cmd="${e.cmd}" title="${e.nome}" aria-label="${e.nome}"><span class="ppr-estilo-${e.cmd.slice(7)}"></span></button>`).join("")}</div>`
      ),
      grupo(
        "Preenchimento e Contorno",
        `<div class="ppr-col">
           ${pequeno("preench", ic("i-bucket"), "Preenchimento", "Preenchimento da forma", true)}
           ${pequeno("contorno", ic("i-border"), "Contorno", "Contorno da forma", true)}
           ${pequeno("sombra", `<span class="ppr-sombra-ic"></span>`, "Efeitos", "Sombra e efeitos", true)}
         </div>`
      ),
      grupo(
        "Organizar",
        `<div class="ppr-col">
           ${pequeno("z-topo", `<span class="ppr-seta">⤒</span>`, "Trazer para a frente", "Trazer para a frente de tudo")}
           ${pequeno("z-fundo", `<span class="ppr-seta">⤓</span>`, "Enviar para trás", "Enviar para trás de tudo")}
           ${pequeno("agrupar", `<span class="ppr-seta">⧈</span>`, "Agrupar", "Agrupar (Ctrl+G)")}
         </div>
         <div class="ppr-col">
           ${pequeno("z-frente", `<span class="ppr-seta">▲</span>`, "Avançar", "Subir uma camada")}
           ${pequeno("z-tras", `<span class="ppr-seta">▼</span>`, "Recuar", "Descer uma camada")}
           ${pequeno("desagrupar", `<span class="ppr-seta">⧉</span>`, "Desagrupar", "Desagrupar (Ctrl+Shift+G)")}
         </div>
         <div class="ppr-col">
           ${pequeno("ordem", `<span class="ppr-seta">⇄</span>`, "Alinhar e girar", "Alinhar, distribuir, girar e espelhar", true)}
         </div>`
      ),
      grupo(
        "Tamanho",
        `<div class="ppr-linhas">
           <label class="ppr-medida">Altura <input type="number" step="0.1" min="0.1" data-in="altura" aria-label="Altura em cm"> cm</label>
           <label class="ppr-medida">Largura <input type="number" step="0.1" min="0.1" data-in="largura" aria-label="Largura em cm"> cm</label>
         </div>`
      ),
    ].join("");
  }

  private design(): string {
    return [
      grupo(
        "Tema",
        `<div class="ppr-linha">
           ${btn("theme:claro", "◐", "Tema claro", "fmt")}
           ${btn("theme:escuro", "◑", "Tema escuro", "fmt")}
           ${btn("theme:contraste", "◕", "Alto contraste", "fmt")}
         </div>`
      ),
      grupo("Personalizar", `${grande("fundo", ic("i-bucket"), "Formatar fundo", "Cor, gradiente ou imagem de fundo da lâmina", true)}${grande("configure", ic("i-gear"), "Tamanho", "Proporção e tamanho da lâmina")}`),
      grupo("Layout", `${grande("layout", ic("i-columns"), "Layout", "Layout da lâmina", true)}`),
    ].join("");
  }

  private exibir(): string {
    return [
      grupo(
        "Apresentar",
        `${grande("present", ic("i-eye"), "Apresentar", "Modo apresentação (F5)")}${grande("notes", ic("i-doc"), "Notas", "Focar o painel de notas")}`
      ),
      grupo(
        "Zoom",
        `<div class="ppr-linha">
           ${btn("zoom-out", "−", "Reduzir zoom", "fmt")}
           <span class="ppr-zoom" data-zoomtxt>100%</span>
           ${btn("zoom-in", "+", "Ampliar zoom", "fmt")}
           ${btn("zoom-reset", "100%", "Zoom normal", "fmt")}
         </div>`
      ),
      grupo(
        "Mostrar",
        `<div class="ppr-col">
           ${pequeno("painel-lateral", ic("i-sidebar"), "Painel Formatar", "Mostrar ou esconder o painel Formatar/Notas (à direita)")}
           ${pequeno("alt-faixa", ic("i-columns"), "Faixa vertical", "Mostrar a faixa de lâminas na lateral (vertical) ou de volta no topo (horizontal)")}
           ${pequeno("alt-encaixe", `<span class="ppr-seta">✓</span>`, "Guias de encaixe", "Ligar/desligar o encaixe nas guias")}
         </div>
         <div class="ppr-col">
           ${pequeno("alt-grade", `<span class="ppr-seta">▦</span>`, "Grade", "Mostrar a grade")}
           ${pequeno("alt-fixas", `<span class="ppr-seta">✎</span>`, "Editar elementos do layout", "Permite selecionar e mexer nas decorações que vêm do layout")}
         </div>`
      ),
    ].join("");
  }

  // ------------------------------------------------------------------
  // eventos
  // ------------------------------------------------------------------

  private irParaAba(id: string): void {
    this.aba = id;
    for (const b of this.el.querySelectorAll<HTMLElement>("[data-aba]")) b.classList.toggle("on", b.dataset.aba === id);
    for (const p of this.el.querySelectorAll<HTMLElement>("[data-painel]")) p.hidden = p.dataset.painel !== id;
    this.atualizar();
  }

  private aoClicar(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    const aba = t.closest<HTMLElement>("[data-aba]");
    if (aba) {
      this.irParaAba(aba.dataset.aba!);
      return;
    }
    const b = t.closest<HTMLElement>("[data-cmd]");
    if (!b || (b as HTMLButtonElement).disabled) return;
    const cmd = b.dataset.cmd!;
    if (b.dataset.menu) {
      this.abrirMenu(cmd, b);
      return;
    }
    fecharPopup();
    if (cmd.startsWith("theme:")) this.hooks.run("theme", cmd.slice(6));
    else if (cmd.startsWith("layout:")) this.hooks.run("layout", cmd.slice(7));
    else if (cmd.startsWith("forma-rapida:")) this.hooks.run("forma-inserir", cmd.slice(13));
    else if (cmd.startsWith("ferramenta:")) this.hooks.run("ferramenta", cmd.slice(11));
    else if (cmd.startsWith("estilo:")) this.hooks.run("estilo", cmd.slice(7));
    else this.hooks.run(cmd);
  }

  private aoMudar(e: Event): void {
    const t = e.target as HTMLElement;
    const opc = t.closest<HTMLInputElement>("input[data-opc]");
    if (opc) {
      const k = opc.dataset.opc!;
      this.hooks.run(k === "cabecalho" ? "tabela-cabecalho" : k === "faixas" ? "tabela-faixas" : "tabela-primeira-coluna", opc.checked ? "1" : "0");
      this.hooks.run("tabela-reaplicar");
      return;
    }
    const sel = t.closest<HTMLSelectElement>("[data-sel]");
    if (sel) {
      this.hooks.run(sel.dataset.sel === "font" ? "fonte" : "tamanho", sel.value);
      return;
    }
    const inp = t.closest<HTMLInputElement>("input[data-in]");
    if (inp) {
      const v = parseFloat(inp.value.replace(",", "."));
      if (Number.isFinite(v) && v > 0) this.hooks.run(inp.dataset.in === "altura" ? "tamanho-h" : "tamanho-w", String(cmParaPt(v)));
    }
  }

  private abrirMenu(cmd: string, ancora: HTMLElement): void {
    const est = this.hooks.estado();
    const run = (c: string, v?: string) => this.hooks.run(c, v);
    switch (cmd) {
      case "galeria":
        abrirGaleria(ancora, (item) => run("forma-inserir", String(GALERIA.indexOf(item))));
        return;
      case "tabela-grade": {
        const N = 8;
        let cel = "";
        for (let r = 1; r <= 6; r++) for (let c = 1; c <= N; c++) cel += `<span class="pp-tg" data-tg="${r},${c}"></span>`;
        const el = abrirPopup(ancora, `<div class="pp-tg-rot">Inserir tabela</div><div class="pp-tg-grade" style="grid-template-columns:repeat(${N},16px)">${cel}</div>`, { classe: "pp-pop-menu" });
        const rot = el.querySelector<HTMLElement>(".pp-tg-rot")!;
        el.addEventListener("mouseover", (ev) => {
          const t = (ev.target as HTMLElement).closest<HTMLElement>("[data-tg]");
          if (!t) return;
          const [rr, cc] = t.dataset.tg!.split(",").map(Number);
          el.querySelectorAll<HTMLElement>("[data-tg]").forEach((x) => {
            const [r, c] = x.dataset.tg!.split(",").map(Number);
            x.classList.toggle("on", r <= rr && c <= cc);
          });
          rot.textContent = `${rr} × ${cc} (linhas × colunas)`;
        });
        el.addEventListener("click", (ev) => {
          const t = (ev.target as HTMLElement).closest<HTMLElement>("[data-tg]");
          if (!t) return;
          fecharPopup();
          run("tabela-inserir", t.dataset.tg);
        });
        return;
      }
      case "tabela-estilos": {
        const el = abrirPopup(ancora, (Object.keys(ROTULOS_PRESET) as PresetTabela[]).map((k) => `<button type="button" class="pp-pop-item" data-preset="${k}">${ROTULOS_PRESET[k]}</button>`).join(""), { classe: "pp-pop-menu" });
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-preset]");
          if (!b) return;
          fecharPopup();
          run("tabela-preset", b.dataset.preset);
        });
        return;
      }
      // "Nova lâmina" pergunta QUAL layout a lâmina nova deve ter. Sem este
      // menu o botão ficava sem efeito nenhum (ele é um botão de menu).
      case "slide-novo": {
        const el = abrirPopup(
          ancora,
          `<div class="pp-pop-rot">Nova lâmina</div>` +
            LAYOUTS.map(([id, nome]) => `<button type="button" class="pp-pop-item" data-lay="${id}">${nome}</button>`).join(""),
          { classe: "pp-pop-menu" }
        );
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-lay]");
          if (!b) return;
          fecharPopup();
          run("slide-new", b.dataset.lay);
        });
        return;
      }
      case "tabela-bordas-menu": {
        const itens: [string, string][] = [["todas", "Todas as bordas"], ["externas", "Bordas externas"], ["internas", "Bordas internas"], ["topo", "Borda superior"], ["base", "Borda inferior"], ["esquerda", "Borda esquerda"], ["direita", "Borda direita"], ["nenhuma", "Sem borda"]];
        const el = abrirPopup(ancora, itens.map(([k, n]) => `<button type="button" class="pp-pop-item" data-borda="${k}">${n}</button>`).join(""), { classe: "pp-pop-menu" });
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-borda]");
          if (!b) return;
          fecharPopup();
          run("tabela-bordas", `${b.dataset.borda}|1C212B|1`);
        });
        return;
      }
      case "cor-texto":
        abrirCores(ancora, { atual: est.trecho && est.trecho.color !== "misto" ? est.trecho.color : null, paleta: est.paleta, titulo: "Cor da fonte" }, (c) => {
          if (c) run("cor-texto", c);
        });
        return;
      case "preench":
        this.menuPreenchimento(ancora);
        return;
      case "contorno":
        this.menuContorno(ancora);
        return;
      case "sombra": {
        const el = abrirPopup(
          ancora,
          `${SOMBRAS_PRONTAS.map((s, i) => `<button type="button" class="pp-pop-item" data-sombra="${i}"><span class="ppr-sombra-previa" style="${s.sombra ? `box-shadow:${Math.round(s.sombra.dist * Math.cos((s.sombra.dir * Math.PI) / 180))}px ${Math.round(s.sombra.dist * Math.sin((s.sombra.dir * Math.PI) / 180))}px ${Math.round(s.sombra.blur / 2)}px #${s.sombra.color}${Math.round(s.sombra.alpha * 255).toString(16).padStart(2, "0")}` : ""}"></span>${s.nome}</button>`).join("")}`,
          { classe: "pp-pop-menu" }
        );
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-sombra]");
          if (!b) return;
          fecharPopup();
          run("sombra-pronta", b.dataset.sombra);
        });
        return;
      }
      case "slide-novo": {
        const el = abrirPopup(ancora, LAYOUTS.map(([id, n]) => `<button type="button" class="pp-pop-item" data-novo="${id}">${n}</button>`).join(""), { classe: "pp-pop-menu" });
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-novo]");
          if (!b) return;
          fecharPopup();
          run("slide-new", b.dataset.novo);
        });
        return;
      }
      case "layout": {
        const el = abrirPopup(ancora, LAYOUTS.map(([id, n]) => `<button type="button" class="pp-pop-item${est.layout === id ? " on" : ""}" data-layout="${id}">${n}</button>`).join(""), { classe: "pp-pop-menu" });
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-layout]");
          if (!b) return;
          fecharPopup();
          run("layout", b.dataset.layout);
        });
        return;
      }
      case "espaco": {
        const opcoes = [1, 1.15, 1.5, 2, 2.5, 3];
        const el = abrirPopup(ancora, opcoes.map((o) => `<button type="button" class="pp-pop-item" data-esp="${o}">${String(o).replace(".", ",")}</button>`).join(""), { classe: "pp-pop-menu" });
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-esp]");
          if (!b) return;
          fecharPopup();
          run("entrelinha", b.dataset.esp);
        });
        return;
      }
      case "ordem": {
        const itens: [string, string][] = [
          ["z-topo", "Trazer para a frente"], ["z-frente", "Avançar"], ["z-tras", "Recuar"], ["z-fundo", "Enviar para trás"],
          ["agrupar", "Agrupar"], ["desagrupar", "Desagrupar"],
          ["al-esquerda", "Alinhar à esquerda"], ["al-centro", "Centralizar na horizontal"], ["al-direita", "Alinhar à direita"],
          ["al-topo", "Alinhar ao topo"], ["al-meio", "Centralizar na vertical"], ["al-base", "Alinhar embaixo"],
          ["dist-h", "Distribuir na horizontal"], ["dist-v", "Distribuir na vertical"],
          ["girar-90", "Girar 90° à direita"], ["girar--90", "Girar 90° à esquerda"], ["espelhar-h", "Espelhar na horizontal"], ["espelhar-v", "Espelhar na vertical"],
          ["igualar-largura", "Mesma largura"], ["igualar-altura", "Mesma altura"],
          ["bloquear", "Bloquear / desbloquear"],
        ];
        const el = abrirPopup(ancora, itens.map(([c, n]) => `<button type="button" class="pp-pop-item" data-o="${c}">${n}</button>`).join(""), { classe: "pp-pop-menu" });
        el.addEventListener("click", (ev) => {
          const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-o]");
          if (!b) return;
          fecharPopup();
          const c = b.dataset.o!;
          if (c.startsWith("girar-")) run("girar", c.slice(6));
          else if (c.startsWith("al-")) run("alinhar", c.slice(3));
          else if (c.startsWith("dist-")) run("distribuir", c.slice(5));
          else if (c.startsWith("espelhar-")) run("espelhar", c.slice(9));
          else if (c.startsWith("igualar-")) run("igualar", c.slice(8));
          else run(c);
        });
        return;
      }
      case "fundo":
        this.menuFundo(ancora);
        return;
    }
  }

  private menuPreenchimento(ancora: HTMLElement): void {
    const est = this.hooks.estado();
    const f = est.forma?.fillX;
    abrirCores(
      ancora,
      {
        atual: f?.kind === "solid" ? f.color : null,
        paleta: est.paleta,
        semCor: "Sem preenchimento",
        titulo: "Preenchimento",
        extra: `<div class="pp-pop-t">Gradiente</div>
          <div class="pp-gradientes">
            ${["cima", "baixo", "esquerda", "direita", "diagonal", "radial"].map((g) => `<button type="button" class="pp-grad" data-extra="grad:${g}" title="Gradiente ${g}"><span class="g-${g}"></span></button>`).join("")}
          </div>
          <button type="button" class="pp-pop-item" data-extra="imagem">Imagem do computador…</button>`,
      },
      (c) => this.hooks.run("preench", c ?? "none"),
      (x) => this.hooks.run(x.startsWith("grad:") ? "gradiente" : x === "imagem" ? "preench-imagem" : x, x.startsWith("grad:") ? x.slice(5) : undefined)
    );
  }

  private menuContorno(ancora: HTMLElement): void {
    const est = this.hooks.estado();
    const l = est.forma?.ln;
    const espessuras = [0.25, 0.5, 0.75, 1, 1.5, 2.25, 3, 4.5, 6];
    const tracos: [string, string][] = [["solid", "Contínuo"], ["dash", "Tracejado"], ["dot", "Pontilhado"], ["dashDot", "Traço e ponto"], ["lgDash", "Traço longo"]];
    const pontas: [string, string][] = [["", "Nenhuma"], ["triangle", "Triângulo"], ["arrow", "Seta aberta"], ["stealth", "Seta fina"], ["diamond", "Losango"], ["oval", "Círculo"]];
    abrirCores(
      ancora,
      {
        atual: l?.color ?? null,
        paleta: est.paleta,
        semCor: "Sem contorno",
        titulo: "Contorno",
        extra: `<div class="pp-pop-t">Espessura</div>
          <div class="pp-linhas-op">${espessuras.map((w) => `<button type="button" class="pp-op${l?.w === w ? " on" : ""}" data-extra="espessura:${w}"><span style="height:${Math.max(1, w)}px"></span>${String(w).replace(".", ",")} pt</button>`).join("")}</div>
          <div class="pp-pop-t">Tipo de traço</div>
          <div class="pp-linhas-op">${tracos.map(([v, n]) => `<button type="button" class="pp-op${(l?.dash ?? "solid") === v ? " on" : ""}" data-extra="traco:${v}">${n}</button>`).join("")}</div>
          <div class="pp-pop-t">Ponta inicial / final</div>
          <div class="pp-linhas-op">${pontas.map(([v, n]) => `<button type="button" class="pp-op" data-extra="ponta-ini:${v}">⟵ ${n}</button>`).join("")}</div>
          <div class="pp-linhas-op">${pontas.map(([v, n]) => `<button type="button" class="pp-op" data-extra="ponta-fim:${v}">${n} ⟶</button>`).join("")}</div>`,
      },
      (c) => this.hooks.run("contorno", c ?? "none"),
      (x) => {
        const i = x.indexOf(":");
        this.hooks.run(x.slice(0, i), x.slice(i + 1));
      }
    );
  }

  private menuFundo(ancora: HTMLElement): void {
    const est = this.hooks.estado();
    const f = est.bg;
    abrirCores(
      ancora,
      {
        atual: f?.kind === "solid" ? f.color : null,
        paleta: est.paleta,
        semCor: "Restaurar o fundo do tema",
        titulo: "Fundo da lâmina",
        extra: `<div class="pp-pop-t">Gradiente</div>
          <div class="pp-gradientes">
            ${["cima", "baixo", "esquerda", "direita", "diagonal", "radial"].map((g) => `<button type="button" class="pp-grad" data-extra="fundo-grad:${g}" title="Gradiente ${g}"><span class="g-${g}"></span></button>`).join("")}
          </div>
          <button type="button" class="pp-pop-item" data-extra="fundo-imagem:">Imagem do computador…</button>
          <button type="button" class="pp-pop-item" data-extra="fundo-todas:">Aplicar este fundo a todas as lâminas</button>`,
      },
      (c) => this.hooks.run("fundo-cor", c ?? "tema"),
      (x) => {
        const i = x.indexOf(":");
        this.hooks.run(x.slice(0, i), x.slice(i + 1));
      }
    );
  }

  // ------------------------------------------------------------------
  // estado dos botões
  // ------------------------------------------------------------------

  /** A aba "Formato da Forma" aparece quando há forma selecionada. */
  atualizar(): void {
    const st = this.hooks.estado();
    const tem = st.formas.length > 0;
    const abaFormato = this.el.querySelector<HTMLElement>('[data-aba="formato"]');
    if (abaFormato) {
      abaFormato.hidden = !tem;
      if (!tem && this.aba === "formato") this.irParaAba("inicio");
    }
    const abaTab = this.el.querySelector<HTMLElement>('[data-aba="tabela"]');
    const temTab = !!st.forma?.tabela;
    if (abaTab) {
      if (abaTab.hidden === temTab) {
        abaTab.hidden = !temTab;
        if (temTab && this.aba !== "tabela") this.irParaAba("tabela");
      }
      if (!temTab && this.aba === "tabela") this.irParaAba("inicio");
    }
    if (st.forma?.tabela) {
      for (const k of ["cabecalho", "faixas", "primeiraColuna"] as const) {
        const i = this.el.querySelector<HTMLInputElement>(`input[data-opc="${k}"]`);
        if (i) i.checked = !!st.forma.tabela[k];
      }
    }
    const on = (cmd: string, v: boolean) => {
      for (const b of this.el.querySelectorAll<HTMLElement>(`[data-cmd="${cmd}"]`)) b.classList.toggle("on", v);
    };
    const dis = (cmd: string, d: boolean) => {
      for (const b of this.el.querySelectorAll<HTMLButtonElement>(`[data-cmd="${cmd}"]`)) b.disabled = d;
    };
    const t = st.trecho;
    const temTexto = !!st.forma && (st.forma.paras !== undefined || !!st.forma.tabela);
    on("negrito", t?.bold === true);
    on("italico", t?.italic === true);
    on("sublinhado", t?.underline === true);
    on("tachado", t?.strike === true);
    const al = st.paragrafo?.align;
    on("alinhar-esquerda", al === "esquerda");
    on("alinhar-centro", al === "centro");
    on("alinhar-direita", al === "direita");
    on("alinhar-justificado", al === "justificado");
    const an = st.forma?.anchor ?? "t";
    on("v-topo", temTexto && an === "t");
    on("v-meio", temTexto && an === "ctr");
    on("v-base", temTexto && an === "b");
    on("marcadores", !!st.paragrafo?.bullet?.char);
    on("numeracao", !!st.paragrafo?.bullet?.auto);
    on("alt-encaixe", st.encaixe);
    on("alt-grade", st.grade);
    on("alt-fixas", st.fixas);
    on("alt-faixa", st.faixaVertical);
    on("ferramenta:texto", st.ferramenta?.tipo === "texto");
    for (const c of ["negrito", "italico", "sublinhado", "tachado", "maior", "menor", "cor-texto", "marcadores", "numeracao", "recuo-menos", "recuo-mais", "espaco", "alinhar-esquerda", "alinhar-centro", "alinhar-direita", "alinhar-justificado", "v-topo", "v-meio", "v-base"]) dis(c, !temTexto);
    dis("desfazer", !st.podeDesfazer);
    dis("refazer", !st.podeRefazer);
    dis("colar", !st.temCopia);
    dis("recortar", !tem);
    dis("copiar", !tem);
    dis("duplicar", !tem);
    dis("agrupar", st.formas.length < 2);
    dis("desagrupar", !st.temGrupo);
    dis("slide-del", st.total <= 1);
    for (const c of ["preench", "contorno", "sombra", "ordem", "z-topo", "z-fundo", "z-frente", "z-tras"]) dis(c, !tem);
    for (const b of this.el.querySelectorAll<HTMLElement>("[data-layout]")) b.classList.toggle("on", b.dataset.layout === st.layout);

    // seletores de fonte e tamanho
    const selFonte = this.el.querySelector<HTMLSelectElement>('[data-sel="font"]');
    if (selFonte) {
      const atual = t && t.font !== "misto" ? t.font : "";
      const lista = [...new Set([...(atual ? [atual] : []), ...st.fontes, ...FONTES_COMUNS])];
      const sig = lista.join("|") + "#" + atual;
      if (selFonte.dataset.sig !== sig) {
        selFonte.innerHTML = (atual ? "" : `<option value="" selected></option>`) + lista.map((f) => `<option value="${f}"${f === atual ? " selected" : ""} style="font-family:'${f}'">${f}</option>`).join("");
        selFonte.dataset.sig = sig;
      }
      selFonte.disabled = !temTexto;
    }
    const selTam = this.el.querySelector<HTMLSelectElement>('[data-sel="size"]');
    if (selTam) {
      const atual = t && t.size !== "misto" ? t.size : 0;
      const lista = [...new Set([...(atual ? [atual] : []), ...TAMANHOS])].sort((a, b) => a - b);
      const sig = lista.join("|") + "#" + atual;
      if (selTam.dataset.sig !== sig) {
        selTam.innerHTML = (atual ? "" : `<option value="" selected></option>`) + lista.map((s) => `<option value="${s}"${s === atual ? " selected" : ""}>${String(s).replace(".", ",")}</option>`).join("");
        selTam.dataset.sig = sig;
      }
      selTam.disabled = !temTexto;
    }
    // barra de cor
    const barra = this.el.querySelector<HTMLElement>('[data-barra="cor-texto"]');
    if (barra) barra.style.background = t && t.color !== "misto" ? `#${t.color}` : "var(--muted)";
    const z = this.el.querySelector<HTMLElement>("[data-zoomtxt]");
    if (z) z.textContent = `${st.zoom}%`;
    // tamanho em cm (se não está digitando nele)
    for (const [chave, v] of [["altura", st.altura], ["largura", st.largura]] as const) {
      const inp = this.el.querySelector<HTMLInputElement>(`input[data-in="${chave}"]`);
      if (inp && document.activeElement !== inp) {
        inp.value = tem ? String(ptParaCm(v)) : "";
        inp.disabled = !tem;
      }
    }
  }
}
