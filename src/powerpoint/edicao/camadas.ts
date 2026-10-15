// As CAMADAS da pintura (Estúdio, fase 4) — o painel "photoshop" por cima das boxes.
//
// Uma camada é um GRUPO de formas (o mesmo `Shape.grupo` que o "Agrupar" usa, com os membros
// vizinhos na ordem) com NOME próprio (`Shape.camada`, do app: o `.pptx` não tem camadas) e um
// estado de visibilidade e opacidade que vale para o grupo inteiro.
//
// As operações são puras sobre o `Slide` (como as de `operacoes.ts`): o host só liga nos botões.
//
// O que vai ao ARQUIVO: as formas, com a opacidade de cada uma — e as ESCONDIDAS não vão (o olho
// significa "não quero isto à vista", e o arquivo é o que se vê). O nome da camada fica no app
// (é o que permite voltar a mexer nela depois, na ida e volta do rascunho).

import type { Shape, Slide } from "../schema";

export interface Camada {
  /** a chave da camada: o id do grupo (as formas soltas têm a chave do PRÓPRIO id) */
  id: string;
  /** o nome mostrado no painel */
  nome: string;
  /** as formas da camada, na ordem da lâmina (de baixo para cima) */
  membros: Shape[];
  /** a camada está escondida (todos os membros ocultos) */
  oculta: boolean;
  /** a opacidade da camada (a do primeiro membro; 1 = opaca) */
  opacidade: number;
  /** nasceu da pintura do Estúdio? (as formas "Pintura · …") */
  pintura: boolean;
  /** é uma camada de pintura que dá para agrupar/ordenar como camada */
  grupo: boolean;
}

/** O nome que a pintura do Estúdio dá às formas que cria. */
export const PREFIXO_PINTURA = "Pintura";

const mudou = (slide: Slide, shapes: Shape[]): Slide => ({ ...slide, shapes });
const ehPintura = (s: Shape): boolean => (s.name ?? "").startsWith(PREFIXO_PINTURA);

/** A chave da camada de uma forma: o grupo (quando tem) ou o próprio id (forma solta). */
export const chaveDaForma = (s: Shape): string => s.grupo ?? s.id;

/**
 * As camadas da lâmina, de baixo para cima: cada grupo é uma camada; cada forma solta também (de
 * um membro só). É a lista que o painel mostra — a ordem é a ordem z das formas.
 */
export function camadasDe(slide: Slide): Camada[] {
  const porChave = new Map<string, Shape[]>();
  const ordem: string[] = [];
  for (const s of slide.shapes) {
    const chave = chaveDaForma(s);
    if (!porChave.has(chave)) {
      porChave.set(chave, []);
      ordem.push(chave);
    }
    porChave.get(chave)!.push(s);
  }
  return ordem.map((chave) => {
    const membros = porChave.get(chave)!;
    const primeiro = membros[0];
    return {
      id: chave,
      nome: primeiro.camada?.trim() || primeiro.name?.trim() || "Camada",
      membros,
      oculta: membros.every((m) => !!m.oculta),
      opacidade: primeiro.opacity ?? 1,
      pintura: membros.some(ehPintura),
      grupo: !!primeiro.grupo,
    };
  });
}

/** A camada que contém a forma (a chave), ou null. */
export function camadaDaForma(slide: Slide, formaId: string): string | null {
  const forma = slide.shapes.find((s) => s.id === formaId);
  return forma ? chaveDaForma(forma) : null;
}

/** Os ids que a camada abrange. */
export function idsDaCamada(slide: Slide, camada: string): string[] {
  return slide.shapes.filter((s) => chaveDaForma(s) === camada).map((s) => s.id);
}

/**
 * Cria uma camada com as formas escolhidas (`ids` vazio = toda a pintura da lâmina). O grupo
 * entra no lugar da forma que estava mais à frente — o mesmo critério do "Agrupar".
 */
export function criarCamada(slide: Slide, ids: string[], nome = "Camada"): Slide {
  const alvos = ids.length ? slide.shapes.filter((s) => ids.includes(s.id)) : slide.shapes.filter(ehPintura);
  if (alvos.length < 2) return slide;
  const chave = `cam${Date.now().toString(36)}${Math.round(Math.random() * 1e4).toString(36)}`;
  const dentro = new Set(alvos.map((s) => s.id));
  const membros = slide.shapes.filter((s) => dentro.has(s.id)).map((s) => ({ ...s, grupo: chave, camada: nome }));
  const ultimo = slide.shapes.reduce((acc, s, i) => (dentro.has(s.id) ? i : acc), -1);
  const antes = slide.shapes.slice(0, ultimo + 1).filter((s) => !dentro.has(s.id));
  return mudou(slide, [...antes, ...membros, ...slide.shapes.slice(ultimo + 1)]);
}

/** Renomeia a camada (o nome vive nas formas; a solta perde o nome). */
export function renomearCamada(slide: Slide, camada: string, nome: string): Slide {
  const limpo = nome.trim();
  return mudou(
    slide,
    slide.shapes.map((s) => (chaveDaForma(s) === camada ? { ...s, camada: limpo } : s))
  );
}

/** O olho: esconde/mostra a camada inteira. Escondida, ela não vai ao `.pptx`. */
export function esconderCamada(slide: Slide, camada: string, oculta: boolean): Slide {
  return mudou(
    slide,
    slide.shapes.map((s) => (chaveDaForma(s) === camada ? (oculta ? { ...s, oculta: true } : (({ oculta: _o, ...resto }) => resto)(s)) : s))
  );
}

/** A opacidade da camada inteira (0,05 a 1). */
export function opacidadeDaCamada(slide: Slide, camada: string, valor: number): Slide {
  const v = Math.max(0.05, Math.min(1, valor));
  return mudou(
    slide,
    slide.shapes.map((s) => (chaveDaForma(s) === camada ? { ...s, opacity: v } : s))
  );
}

/**
 * Move a camada uma posição na ordem (z): a camada sobe/desce INTEIRA, passando a vizinha de cima
 * ou de baixo. `direcao` 1 = para a frente (para cima na lista), -1 = para trás.
 */
export function moverCamada(slide: Slide, camada: string, direcao: 1 | -1): Slide {
  const lista = camadasDe(slide);
  const i = lista.findIndex((c) => c.id === camada);
  const j = i + direcao;
  if (i < 0 || j < 0 || j >= lista.length) return slide;
  // troca de lugar as duas camadas (as formas entram na ordem da lista nova)
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  const plano = [...nova.flatMap((c) => c.membros.map((m) => m.id))];
  const porId = new Map(slide.shapes.map((s) => [s.id, s]));
  return mudou(slide, plano.map((id) => porId.get(id)!).filter(Boolean));
}

/** Apaga a camada inteira. */
export function apagarCamada(slide: Slide, camada: string): Slide {
  const ficam = slide.shapes.filter((s) => chaveDaForma(s) !== camada);
  if (ficam.length === slide.shapes.length) return slide;
  return mudou(slide, ficam);
}

/**
 * Funde a camada na de BAIXO: os membros perdem o grupo próprio e passam a fazer parte da camada
 * de baixo (a forma de baixo da camada de baixo continua sendo o "dono" do nome e do estado).
 */
export function fundirParaBaixo(slide: Slide, camada: string): Slide {
  const lista = camadasDe(slide);
  const i = lista.findIndex((c) => c.id === camada);
  if (i <= 0) return slide;
  const baixo = lista[i - 1];
  const dentro = new Set(lista[i].membros.map((s) => s.id));
  const destino = baixo.grupo ? { grupo: baixo.id } : {};
  const nomeBaixo = baixo.membros[0].camada;
  return mudou(
    slide,
    slide.shapes.map((s) => {
      if (!dentro.has(s.id)) return s;
      const { grupo: _g, ...resto } = s;
      void _g;
      return { ...resto, ...destino, ...(nomeBaixo ? { camada: nomeBaixo } : {}) };
    })
  );
}

/** "Isolar a camada": esconde todas as outras (a de baixo e as de cima continuam na lâmina). */
export function isolarCamada(slide: Slide, camada: string): Slide {
  return mudou(
    slide,
    slide.shapes.map((s) => (chaveDaForma(s) === camada ? (({ oculta: _o, ...resto }) => resto)(s) : { ...s, oculta: true }))
  );
}

/** Mostra todas (o "ver tudo" do painel) e zera o "isolar". */
export function mostrarTodas(slide: Slide): Slide {
  return mudou(
    slide,
    slide.shapes.map((s) => (({ oculta: _o, ...resto }) => resto)(s))
  );
}
