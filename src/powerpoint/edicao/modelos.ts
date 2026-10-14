// Modelos de apresentação (botão Template da fita): combinações prontas de tema, fundo e fonte.
// Aplicar um modelo ao deck troca as cores da paleta antiga pelas do novo tema nos textos,
// preenchimentos, contornos e fundos — o que foi escolhido fora da paleta fica como está.
// Funções puras: devolvem lâminas novas, sem mexer nas originais.
//
// As Ideias de design usam o mesmo `aplicarModelo` com um TRATAMENTO a mais: além de trocar a
// paleta, elas remapeiam as cores PRÓPRIAS das formas (um organograma importado tem verdes que
// não estão em tema nenhum) para as cores do design, e podem arredondar os cantos ou dar
// contorno de acento — é o que faz a lâmina parecer outro estilo, e não só outro fundo.
import type { BrilhoEstilo, CelulaTab, DeckSetup, EstiloForma, FamiliaEstilo, Fill, IntensidadeEstilo, Para, Run, Shape, Slide, ThemeId } from "../schema";
import { themeOf } from "../themes";
import { corDeContraste, estiloDoDeck } from "./criar";

export interface ModeloPPT {
  id: string;
  nome: string;
  descricao: string;
  tema: ThemeId;
  /** fundo próprio do deck (hex sem #); vazio = fundo do tema */
  bg: string;
  /** fonte padrão do texto do deck */
  fonte: string;
  /** cores próprias (modelos criados pelo usuário): substituem as do tema */
  cores?: { bg?: string; fg?: string; accent?: string; muted?: string };
  /**
   * Estilo de Cor do modelo (Estilos de Cor): o FUNDO das lâminas nasce com a receita, sem cor
   * própria — o estilo segue o acento do próprio modelo. Sem isto, aplicar o modelo devolve o
   * fundo ao do modelo (o estilo do fundo sai, senão ele seria reescrito pelo recálculo).
   */
  estilo?: { familia: FamiliaEstilo; intensidade: IntensidadeEstilo; brilho: BrilhoEstilo };
  /** criado pelo usuário: aparece junto dos presets, com opção de remover */
  usuario?: boolean;
}

export const MODELOS: ModeloPPT[] = [
  { id: "classico", nome: "Clássico", descricao: "Fundo branco, texto escuro e acento índigo", tema: "claro", bg: "", fonte: "Segoe UI" },
  { id: "papel", nome: "Papel", descricao: "Fundo bege quente e fonte Georgia", tema: "claro", bg: "F7F3EA", fonte: "Georgia" },
  { id: "moderno", nome: "Moderno", descricao: "Fundo cinza-claro e fonte Inter", tema: "claro", bg: "F3F5FA", fonte: "Inter" },
  { id: "escuro", nome: "Escuro", descricao: "Fundo quase preto e fonte Segoe UI", tema: "escuro", bg: "", fonte: "Segoe UI" },
  { id: "meia-noite", nome: "Meia-noite", descricao: "Fundo azul-escuro e fonte Inter", tema: "escuro", bg: "151B26", fonte: "Inter" },
  { id: "contraste", nome: "Alto contraste", descricao: "Preto e branco com destaques amarelos", tema: "contraste", bg: "", fonte: "Arial" },
  // O catálogo inspirado no DeckCraft (o app irmão): cada design traz as PRÓPRIAS cores nos
  // quatro papéis que o app usa (fundo, texto, acento e secundária) e a fonte — o mesmo
  // formato dos modelos do usuário, então `aplicarModelo` já sabe trocá-las. Os oito primeiros
  // são os temas originais de lá; os cinco últimos, os esquemas de cor extras do catálogo.
  { id: "deckcraft", nome: "DeckCraft", descricao: "Fundo areia, texto azul-escuro e acento azul", tema: "claro", bg: "EDEBE7", fonte: "Inter", cores: { fg: "1E2B3C", accent: "2E6FD8", muted: "8A5CD8" } },
  { id: "harbor", nome: "Harbor", descricao: "Fundo azul-marinho e acento turquesa", tema: "escuro", bg: "0B1F2A", fonte: "Open Sans", cores: { fg: "FFFFFF", accent: "1B7FA6", muted: "36B3A8" } },
  { id: "ember", nome: "Ember", descricao: "Fundo carvão quente e acento laranja", tema: "escuro", bg: "1A1A1A", fonte: "Lato", cores: { fg: "FFFCF7", accent: "D9480F", muted: "F59F00" } },
  { id: "meadow", nome: "Meadow", descricao: "Fundo verde-mata e acento verde-claro", tema: "escuro", bg: "14281D", fonte: "Open Sans", cores: { fg: "FFFFFF", accent: "4C9A2A", muted: "A4C639" } },
  { id: "nocturne", nome: "Nocturne", descricao: "Fundo azul-noite e acento violeta", tema: "escuro", bg: "121826", fonte: "Inter", cores: { fg: "F2F4F8", accent: "7C5CFF", muted: "00C2A8" } },
  { id: "paper", nome: "Paper", descricao: "Cinza de papel com acento azul clássico", tema: "claro", bg: "F2F2F2", fonte: "Lato", cores: { fg: "404040", accent: "4F81BD", muted: "8C8C8C" } },
  { id: "coral", nome: "Coral Reef", descricao: "Fundo petróleo e acento coral", tema: "escuro", bg: "0F2A33", fonte: "Nunito Sans", cores: { fg: "FDF1EC", accent: "FF6F59", muted: "43AA8B" } },
  { id: "slate", nome: "Slate", descricao: "Fundo ardósia e acento índigo", tema: "escuro", bg: "111827", fonte: "Roboto", cores: { fg: "F3F4F6", accent: "6366F1", muted: "0EA5E9" } },
  { id: "grayscale", nome: "Grayscale", descricao: "Preto, branco e cinzas", tema: "claro", bg: "F8F8F8", fonte: "Inter", cores: { fg: "000000", accent: "5F5F5F", muted: "919191" } },
  { id: "ocean", nome: "Ocean", descricao: "Fundo azul-gelo e acento oceano", tema: "claro", bg: "E8F1F2", fonte: "Inter", cores: { fg: "13293D", accent: "1B98E0", muted: "247BA0" } },
  { id: "sunset", nome: "Sunset", descricao: "Fundo creme e acento pôr do sol", tema: "claro", bg: "FFF3E6", fonte: "Poppins", cores: { fg: "6F1A07", accent: "FF9F1C", muted: "E76F51" } },
  { id: "forest", nome: "Forest", descricao: "Fundo palha e acento verde-oliva", tema: "claro", bg: "FEFAE0", fonte: "Merriweather", cores: { fg: "283618", accent: "606C38", muted: "BC6C25" } },
  { id: "berry", nome: "Berry", descricao: "Fundo rosa-claro e acento vinho", tema: "claro", bg: "F7E8F3", fonte: "Poppins", cores: { fg: "4A1942", accent: "893168", muted: "56A3A6" } },
  // Os modelos com Estilo de Cor: o FUNDO das lâminas nasce no gradiente da família (a receita
  // acompanha o acento do próprio modelo), com o texto e a fonte já casados — é o deck da
  // referência (verde → teal) pronto para usar, e qualquer forma com Estilo de Cor e cor "do
  // tema" passa a acompanhar o acento daqui.
  { id: "esmeralda", nome: "Esmeralda", descricao: "Fundo verde→teal com brilho e acento esmeralda", tema: "escuro", bg: "0B3A2B", fonte: "Inter", cores: { fg: "FFFFFF", accent: "2FBF71", muted: "9FD9BC" }, estilo: { familia: "esmeralda", intensidade: "media", brilho: "lustro" } },
  { id: "oceano", nome: "Oceano", descricao: "Fundo azul→petróleo com brilho e acento oceano", tema: "escuro", bg: "06283D", fonte: "Open Sans", cores: { fg: "FFFFFF", accent: "2D9CDB", muted: "9CC9E8" }, estilo: { familia: "oceano", intensidade: "media", brilho: "lustro" } },
  { id: "ameixa", nome: "Ameixa", descricao: "Fundo violeta→magenta com brilho e acento ameixa", tema: "escuro", bg: "241033", fonte: "Inter", cores: { fg: "FFFFFF", accent: "A66BD8", muted: "CDA9E8" }, estilo: { familia: "ameixa", intensidade: "media", brilho: "lustro" } },
];

/** Como o deck está agora — é daqui que saem as cores e a fonte que o modelo substitui. */
export interface EstiloAtual {
  theme: ThemeId;
  bg: string;
  fontFamily: string;
}

/** O que uma ideia propõe além das cores e da fonte: o acabamento das formas. */
export type TratamentoIdeia = "recolorir" | "cantos" | "contorno";

/** Como cada tratamento aparece no cartão da ideia. */
export const ROTULO_TRATAMENTO: Record<TratamentoIdeia, string> = {
  recolorir: "cores novas",
  cantos: "cantos arredondados",
  contorno: "contorno de acento",
};

/** Mistura duas cores (hex sem #): `peso` é quanto da segunda entra no resultado. */
function misturar(a: string, b: string, peso: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return [0, 1, 2]
    .map((i) => Math.max(0, Math.min(255, Math.round(ch(a, i) * (1 - peso) + ch(b, i) * peso))))
    .map((n) => n.toString(16).padStart(2, "0").toUpperCase())
    .join("");
}

/** Luminosidade e saturação (HSL) de uma cor hex sem # — é por elas que o papel é decidido. */
function matiz(hex: string): { l: number; s: number } {
  const v = [0, 1, 2].map((i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255);
  const max = Math.max(...v);
  const min = Math.min(...v);
  const l = (max + min) / 2;
  return { l, s: max === min ? 0 : (max - min) / (l < 0.5 ? max + min : 2 - max - min) };
}

/** As quatro cores que um design oferece — é para elas que as cores próprias do deck vão. */
export interface CoresPPT {
  fg: string;
  bg: string;
  accent: string;
  muted: string;
}

/** A cor sem # e em maiúsculas — a forma como o app guarda as cores. */
const semGrade = (c: string) => c.replace(/^#/, "").toUpperCase();

/** Os dois extremos que o design oferece — é deles que o texto tira o contraste. */
function extremos(destino: CoresPPT): { escuro: string; claro: string } {
  return matiz(semGrade(destino.fg)).l <= matiz(semGrade(destino.bg)).l
    ? { escuro: destino.fg, claro: destino.bg }
    : { escuro: destino.bg, claro: destino.fg };
}

/** O fundo claro da família do acento (o branco do deck vira um tom de fundo, não um acento). */
function tinta(destino: CoresPPT): string {
  return misturar(semGrade(destino.accent), semGrade(destino.bg), 0.86);
}

/** Luminância relativa (WCAG) de uma cor hex sem #. */
function luminancia(hex: string): number {
  const canais = [0, 1, 2].map((i) => {
    const v = parseInt(hex.slice(i * 2, i * 2 + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * canais[0] + 0.7152 * canais[1] + 0.0722 * canais[2];
}

/** Contraste entre duas cores (WCAG: de 1 a 21) — o mínimo para texto é 4,5:1. */
export function contrasteDeCores(a: string, b: string): number {
  const la = luminancia(semGrade(a));
  const lb = luminancia(semGrade(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * O destino de uma cor PRÓPRIA do deck que pinta uma superfície (fundo da lâmina, forma, célula)
 * na paleta do design, pelo PAPEL dela: as claras são fundos (viram a tinta do acento), as
 * escuras são painéis escuros (continuam escuros), as saturadas são a marca (viram o acento) e
 * os cinzas do meio são a cor secundária.
 */
export function papelDaCor(cor: string, destino: CoresPPT): string {
  const { l, s } = matiz(semGrade(cor));
  if (l > 0.72) return tinta(destino);
  if (l < 0.25) return extremos(destino).escuro;
  if (s >= 0.3) return destino.accent;
  return l < 0.5 ? extremos(destino).escuro : destino.muted;
}

/**
 * O destino de uma cor de TEXTO: o escuro continua escuro e o claro continua claro — é o que
 * mantém o texto legível quando a superfície dele não muda (uma imagem, por exemplo).
 */
export function papelDoTexto(cor: string, destino: CoresPPT): string {
  const { l, s } = matiz(semGrade(cor));
  if (l > 0.72) return extremos(destino).claro;
  if (l < 0.25) return extremos(destino).escuro;
  if (s >= 0.3) return destino.accent;
  return l < 0.5 ? extremos(destino).escuro : destino.muted;
}

/**
 * O texto legível sobre a superfície nova: se o tom escolhido pelo papel não alcança o contraste
 * mínimo (WCAG 4,5:1), o texto cai para o extremo do design que mais contrasta com ela — e, em
 * último recurso (superfícies do meio, onde nem o preto nem o branco do design chegam), para o
 * branco ou o preto puro. É o que impede o defeito de "texto claro sobre cartão claro" quando a
 * ideia troca os dois ao mesmo tempo.
 */
export function contrasteCom(texto: string, superficie: string | undefined, destino: CoresPPT): string {
  if (!superficie || contrasteDeCores(texto, superficie) >= 4.5) return texto;
  const { escuro, claro } = extremos(destino);
  const melhor = (a: string, b: string) => (contrasteDeCores(b, superficie) > contrasteDeCores(a, superficie) ? b : a);
  // primeiro os extremos do design (é a cara dele); o branco/preto puro entra só em último
  // recurso — superfícies do meio, onde nem o preto nem o branco do design alcançam 4,5:1
  const doDesign = [escuro, claro].reduce(melhor);
  if (contrasteDeCores(doDesign, superficie) >= 4.5) return doDesign;
  return [doDesign, "FFFFFF", "000000"].reduce(melhor);
}

/** Aplica o modelo às lâminas: troca as cores do tema antigo pelas do novo e ajusta a fonte. */
export function aplicarModelo(slides: Slide[], de: EstiloAtual, modelo: ModeloPPT, tratamento?: TratamentoIdeia): Slide[] {
  const ta = themeOf(de.theme);
  const t0 = themeOf(modelo.tema);
  // um modelo do usuário traz as próprias cores; os presets usam as do tema
  const tb = {
    ...t0,
    bg: modelo.cores?.bg || modelo.bg || t0.bg,
    fg: modelo.cores?.fg || t0.fg,
    accent: modelo.cores?.accent || t0.accent,
    muted: modelo.cores?.muted || t0.muted,
  };
  const bgNovo = modelo.bg || tb.bg;
  const mapa = new Map<string, string>([
    [ta.fg.toUpperCase(), tb.fg],
    [ta.muted.toUpperCase(), tb.muted],
    [ta.accent.toUpperCase(), tb.accent],
    [(de.bg || ta.bg).toUpperCase(), bgNovo],
  ]);
  const fonteAntiga = de.fontFamily || ta.font;
  const cor = (c: string | undefined): string | undefined => (c ? (mapa.get(semGrade(c)) ?? c) : c);
  const fonte = (f: string | undefined): string | undefined => (!f || f === fonteAntiga ? modelo.fonte : f);
  // Sem tratamento (o Template da fita), tudo passa pelo mapa do tema, como sempre. Com
  // tratamento (as Ideias), cada cor própria ganha o papel dela: as superfícies pelo papel de
  // superfície (a marca vira o acento, os fundos claros viram tinta do acento, os painéis
  // escuros continuam escuros…) e os textos pelo papel de texto mais o contraste com a
  // superfície onde eles sentam — é isso que mantém o texto legível quando a ideia troca o
  // fundo e o texto ao mesmo tempo.
  const superficie = (c: string | undefined): string | undefined => (c ? (tratamento ? papelDaCor(c, tb) : cor(c)) : c);
  const pintura = (f: Fill | undefined): Fill | undefined => {
    if (!f) return f;
    if (f.kind === "solid") return { ...f, color: superficie(f.color) ?? f.color };
    if (f.kind === "gradient") return { ...f, stops: f.stops?.map((s) => ({ ...s, color: superficie(s.color) ?? s.color })) };
    return f;
  };
  // texto sobre forma pintada com o acento antigo: refaz o contraste para continuar legível
  const contrasteNovo = corDeContraste(tb.accent);
  const corDeTexto = (c: string, sobre: string | undefined, forma?: Shape): string => {
    if (tratamento) return contrasteCom(papelDoTexto(c, tb), sobre, tb);
    const bruta = forma ? (forma.fillX?.kind === "solid" ? forma.fillX.color : forma.fill)?.replace(/^#/, "").toUpperCase() ?? "" : "";
    const nova = forma ? mapa.get(bruta) : undefined;
    if (nova && nova.toUpperCase() === tb.accent.toUpperCase() && c.toUpperCase() === corDeContraste(bruta)) return contrasteNovo;
    return cor(c) ?? c;
  };
  const runs = (rs: Run[], sobre: string | undefined, forma?: Shape): Run[] => rs.map((r) => ({ ...r, color: corDeTexto(r.color, sobre, forma), font: fonte(r.font) ?? r.font }));
  const paras = (ps: Para[], sobre: string | undefined, forma?: Shape): Para[] => ps.map((p) => ({ ...p, runs: runs(p.runs, sobre, forma) }));
  const celula = (c: CelulaTab, sobre: string | undefined): CelulaTab => {
    const fillNovo = pintura(c.fill);
    // a superfície da célula é o preenchimento dela; sem preenchimento, a superfície da forma
    const fundo = fillNovo?.kind === "solid" ? superficie(fillNovo.color) : sobre;
    return {
      ...c,
      fill: fillNovo,
      paras: c.paras.map((p) => ({ ...p, runs: runs(p.runs, fundo) })),
      estilo: c.estilo ? { ...c.estilo, color: corDeTexto(c.estilo.color, fundo), font: fonte(c.estilo.font) ?? c.estilo.font } : c.estilo,
    };
  };
  /** O preenchimento da própria forma (na paleta nova), quando ela tem um. */
  const pinturaDaForma = (s: Shape): string | undefined => {
    const bruta = s.fillX?.kind === "solid" ? s.fillX.color : s.fillX?.kind === "gradient" ? s.fillX.stops?.[0]?.color : s.fill;
    return bruta ? superficie(bruta) : undefined;
  };
  /** O centro de uma forma está dentro da outra? (o texto solto senta em cima de um cartão) */
  const dentro = (fora: Shape, dentro: Shape): boolean => {
    const cx = dentro.box.x + dentro.box.w / 2;
    const cy = dentro.box.y + dentro.box.h / 2;
    return cx >= fora.box.x && cx <= fora.box.x + fora.box.w && cy >= fora.box.y && cy <= fora.box.y + fora.box.h;
  };
  /**
   * A superfície onde o texto senta: o preenchimento da própria forma; a forma pintada que está
   * embaixo dela (o cartão do texto solto); ou, por fim, o fundo da lâmina. Num deck importado o
   * cartão quase sempre é uma **imagem** — e aí a cor de trás é desconhecida, então o texto não
   * troca de lado (o escuro continua escuro), que é o que o mantém legível.
   */
  const superficieDoTexto = (s: Shape, anteriores: Shape[], fundoLamina: string | undefined): string | undefined => {
    const propria = pinturaDaForma(s);
    if (propria) return propria;
    for (let i = anteriores.length - 1; i >= 0; i--) {
      const baixo = anteriores[i];
      if (!dentro(baixo, s)) continue;
      if (baixo.kind === "imagem" || baixo.src) return undefined; // imagem: a cor de trás é desconhecida
      const f = pinturaDaForma(baixo);
      if (f) return f;
    }
    return fundoLamina;
  };
  const forma = (s: Shape, anteriores: Shape[], fundoLamina: string | undefined): Shape => {
    const sobre = superficieDoTexto(s, anteriores, fundoLamina);
    const f: Shape = {
      ...s,
      color: corDeTexto(s.color, sobre, s),
      fontFamily: fonte(s.fontFamily) ?? s.fontFamily,
      fill: superficie(s.fill) ?? s.fill,
      fillX: pintura(s.fillX),
      ln: s.ln ? { ...s.ln, color: superficie(s.ln.color) ?? s.ln.color } : s.ln,
      paras: s.paras ? paras(s.paras, sobre, s) : s.paras,
      tabela: s.tabela ? { ...s.tabela, celulas: s.tabela.celulas.map((linha) => linha.map((c) => celula(c, sobre))) } : s.tabela,
    };
    // Acabamento das ideias: cantos arredondados nos quadros pintados (o raio vira o "adj" do
    // preset, na mesma unidade do resto do app: 100000 × raio ÷ lado menor)…
    if (tratamento === "cantos" && !f.tabela && (f.fillX?.kind === "solid" || f.fill) && (!f.geom || f.geom === "rect")) {
      f.geom = "roundRect";
      f.adj = f.adj ?? { adj: 12000 };
    }
    // …e contorno na cor de acento nas formas pintadas: o desenho fica marcado, como um
    // diagrama, em vez de um bloco de cor
    if (tratamento === "contorno" && !f.tabela && (f.fillX?.kind === "solid" || f.fill)) {
      f.ln = { alpha: 1, cap: "flat", join: "miter", ...f.ln, color: tb.accent, w: Math.max(f.ln?.w ?? 0, 1.25) };
    }
    return f;
  };
  return slides.map((sl) => {
    // o fundo da lâmina segue a paleta do tema (é ele que vira o fundo do design); o que não for
    // do tema cai no papel da superfície
    const corDeFundo = (c: string | undefined): string | undefined => (c ? mapa.get(semGrade(c)) ?? papelDaCor(c, tb) : c);
    const bg = ((): Fill | undefined => {
      const f = sl.bg;
      if (!f || !tratamento) return pintura(f);
      if (f.kind === "solid") return { ...f, color: corDeFundo(f.color) };
      if (f.kind === "gradient") return { ...f, stops: f.stops?.map((s) => ({ ...s, color: corDeFundo(s.color) ?? s.color })) };
      return f;
    })();
    // as formas originais (na ordem) é que dizem onde cada texto senta — o cartão de baixo pode
    // ser uma imagem, e aí a superfície fica desconhecida de propósito
    const originais: Shape[] = [];
    const shapes = sl.shapes.map((s) => {
      const f = forma(s, originais, bg?.kind === "solid" ? bg.color : undefined);
      originais.push(s);
      return f;
    });
    return { ...sl, bg, shapes };
  }).map((sl) => {
    // o estilo do modelo vive no FUNDO: as lâminas ganham a receita sem cor própria (o estilo
    // segue o acento do modelo); o modelo sem estilo devolve o fundo ao do modelo
    if (modelo.estilo) return { ...sl, bgEstilo: { ...modelo.estilo, base: "" } as EstiloForma };
    const n: Slide = { ...sl };
    delete n.bgEstilo;
    return n;
  });
}

/** O fundo que mais aparece nas lâminas (hex sem #) — é o que o modelo do usuário guarda. */
function fundoDoDeck(slides: Slide[], setup: DeckSetup): string {
  const contagem = new Map<string, number>();
  for (const sl of slides) {
    const c = sl.bg?.kind === "solid" ? sl.bg.color : undefined;
    if (c) contagem.set(c.toUpperCase(), (contagem.get(c.toUpperCase()) ?? 0) + 1);
  }
  const top = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];
  return top?.[0] ?? setup.bg ?? "";
}

/** O Estilo de Cor que o deck usa no fundo, quando a maioria das lâminas concorda (senão, nada). */
function estiloDoDeckNasLaminas(slides: Slide[]): ModeloPPT["estilo"] {
  const contagem = new Map<string, { e: NonNullable<Slide["bgEstilo"]>; n: number }>();
  for (const sl of slides) {
    if (!sl.bgEstilo) continue;
    const k = `${sl.bgEstilo.familia}|${sl.bgEstilo.intensidade}|${sl.bgEstilo.brilho}`;
    const at = contagem.get(k);
    if (at) at.n++;
    else contagem.set(k, { e: sl.bgEstilo, n: 1 });
  }
  const top = [...contagem.values()].sort((a, b) => b.n - a.n)[0];
  if (!top || top.n * 2 <= slides.length) return undefined;
  return { familia: top.e.familia, intensidade: top.e.intensidade, brilho: top.e.brilho };
}

/**
 * Salva o visual do deck atual como um modelo: tema, fundo, fonte e as cores que mais aparecem
 * (texto e destaque). Aplicar depois reproduz essa cara em qualquer apresentação.
 */
export function modeloDoDeck(slides: Slide[], setup: DeckSetup, nome: string, id: string): ModeloPPT {
  const t = themeOf(setup.theme);
  const est = estiloDoDeck(slides, setup);
  const bg = fundoDoDeck(slides, setup) || setup.bg || t.bg;
  return {
    id,
    nome,
    descricao: "Modelo criado por você a partir desta apresentação",
    tema: setup.theme,
    bg,
    fonte: setup.fontFamily || est.fonte || t.font,
    cores: {
      bg,
      fg: est.corTexto || t.fg,
      accent: est.acento || t.accent,
      muted: t.muted,
    },
    ...(estiloDoDeckNasLaminas(slides) ? { estilo: estiloDoDeckNasLaminas(slides)! } : {}),
    usuario: true,
  };
}
