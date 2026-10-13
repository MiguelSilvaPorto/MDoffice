// Modelos de apresentação (botão Template da fita): combinações prontas de tema, fundo e fonte.
// Aplicar um modelo ao deck troca as cores da paleta antiga pelas do novo tema nos textos,
// preenchimentos, contornos e fundos — o que foi escolhido fora da paleta fica como está.
// Funções puras: devolvem lâminas novas, sem mexer nas originais.
import type { CelulaTab, DeckSetup, Fill, Para, Run, Shape, Slide, ThemeId } from "../schema";
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
];

/** Como o deck está agora — é daqui que saem as cores e a fonte que o modelo substitui. */
export interface EstiloAtual {
  theme: ThemeId;
  bg: string;
  fontFamily: string;
}

/** Aplica o modelo às lâminas: troca as cores do tema antigo pelas do novo e ajusta a fonte. */
export function aplicarModelo(slides: Slide[], de: EstiloAtual, modelo: ModeloPPT): Slide[] {
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
  const cor = (c: string | undefined): string | undefined => (c ? (mapa.get(c.replace(/^#/, "").toUpperCase()) ?? c) : c);
  const fonte = (f: string | undefined): string | undefined => (!f || f === fonteAntiga ? modelo.fonte : f);
  // texto sobre forma pintada com o acento antigo: refaz o contraste para continuar legível
  const contrasteAntigo = corDeContraste(ta.accent);
  const contrasteNovo = corDeContraste(tb.accent);
  const fill = (f: Fill | undefined): Fill | undefined => {
    if (!f) return f;
    if (f.kind === "solid") return { ...f, color: cor(f.color) };
    if (f.kind === "gradient") return { ...f, stops: f.stops?.map((s) => ({ ...s, color: cor(s.color) ?? s.color })) };
    return f;
  };
  const ehAcento = (s: Shape) => (s.fillX?.kind === "solid" ? s.fillX.color : s.fill)?.toUpperCase() === ta.accent.toUpperCase();
  const corDeTexto = (s: Shape, c: string): string => (ehAcento(s) && c.toUpperCase() === contrasteAntigo ? contrasteNovo : cor(c) ?? c);
  const runs = (s: Shape, rs: Run[]): Run[] => rs.map((r) => ({ ...r, color: corDeTexto(s, r.color), font: fonte(r.font) ?? r.font }));
  const paras = (s: Shape, ps: Para[]): Para[] => ps.map((p) => ({ ...p, runs: runs(s, p.runs) }));
  const celula = (c: CelulaTab): CelulaTab => ({
    ...c,
    fill: fill(c.fill),
    paras: c.paras.map((p) => ({ ...p, runs: p.runs.map((r) => ({ ...r, color: cor(r.color) ?? r.color, font: fonte(r.font) ?? r.font })) })),
    estilo: c.estilo ? { ...c.estilo, color: cor(c.estilo.color) ?? c.estilo.color, font: fonte(c.estilo.font) ?? c.estilo.font } : c.estilo,
  });
  const forma = (s: Shape): Shape => ({
    ...s,
    color: corDeTexto(s, s.color),
    fontFamily: fonte(s.fontFamily) ?? s.fontFamily,
    fill: cor(s.fill) ?? s.fill,
    fillX: fill(s.fillX),
    ln: s.ln ? { ...s.ln, color: cor(s.ln.color) ?? s.ln.color } : s.ln,
    paras: s.paras ? paras(s, s.paras) : s.paras,
    tabela: s.tabela ? { ...s.tabela, celulas: s.tabela.celulas.map((linha) => linha.map(celula)) } : s.tabela,
  });
  return slides.map((sl) => ({ ...sl, bg: fill(sl.bg), shapes: sl.shapes.map(forma) }));
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
    usuario: true,
  };
}
