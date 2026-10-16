// Painel "Formatar" (à direita): tudo que a fita não cabe, com números exatos — preenchimento (sólido, gradiente com
// paradas, imagem), contorno, sombra, cantos, tamanho e posição em cm, rotação, texto, recorte de imagem e fundo da lâmina.
import { AJUSTES_POR_GEOM, CANTOS, CANTO_ROTULO, cantosDe, raioDeCanto, representacaoDeCantos, type Canto } from "../edicao/formato";
import { FAMILIAS, FAMILIAS_ORDEM, INTENSIDADES, rampaDeTons } from "../edicao/estilos";
import { GRAFICO_TIPOS, paletaDeSeries } from "../edicao/grafico";
import { MIDIA_ROTULOS } from "../edicao/midia";
import { ORDEM_LAYOUTS, ROTULOS_LAYOUT } from "../edicao/layouts";
import type { EstiloForma, Fill, Line, Shadow, Shape } from "../schema";
import { abrirCores } from "./cores";
import { cmParaPt, ptParaCm, type EstadoUI } from "./estado";
import { melhorarSelects, fecharSeletor } from "../../seletor";

export interface HooksPainel {
  estado: () => EstadoUI;
  run: (cmd: string, valor?: string) => void;
}

const n1 = (v: number) => String(Math.round(v * 100) / 100);

/** Texto para dentro de um atributo HTML (nomes de série, categorias e título do gráfico). */
const escAttr = (t: string) =>
  String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const secao = (id: string, titulo: string, corpo: string, aberta = true) =>
  `<details class="pf-secao" data-sec="${id}"${aberta ? " open" : ""}><summary>${titulo}</summary><div class="pf-corpo">${corpo}</div></details>`;

const linhaNum = (rotulo: string, act: string, valor: number | "", passo: number, min: number | null, max: number | null, un = "") =>
  `<label class="pf-linha"><span>${rotulo}</span><span class="pf-campo"><input type="number" data-act="${act}" value="${valor === "" ? "" : n1(valor)}" step="${passo}"${min !== null ? ` min="${min}"` : ""}${max !== null ? ` max="${max}"` : ""}>${un ? `<small>${un}</small>` : ""}</span></label>`;

const linhaCor = (rotulo: string, act: string, cor: string | null) =>
  `<div class="pf-linha"><span>${rotulo}</span><span class="pf-campo"><button type="button" class="pf-cor" data-cor-act="${act}" title="Escolher cor" style="${cor ? `background:#${cor}` : ""}"${cor ? "" : ' data-vazio="1"'}></button><small>${cor ? "#" + cor : "—"}</small></span></div>`;

const linhaSel = (rotulo: string, act: string, valor: string, opcoes: [string, string][]) =>
  `<label class="pf-linha"><span>${rotulo}</span><span class="pf-campo"><select data-act="${act}">${opcoes.map(([v, n]) => `<option value="${v}"${v === valor ? " selected" : ""}>${n}</option>`).join("")}</select></span></label>`;

const linhaCheck = (rotulo: string, act: string, marcado: boolean) =>
  `<label class="pf-linha pf-check"><input type="checkbox" data-act="${act}"${marcado ? " checked" : ""}><span>${rotulo}</span></label>`;

const radios = (nome: string, act: string, atual: string, opcoes: [string, string][]) =>
  `<div class="pf-radios" role="radiogroup">${opcoes.map(([v, n]) => `<label><input type="radio" name="${nome}" data-act="${act}" value="${v}"${v === atual ? " checked" : ""}><span>${n}</span></label>`).join("")}</div>`;

export class Painel {
  private assinatura = "";

  constructor(private el: HTMLElement, private hooks: HooksPainel) {
    el.addEventListener("change", (e) => this.aoMudar(e));
    el.addEventListener("input", (e) => {
      // controles deslizantes e números aplicam enquanto arrastam; o resto só no "change"
      const t = e.target as HTMLInputElement;
      if (t.type === "range") this.disparar(t);
    });
    el.addEventListener("click", (e) => this.aoClicar(e));
    el.addEventListener("keydown", (e) => {
      const t = e.target as HTMLElement;
      if (e.key === "Enter" && t.matches("input[data-act]")) (t as HTMLInputElement).blur();
    });
  }

  private disparar(t: HTMLInputElement | HTMLSelectElement): void {
    const act = t.dataset.act!;
    if (t instanceof HTMLInputElement && t.type === "checkbox") this.hooks.run(act, t.checked ? "1" : "0");
    else this.hooks.run(act, t.value);
  }

  private aoMudar(e: Event): void {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (!t.dataset?.act) return;
    this.disparar(t);
  }

  private aoClicar(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    const cor = t.closest<HTMLElement>("[data-cor-act]");
    if (cor) {
      const est = this.hooks.estado();
      const act = cor.dataset.corAct!;
      abrirCores(
        cor,
        { atual: /^#?[0-9A-Fa-f]{6}$/.test(cor.nextElementSibling?.textContent ?? "") ? (cor.nextElementSibling!.textContent ?? "").replace("#", "") : null, paleta: est.paleta },
        (c) => {
          if (c) this.hooks.run(act, c);
        }
      );
      return;
    }
    const b = t.closest<HTMLElement>("[data-click]");
    if (b) this.hooks.run(b.dataset.click!, b.dataset.valor);
  }

  /** Redesenha o painel quando o que ele mostra mudou (sem atrapalhar quem está digitando num campo). */
  atualizar(): void {
    const est = this.hooks.estado();
    const sig = this.assinar(est);
    if (sig === this.assinatura) return;
    const ativo = document.activeElement;
    const digitando =
      ativo instanceof HTMLInputElement && ativo.type !== "checkbox" && ativo.type !== "radio" && ativo.type !== "range";
    // com a lista de um seletor aberta o redesenho mataria o controle embaixo dela: espera fechar
    const noSeletor = !!ativo?.closest(".sel-wrap");
    if (ativo && this.el.contains(ativo) && (digitando || noSeletor)) {
      // está digitando (ou escolhendo na lista): aplica quando sair do campo
      return;
    }
    this.assinatura = sig;
    const abertas = new Map<string, boolean>();
    for (const d of this.el.querySelectorAll<HTMLDetailsElement>("details[data-sec]")) abertas.set(d.dataset.sec!, d.open);
    fecharSeletor(this.el);
    this.el.innerHTML = this.html(est);
    melhorarSelects(this.el);
    for (const d of this.el.querySelectorAll<HTMLDetailsElement>("details[data-sec]")) {
      const a = abertas.get(d.dataset.sec!);
      if (a !== undefined) d.open = a;
    }
  }

  /**
   * O arrasto VIVO: atualiza só os números de tamanho/posição/rotação do painel.
   *
   * Refazer o painel inteiro a cada quadro do arrasto (innerHTML + os selects melhorados) custava
   * caro e não é o que muda: a caixa anda, o resto da seção fica igual. No fim do arrasto o
   * `atualizar()` refaz tudo (a assinatura ficou velha de propósito).
   */
  vivo(): void {
    const est = this.hooks.estado();
    const f = est.forma;
    if (!f || est.formas.length > 1) return;
    const d = { w: est.setup.widthIn ? est.setup.widthIn * 72 : 960, h: est.setup.heightIn ? est.setup.heightIn * 72 : 540 };
    const campos: [string, number][] = [
      ["pos-w", ptParaCm((f.box.w / 100) * d.w)],
      ["pos-h", ptParaCm((f.box.h / 100) * d.h)],
      ["pos-x", ptParaCm((f.box.x / 100) * d.w)],
      ["pos-y", ptParaCm((f.box.y / 100) * d.h)],
      ["rot", f.rot],
    ];
    for (const [act, valor] of campos) {
      const inp = this.el.querySelector<HTMLInputElement>(`input[data-act="${act}"]`);
      if (inp && document.activeElement !== inp) inp.value = String(Math.round(valor * 100) / 100);
    }
  }

  private assinar(est: EstadoUI): string {
    const f = est.forma;
    return JSON.stringify([
      est.formas.map((s) => [s.id, s.box, s.rot, s.fillX, s.ln, s.shadow, s.opacity, s.adj, s.cantos, s.anchor, s.ins, s.wrap, s.vert, s.crop, s.flipH, s.flipV, s.bloqueada, s.autofit, s.grafico, s.midia, s.src, s.estilo]),
      est.cantosSel,
      f ? f.geom : "",
      // o espaçamento de caracteres do painel segue o trecho escolhido no texto
      est.trecho && est.trecho.spc !== "misto" ? est.trecho.spc : null,
      est.formas.length ? "" : [est.bg, est.bgEstilo, est.layout, est.setup.theme],
    ]);
  }

  // ------------------------------------------------------------------
  // conteúdo
  // ------------------------------------------------------------------

  private html(est: EstadoUI): string {
    const f = est.forma;
    if (!f) return this.htmlLamina(est);
    const multiplas = est.formas.length > 1;
    const partes: string[] = [];
    partes.push(`<div class="pf-titulo">${multiplas ? `${est.formas.length} formas selecionadas` : f.name || (f.kind === "imagem" ? "Imagem" : "Forma")}</div>`);
    if (f.grafico) partes.push(secao("grafico", "Gráfico", this.htmlGrafico(f)));
    if (f.midia) partes.push(secao("midia", "Mídia", this.htmlMidia(f)));
    if (f.kind === "imagem") partes.push(secao("imagem", "Imagem", this.htmlImagem(f)));
    if (f.estilo) partes.push(secao("estilo", "Estilo", this.htmlEstilo(f)));
    else if (f.kind !== "imagem" && !(f.geom === "line" || f.geom?.endsWith("Connector3") || f.geom === "straightConnector1")) partes.push(secao("preench", "Preenchimento", this.htmlPreenchimento(f)));
    partes.push(secao("linha", "Linha", this.htmlLinha(f)));
    partes.push(secao("efeitos", "Efeitos", this.htmlEfeitos(f)));
    const ajustes = this.htmlAjustes(f, est);
    if (ajustes) partes.push(secao("ajustes", "Ajustes da forma", ajustes));
    partes.push(secao("tamanho", "Tamanho e posição", this.htmlTamanho(f, est)));
    if (f.paras !== undefined) partes.push(secao("texto", "Texto", this.htmlTexto(f, est)));
    return partes.join("");
  }

  /** A seção "Estilo" (quando a forma tem estilo vivo): a receita, a cor-base e o desligar. */
  private htmlEstilo(f: Shape): string {
    const e = f.estilo!;
    const base = (e.base ?? "").trim() || FAMILIAS[e.familia]?.base || "";
    const familias = FAMILIAS_ORDEM.map((id) => {
      const rec = FAMILIAS[id];
      const cor = rec.base || base || "8A8F98";
      const r = rampaDeTons(cor, e.intensidade, rec.desvio);
      const previa = id === "propria" ? `background:#${cor}` : `background:linear-gradient(135deg,#${r.claro},#${r.cor} 45%,#${r.escuro})`;
      return `<button type="button" class="pf-estilo-fam${e.familia === id ? " on" : ""}" data-click="estilo-cor" data-valor="familia:${id}" title="${rec.nome}" aria-label="${rec.nome}" aria-pressed="${e.familia === id}"><span style="${previa}"></span></button>`;
    }).join("");
    return [
      `<div class="pf-linha"><span>Família</span><span class="pf-estilo-fams">${familias}</span></div>`,
      radios("est-int", "est-cor-int", e.intensidade, INTENSIDADES.map((i) => [i.id, i.nome] as [string, string])),
      radios("est-bri", "est-cor-bri", e.brilho, [["nada", "Sem brilho"], ["lustro", "Lustro"], ["dobra", "Dobra"]] as [string, string][]),
      linhaNum("Ângulo", "est-cor-angulo", e.angulo ?? 45, 15, 0, 360, "°"),
      linhaCor("Cor-base", "est-cor-base", base || null),
      `<button type="button" class="btn small" data-click="estilo-cor" data-valor="desligar">Desligar estilo (editar à mão)</button>`,
      `<p class="pf-nota">O estilo manda no preenchimento, no contorno, na sombra e na cor do texto. A cor-base refaz a rampa inteira; sem cor própria, o estilo acompanha o tema.</p>`,
    ].join("");
  }

  private htmlPreenchimento(f: Shape): string {
    const fx = f.fillX;
    const tipo = !fx || fx.kind === "none" ? "none" : fx.kind;
    const partes = [radios("pf", "pf-tipo", tipo, [["none", "Sem"], ["solid", "Sólido"], ["gradient", "Gradiente"], ["image", "Imagem"]])];
    if (fx?.kind === "solid") {
      partes.push(linhaCor("Cor", "pf-cor", fx.color ?? "000000"));
      partes.push(linhaNum("Transparência", "pf-transp", Math.round((1 - (fx.alpha ?? 1)) * 100), 5, 0, 100, "%"));
    } else if (fx?.kind === "gradient") {
      partes.push(linhaSel("Tipo", "grad-tipo", fx.radial ? "radial" : "linear", [["linear", "Linear"], ["radial", "Radial"]]));
      if (!fx.radial) partes.push(linhaNum("Ângulo", "grad-angulo", fx.angle ?? 0, 15, 0, 360, "°"));
      (fx.stops ?? []).forEach((p, i) => {
        partes.push(`<div class="pf-parada"><span class="pf-campo"><button type="button" class="pf-cor" data-cor-act="grad-cor:${i}" style="background:#${p.color}" title="Cor da parada ${i + 1}"></button><small>#${p.color}</small></span><input type="number" data-act="grad-pos:${i}" value="${n1(p.pos)}" min="0" max="100" step="5" aria-label="Posição da parada ${i + 1}"><small>%</small><button type="button" class="pf-x" data-click="grad-del" data-valor="${i}" title="Remover parada"${(fx.stops?.length ?? 0) <= 2 ? " disabled" : ""}>×</button></div>`);
      });
      partes.push(`<button type="button" class="btn small" data-click="grad-add">+ Parada de gradiente</button>`);
      partes.push(`<button type="button" class="btn small" data-click="grad-inverter">Inverter cores</button>`);
    } else if (fx?.kind === "image") {
      partes.push(`<button type="button" class="btn small" data-click="preench-imagem">Trocar imagem…</button>`);
      partes.push(linhaNum("Transparência", "pf-transp", Math.round((1 - (fx.alpha ?? 1)) * 100), 5, 0, 100, "%"));
    }
    return partes.join("");
  }

  private htmlLinha(f: Shape): string {
    const l: Line | undefined = f.ln;
    const partes = [radios("ln", "ln-tipo", l ? "solid" : "none", [["none", "Sem linha"], ["solid", "Linha"]])];
    if (l) {
      partes.push(linhaCor("Cor", "ln-cor", l.color));
      partes.push(linhaNum("Espessura", "ln-w", l.w, 0.25, 0, 100, "pt"));
      partes.push(linhaNum("Transparência", "ln-transp", Math.round((1 - l.alpha) * 100), 5, 0, 100, "%"));
      partes.push(linhaSel("Traço", "ln-dash", l.dash ?? "solid", [["solid", "Contínuo"], ["dash", "Tracejado"], ["dot", "Pontilhado"], ["dashDot", "Traço e ponto"], ["lgDash", "Traço longo"], ["sysDash", "Traço curto"]]));
      const pontas: [string, string][] = [["", "Nenhuma"], ["triangle", "Triângulo"], ["arrow", "Seta aberta"], ["stealth", "Seta fina"], ["diamond", "Losango"], ["oval", "Círculo"]];
      partes.push(linhaSel("Início", "ln-head", l.head ?? "", pontas));
      partes.push(linhaSel("Fim", "ln-tail", l.tail ?? "", pontas));
      partes.push(linhaSel("Pontas da linha", "ln-cap", l.cap ?? "flat", [["flat", "Retas"], ["round", "Arredondadas"], ["square", "Quadradas"]]));
    }
    return partes.join("");
  }

  private htmlEfeitos(f: Shape): string {
    const s: Shadow | undefined = f.shadow;
    const partes = [linhaCheck("Sombra", "sd-on", !!s)];
    if (s) {
      partes.push(linhaCor("Cor", "sd-cor", s.color));
      partes.push(linhaNum("Transparência", "sd-transp", Math.round((1 - s.alpha) * 100), 5, 0, 100, "%"));
      partes.push(linhaNum("Desfoque", "sd-blur", s.blur, 1, 0, 100, "pt"));
      partes.push(linhaNum("Distância", "sd-dist", s.dist, 1, 0, 100, "pt"));
      partes.push(linhaNum("Ângulo", "sd-dir", s.dir, 15, 0, 360, "°"));
    }
    partes.push(linhaNum("Opacidade da forma", "opac", Math.round((f.opacity ?? 1) * 100), 5, 0, 100, "%"));
    return partes.join("");
  }

  /**
   * Cantos: os quatro valores do raio (%; sup. esq, sup. dir, inf. dir, inf. esq), os que estão
   * escolhidos para a edição e como o arranjo vai parar no .pptx (preset nativo ou forma livre).
   */
  private htmlCantos(cantos: [number, number, number, number], est: EstadoUI): string {
    const sel = est.cantosSel;
    const valorDe = (c: Canto) => cantos[CANTOS.indexOf(c)];
    const vals = sel.map(valorDe);
    const iguais = vals.every((v) => Math.abs(v - vals[0]) < 0.01);
    const valor = vals.length ? vals[0] : cantos[0];
    // várias formas escolhidas com cantos diferentes: o slider fica "em branco" e o painel avisa
    const outras = est.formas.map((x) => cantosDe(x)).filter((c): c is [number, number, number, number] => !!c);
    const mistas = outras.some((c) => sel.some((cx) => Math.abs(c[CANTOS.indexOf(cx)] - valorDe(cx)) > 0.01));
    const coerente = iguais && !mistas;
    const botao = (c: Canto) => {
      const on = sel.includes(c);
      return `<button type="button" class="pf-canto c-${c}${on ? " on" : ""}" data-click="canto-sel" data-valor="${c}" title="Canto ${CANTO_ROTULO[c]} — ${n1(valorDe(c))}%" aria-pressed="${on}">${n1(valorDe(c))}</button>`;
    };
    const nota: Record<string, string> = {
      rect: "Sem arredondamento: vai como Retângulo comum.",
      roundRect: "No arquivo: Retângulo arredondado (forma nativa do PowerPoint).",
      round1Rect: "No arquivo: forma nativa com um canto arredondado.",
      round2SameRect: "No arquivo: forma nativa com os cantos de cima/baixo arredondados.",
      round2DiagRect: "No arquivo: forma nativa com os cantos em diagonal arredondados.",
      livre: "No arquivo: forma livre (desenha igual; é o que o “Combinar formas” do PowerPoint produz).",
    };
    return `
      <div class="pf-cantos">
        <div class="pf-cantos-mapa" role="group" aria-label="Cantos da forma (clique para escolher quais editar)">
          <span class="pf-cantos-quadro" aria-hidden="true"></span>
          ${botao("tl")}${botao("tr")}${botao("br")}${botao("bl")}
        </div>
        <label class="pf-linha"><span>Raio</span><span class="pf-campo"><input type="range" data-act="canto" min="0" max="50" step="0.5" value="${coerente ? valor : ""}"><small>${sel.length} de 4 canto(s)${coerente ? "" : mistas ? " · formas com valores diferentes" : " · valores diferentes"}</small></span></label>
        <div class="pf-botoes">
          <button type="button" class="btn small" data-click="canto-todos"${sel.length === 4 ? " disabled" : ""}>Todos</button>
          <button type="button" class="btn small" data-click="canto-opostos">Opostos</button>
          <button type="button" class="btn small" data-click="canto-preset" data-valor="0">Quadrado</button>
          <button type="button" class="btn small" data-click="canto-preset" data-valor="16.67">Padrão</button>
          <button type="button" class="btn small" data-click="canto-preset" data-valor="25">Suave</button>
          <button type="button" class="btn small" data-click="canto-preset" data-valor="50">Pílula</button>
        </div>
        <p class="pf-nota">${nota[representacaoDeCantos(cantos)] ?? ""}</p>
      </div>`;
  }

  private htmlAjustes(f: Shape, est: EstadoUI): string {
    const cantos = cantosDe(f);
    const partes: string[] = [];
    if (cantos) {
      partes.push(this.htmlCantos(cantos, est));
    } else {
      // geometrias de canto CORTADO (snip*): o ajuste continua sendo o tamanho do corte
      const corte = raioDeCanto(f);
      if (corte !== null) partes.push(`<label class="pf-linha"><span>Cantos recortados</span><span class="pf-campo"><input type="range" data-act="canto-corte" min="0" max="50" step="0.5" value="${corte}"><small>${n1(corte)}%</small></span></label>`);
    }
    const lista = AJUSTES_POR_GEOM[f.geom ?? ""] ?? [];
    for (const a of lista) {
      if ((f.geom === "roundRect" || f.geom === "round1Rect") && a.chave === "adj") continue;
      const v = f.adj?.[a.chave] ?? a.padrao;
      partes.push(`<label class="pf-linha"><span>${a.rotulo}</span><span class="pf-campo"><input type="range" data-act="ajuste:${a.chave}" min="${a.min}" max="${a.max}" step="${Math.max(1, (a.max - a.min) / 200)}" value="${v}"></span></label>`);
    }
    return partes.join("");
  }

  private htmlTamanho(f: Shape, est: EstadoUI): string {
    const d = { w: est.setup.widthIn ? est.setup.widthIn * 72 : 960, h: est.setup.heightIn ? est.setup.heightIn * 72 : 540 };
    const x = ptParaCm((f.box.x / 100) * d.w);
    const y = ptParaCm((f.box.y / 100) * d.h);
    const w = ptParaCm((f.box.w / 100) * d.w);
    const h = ptParaCm((f.box.h / 100) * d.h);
    const multi = est.formas.length > 1;
    return [
      linhaNum("Largura", "pos-w", multi ? "" : w, 0.1, 0.05, 200, "cm"),
      linhaNum("Altura", "pos-h", multi ? "" : h, 0.1, 0.05, 200, "cm"),
      linhaNum("Posição horizontal", "pos-x", multi ? "" : x, 0.1, null, null, "cm"),
      linhaNum("Posição vertical", "pos-y", multi ? "" : y, 0.1, null, null, "cm"),
      linhaNum("Rotação", "rot", multi ? "" : f.rot, 1, 0, 360, "°"),
      `<div class="pf-botoes"><button type="button" class="btn small" data-click="espelhar" data-valor="h">⇋ Espelhar H</button><button type="button" class="btn small" data-click="espelhar" data-valor="v">⥮ Espelhar V</button></div>`,
      linhaCheck("Bloquear posição e tamanho", "bloquear-forma", !!f.bloqueada),
    ].join("");
  }

  private htmlTexto(f: Shape, est: EstadoUI): string {
    const ins = f.ins ?? [7.2, 3.6, 7.2, 3.6];
    const spc = est.trecho && est.trecho.spc !== "misto" ? est.trecho.spc : 0;
    return [
      `<div class="pf-linha"><span>Alinhamento vertical</span></div>`,
      radios("anc", "anchor", f.anchor ?? "t", [["t", "Topo"], ["ctr", "Meio"], ["b", "Base"]]),
      linhaSel("Direção", "vert", f.vert ?? "", [["", "Horizontal"], ["vert", "Girar 90°"], ["vert270", "Girar 270°"]]),
      linhaNum("Espaçamento entre caracteres", "espacamento", spc, 0.25, -50, 50, "pt"),
      linhaNum("Margem esquerda", "marg:0", ptParaCm(ins[0]), 0.05, 0, 20, "cm"),
      linhaNum("Margem superior", "marg:1", ptParaCm(ins[1]), 0.05, 0, 20, "cm"),
      linhaNum("Margem direita", "marg:2", ptParaCm(ins[2]), 0.05, 0, 20, "cm"),
      linhaNum("Margem inferior", "marg:3", ptParaCm(ins[3]), 0.05, 0, 20, "cm"),
      linhaCheck("Quebrar o texto na forma", "wrap", f.wrap !== false),
    ].join("");
  }

  private htmlImagem(f: Shape): string {
    const c = f.crop ?? [0, 0, 0, 0];
    return [
      `<div class="pf-linha"><span>Recorte (% da imagem)</span></div>`,
      linhaNum("Esquerda", "crop:0", c[0], 1, 0, 95, "%"),
      linhaNum("Topo", "crop:1", c[1], 1, 0, 95, "%"),
      linhaNum("Direita", "crop:2", c[2], 1, 0, 95, "%"),
      linhaNum("Base", "crop:3", c[3], 1, 0, 95, "%"),
      `<div class="pf-botoes"><button type="button" class="btn small" data-click="crop-reset">Redefinir recorte</button><button type="button" class="btn small" data-click="imagem-trocar">Trocar imagem…</button></div>`,
      linhaSel("Formato", "img-forma", f.geom === "ellipse" ? "ellipse" : f.geom === "roundRect" ? "roundRect" : "rect", [["rect", "Retângulo"], ["roundRect", "Cantos arredondados"], ["ellipse", "Círculo/elipse"]]),
    ].join("");
  }

  /** Gráfico: tipo, título, opções e a tabela de dados (categorias × séries). */
  private htmlGrafico(f: Shape): string {
    const g = f.grafico!;
    const partes: string[] = [];
    partes.push(linhaSel("Tipo", "grafico-tipo", g.tipo, GRAFICO_TIPOS.map((t) => [t.id, t.nome] as [string, string])));
    partes.push(
      `<label class="pf-linha"><span>Título</span><span class="pf-campo"><input type="text" data-act="grafico-titulo" value="${escAttr(g.titulo ?? "")}" placeholder="Sem título"></span></label>`
    );
    partes.push(linhaCheck("Legenda", "grafico-legenda", g.legenda ?? g.series.length > 1));
    partes.push(linhaCheck("Rótulos de dados", "grafico-rotulos", !!g.rotulos));
    if (g.tipo === "colunas" || g.tipo === "barras" || g.tipo === "area") partes.push(linhaCheck("Empilhado", "grafico-empilhado", !!g.empilhado));

    // tabela de dados: uma linha por série, uma coluna por categoria
    const td = "padding:1px 2px;text-align:center;vertical-align:middle";
    const inp = "width:52px;font-size:11px;padding:2px 3px";
    const inpCat = "width:64px;font-size:11px;padding:2px 3px";
    const cabec = g.categorias
      .map(
        (c, i) =>
          `<th style="padding:1px 2px;text-align:center"><input type="text" style="${inpCat}" data-act="grafico-cat:${i}" value="${escAttr(c)}" aria-label="Categoria ${i + 1}"><div><button type="button" class="pf-x" data-click="grafico-del-cat" data-valor="${i}" title="Remover categoria"${g.categorias.length <= 1 ? " disabled" : ""}>×</button></div></th>`
      )
      .join("");
    const cores = paletaDeSeries(g.series.length, undefined, g.cores);
    const linhas = g.series
      .map((s, j) => {
        const cels = g.categorias
          .map((_, i) => `<td style="${td}"><input type="number" style="${inp}" data-act="grafico-val:${i}:${j}" value="${n1(s.valores[i] ?? 0)}" step="1" aria-label="Valor da série ${j + 1}, categoria ${i + 1}"></td>`)
          .join("");
        return (
          `<tr><th style="padding:1px 2px;text-align:left;white-space:nowrap">` +
          `<button type="button" class="pf-cor" data-cor-act="grafico-cor:${j}" title="Cor da série" style="background:#${cores[j]}"></button>` +
          `<input type="text" style="${inpCat}" data-act="grafico-serie:${j}" value="${escAttr(s.nome)}" aria-label="Nome da série ${j + 1}"></th>` +
          `${cels}<td style="${td}"><button type="button" class="pf-x" data-click="grafico-del-serie" data-valor="${j}" title="Remover série"${g.series.length <= 1 ? " disabled" : ""}>×</button></td></tr>`
        );
      })
      .join("");
    partes.push(
      `<div style="overflow:auto;max-width:100%"><table style="border-collapse:collapse;margin:2px 0"><thead><tr><th></th>${cabec}<th></th></tr></thead><tbody>${linhas}</tbody></table></div>`
    );
    partes.push(
      `<div class="pf-botoes"><button type="button" class="btn small" data-click="grafico-add-cat">+ Categoria</button><button type="button" class="btn small" data-click="grafico-add-serie">+ Série</button></div>`
    );
    partes.push(`<p class="pf-dica">O gráfico é desenhado na lâmina e vai para o .pptx como imagem; para editar os dados depois, continue no mdOffice.</p>`);
    return partes.join("");
  }

  /** Mídia (áudio/vídeo): reprodução na apresentação, volume e corte do trecho. */
  private htmlMidia(f: Shape): string {
    const m = f.midia!;
    const vol = Math.round((m.volume ?? 1) * 100);
    const corte = m.corte ?? { inicio: 0 };
    return [
      `<div class="pf-linha"><span>Tipo</span><span class="pf-campo"><b>${MIDIA_ROTULOS[m.tipo]}</b></span></div>`,
      m.nome ? `<div class="pf-linha"><span>Arquivo</span><span class="pf-campo"><small>${escAttr(m.nome)}</small></span></div>` : "",
      linhaCheck("Reproduzir automaticamente", "midia-auto", !!m.auto),
      linhaCheck("Repetir", "midia-loop", !!m.loop),
      linhaCheck("Mostrar controles na apresentação", "midia-controles", !!m.controles),
      linhaCheck("Continuar em outras lâminas", "midia-continuar", !!m.continuar),
      linhaNum("Volume", "midia-volume", vol, 5, 0, 100, "%"),
      linhaNum("Início do trecho", "midia-corte:inicio", corte.inicio, 0.5, 0, null, "s"),
      linhaNum("Fim do trecho", "midia-corte:fim", corte.fim ?? "", 0.5, 0, null, "s"),
      `<div class="pf-botoes"><button type="button" class="btn small" data-click="midia-reproduzir">▶ Reproduzir aqui</button><button type="button" class="btn small" data-click="midia-trocar">Trocar arquivo…</button></div>`,
      `<p class="pf-dica">A mídia toca no modo apresentação (F5). A capa é o primeiro quadro do vídeo, e o arquivo vai junto no .pptx exportado.</p>`,
    ].join("");
  }

  private htmlLamina(est: EstadoUI): string {
    const f = est.bg;
    const tipo = !f ? "tema" : f.kind === "none" ? "tema" : f.kind;
    const controles = est.bgEstilo
      ? [this.htmlEstiloFundo(est.bgEstilo), `<button type="button" class="btn small" data-click="fundo-todas">Aplicar a todas as lâminas</button>`].join("")
      : [
          radios("bg", "bg-tipo", tipo, [["tema", "Do tema"], ["solid", "Sólido"], ["gradient", "Gradiente"], ["image", "Imagem"]]),
          f?.kind === "solid" ? linhaCor("Cor", "bg-cor", f.color ?? "FFFFFF") : "",
          f?.kind === "gradient" ? `${linhaCor("Cor inicial", "bg-grad-cor:0", f.stops?.[0]?.color ?? "FFFFFF")}${linhaCor("Cor final", "bg-grad-cor:1", f.stops?.[f.stops.length - 1]?.color ?? "000000")}${linhaNum("Ângulo", "bg-grad-angulo", f.angle ?? 90, 15, 0, 360, "°")}` : "",
          f?.kind === "image" ? `<button type="button" class="btn small" data-click="fundo-imagem">Trocar imagem…</button>` : "",
          `<button type="button" class="btn small" data-click="fundo-todas">Aplicar a todas as lâminas</button>`,
        ].join("");
    const partes = [
      `<div class="pf-titulo">Lâmina ${est.indice + 1} de ${est.total}</div>`,
      secao("fundo", "Fundo", controles),
      secao("layout", "Layout", linhaSel("Layout", "layout-sel", est.layout, ORDEM_LAYOUTS.map((id) => [id, ROTULOS_LAYOUT[id]] as [string, string]))),
      `<p class="pf-dica">Selecione uma forma na lâmina para formatar o preenchimento, a linha, os efeitos, o tamanho e o texto dela. <b>Clique e arraste</b> para desenhar com uma forma escolhida em <b>Inserir</b>.</p>`,
    ];
    return partes.join("");
  }

  /** A seção "Fundo" com estilo (as mesmas famílias das formas; no fundo a dobra vira lustro). */
  private htmlEstiloFundo(e: EstiloForma): string {
    const base = (e.base ?? "").trim() || FAMILIAS[e.familia]?.base || "";
    const familias = FAMILIAS_ORDEM.map((id) => {
      const rec = FAMILIAS[id];
      const cor = rec.base || base || "8A8F98";
      const r = rampaDeTons(cor, e.intensidade, rec.desvio);
      const previa = id === "propria" ? `background:#${cor}` : `background:linear-gradient(135deg,#${r.claro},#${r.cor} 45%,#${r.escuro})`;
      return `<button type="button" class="pf-estilo-fam${e.familia === id ? " on" : ""}" data-click="fundo-estilo" data-valor="familia:${id}" title="${rec.nome}" aria-label="${rec.nome}" aria-pressed="${e.familia === id}"><span style="${previa}"></span></button>`;
    }).join("");
    return [
      `<div class="pf-linha"><span>Família</span><span class="pf-estilo-fams">${familias}</span></div>`,
      radios("est-fundo-int", "fundo-est-int", e.intensidade, INTENSIDADES.map((i) => [i.id, i.nome] as [string, string])),
      radios("est-fundo-bri", "fundo-est-bri", e.brilho === "dobra" ? "lustro" : e.brilho, [["nada", "Sem brilho"], ["lustro", "Lustro"]] as [string, string][]),
      linhaNum("Ângulo", "fundo-est-angulo", e.angulo ?? 45, 15, 0, 360, "°"),
      linhaCor("Cor-base", "fundo-est-cor", base || null),
      `<button type="button" class="btn small" data-click="fundo-estilo" data-valor="desligar">Desligar o estilo do fundo</button>`,
      `<p class="pf-nota">O fundo segue a mesma receita das formas: a cor-base refaz a rampa e, sem cor própria, ele acompanha o tema. No fundo não há dobra — o brilho fica no lustro.</p>`,
    ].join("");
  }
}

export type { Fill };
export { cmParaPt };
