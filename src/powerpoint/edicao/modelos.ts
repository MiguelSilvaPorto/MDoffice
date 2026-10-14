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
