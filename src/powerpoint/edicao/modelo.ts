// O MODELO de box e as CÓPIAS VINCULADAS (Estúdio, fase 5).
//
// O caso do usuário: vários cartões parecidos (um por pessoa) com o nome diferente. Copiar e colar
// tudo de novo a cada mudança não serve — o que ele pediu foi **replicar sem copiar tudo**, podendo
// **desvincular algumas ligações** (o nome é de cada cópia; o logo, o fundo e a pintura seguem o
// modelo).
//
// Como o modelo funciona aqui:
//
// - a "unidade" é a **box e o que está dentro dela** (pela contenção do centro — o mesmo critério
//   das Regiões e dos Arranjos): não existe um "container" no motor, e inventar um seria mudar o
//   modelo de dados inteiro;
// - `Shape.ehModelo` marca as formas do MODELO (a raiz é o cartão: `ehModelo && !modelo`);
// - `Shape.modelo` guarda, em cada parte da cópia, o **id da parte do modelo** que ela segue — o
//   vínculo é por PARTE, não pela box toda;
// - `Shape.desvinculado` libera uma parte: ela deixa de seguir o modelo (e o app a desvincula
//   sozinha quando você a edita — explicado na hora, com o caminho de volta);
// - a **posição e o tamanho de cada cópia são livres**: a cópia anda e cresce como você quiser; as
//   partes seguem o **arranjo** do modelo (o mesmo lugar relativo dentro do cartão), sem escala
//   automática — está dito no doc do módulo.
//
// Tudo puro sobre o `Slide`: quem aplica é o host.

import type { Shape, Slide } from "../schema";
import type { Dim, Ponto } from "./regioes";
import { poligonoDaForma, pontoDentro } from "./regioes";

/** Os campos que o vínculo NÃO copia (a identidade e o estado de edição de cada cópia). */
const NAO_SEGUEM = new Set(["id", "box", "modelo", "desvinculado", "ehModelo", "camada", "oculta", "grupo", "name", "tinta", "liga"]);

const mudou = (slide: Slide, shapes: Shape[]): Slide => ({ ...slide, shapes });

const centroDaForma = (s: Shape, d: Dim): Ponto => ({ x: ((s.box.x + s.box.w / 2) / 100) * d.w, y: ((s.box.y + s.box.h / 2) / 100) * d.h });

/** A unidade da box: ela e as formas cujo centro está dentro do contorno dela (na ordem da lâmina). */
export function unidadesDaBox(slide: Slide, boxId: string, d: Dim): string[] {
  const caixa = slide.shapes.find((s) => s.id === boxId);
  if (!caixa) return [];
  const contorno = poligonoDaForma(caixa, d);
  const dentro = contorno ? slide.shapes.filter((s) => s.id !== boxId && pontoDentro(centroDaForma(s, d), contorno)).map((s) => s.id) : [];
  return [boxId, ...dentro];
}

/** O cartão do MODELO (a raiz: é ele que a cópia segue primeiro). */
export const cardDoModelo = (slide: Slide): Shape | undefined => slide.shapes.find((s) => s.ehModelo && !s.modelo);

/** O cartão da cópia que aponta para o modelo dado. */
export const cardDaCopia = (slide: Slide, modeloRootId: string): Shape | undefined =>
  slide.shapes.find((s) => s.modelo === modeloRootId && !s.ehModelo);

/** A forma é uma parte de cópia vinculada ao modelo? */
export const ehParteDeCopia = (s: Shape): boolean => !!s.modelo && !s.ehModelo;

/** A forma pertence a um modelo (cartão ou parte)? */
export const ehDoModelo = (s: Shape): boolean => !!s.ehModelo;

/** Marca a box escolhida (e o conteúdo dela) como MODELO. */
export function criarModelo(slide: Slide, boxId: string, d: Dim): Slide {
  const unidade = new Set(unidadesDaBox(slide, boxId, d));
  if (!unidade.size || slide.shapes.every((s) => unidade.has(s.id) ? s.ehModelo : true)) return slide;
  return mudou(
    slide,
    slide.shapes.map((s) => (unidade.has(s.id) ? { ...s, ehModelo: true } : s))
  );
}

/**
 * Tira a marca de modelo da box escolhida. As CÓPIAS que apontavam para as partes dela ficam
 * soltas (perdem o vínculo) — a referência deixou de existir.
 */
export function desfazerModelo(slide: Slide, boxId: string, d: Dim): Slide {
  const unidade = new Set(unidadesDaBox(slide, boxId, d));
  const modeloIds = new Set(slide.shapes.filter((s) => unidade.has(s.id) && s.ehModelo).map((s) => s.id));
  if (!modeloIds.size) return slide;
  return mudou(
    slide,
    slide.shapes.map((s) => {
      if (modeloIds.has(s.id)) {
        const { ehModelo: _m, ...resto } = s;
        void _m;
        return resto;
      }
      if (s.modelo && modeloIds.has(s.modelo)) {
        const { modelo: _x, desvinculado: _d, ...resto } = s;
        void _x;
        void _d;
        return resto;
      }
      return s;
    })
  );
}

/**
 * Uma CÓPIA VINCULADA da box escolhida: duplica a unidade (o cartão e o conteúdo) deslocada em % da
 * lâmina, com cada parte apontando para a parte do MODELO. A cópia entra logo depois da origem.
 */
export function novaCopia(slide: Slide, boxId: string, d: Dim, dx = 6, dy = 6): { slide: Slide; card: string; novos: string[] } {
  const caixa = slide.shapes.find((s) => s.id === boxId);
  const unidade = unidadesDaBox(slide, boxId, d);
  if (!caixa || !unidade.length) return { slide, card: "", novos: [] };
  const dentro = new Set(unidade);
  const origem = slide.shapes.filter((s) => dentro.has(s.id));
  const selo = Date.now().toString(36);
  // o deslocamento vale para a UNIDADE inteira (com o limite da lâmina calculado no conjunto —
  // prender cada forma por si só desalinharia o conteúdo do cartão)
  const x0 = Math.min(...origem.map((s) => s.box.x));
  const y0 = Math.min(...origem.map((s) => s.box.y));
  const largura = Math.max(...origem.map((s) => s.box.x + s.box.w)) - x0;
  const altura = Math.max(...origem.map((s) => s.box.y + s.box.h)) - y0;
  const passoX = Math.max(-x0, Math.min(100 - largura - x0, dx));
  const passoY = Math.max(-y0, Math.min(100 - altura - y0, dy));
  const novos: Shape[] = origem.map((s, i) => ({
    ...s,
    id: `${s.id}-c${selo}${i}`,
    box: { ...s.box, x: s.box.x + passoX, y: s.box.y + passoY },
    modelo: s.id,
    ehModelo: undefined,
    desvinculado: undefined,
    // a cópia nasce SOLTA de camada: quem quiser agrupa a pintura dela depois (o grupo do modelo
    // não pode ser herdado, senão mover a camada moveria as duas)
    grupo: undefined,
  }));
  const card = novos.find((n) => n.modelo === boxId)?.id ?? "";
  const ultimo = slide.shapes.reduce((acc, s, i) => (dentro.has(s.id) ? i : acc), -1);
  const antes = slide.shapes.slice(0, ultimo + 1).filter((s) => !dentro.has(s.id));
  const depois = slide.shapes.slice(ultimo + 1);
  return { slide: mudou(slide, [...antes, ...origem, ...novos, ...depois]), card, novos: novos.map((n) => n.id) };
}

/** As partes de uma cópia (o cartão e o conteúdo que segue o modelo), na ordem da lâmina. */
export function partesDaCopia(slide: Slide, cardId: string, d: Dim): string[] {
  return unidadesDaBox(slide, cardId, d).filter((id) => {
    const s = slide.shapes.find((x) => x.id === id);
    return !!s && ehParteDeCopia(s);
  });
}

/** Desvincula as partes escolhidas: elas deixam de seguir o modelo (viram próprias da cópia). */
export function desvincular(slide: Slide, ids: string[]): Slide {
  const alvo = new Set(ids);
  if (!slide.shapes.some((s) => alvo.has(s.id) && ehParteDeCopia(s) && !s.desvinculado)) return slide;
  return mudou(
    slide,
    slide.shapes.map((s) => (alvo.has(s.id) && ehParteDeCopia(s) ? { ...s, desvinculado: true } : s))
  );
}

/** Re-vincula as partes escolhidas e já traz o que o modelo tem agora. */
export function revincular(slide: Slide, ids: string[], d: Dim): Slide {
  const alvo = new Set(ids);
  if (!slide.shapes.some((s) => alvo.has(s.id) && s.desvinculado)) return slide;
  const semFlag = mudou(
    slide,
    slide.shapes.map((s) => {
      if (!alvo.has(s.id) || !s.desvinculado) return s;
      const { desvinculado: _d, ...resto } = s;
      void _d;
      return resto;
    })
  );
  return sincronizarCopias(semFlag, d);
}

/** Os campos que o vínculo copia (é o que a sincronização compara para saber se mudou algo). */
const CAMPOS_QUE_SEGUEM: (keyof Shape)[] = [
  "kind", "text", "paras", "fontFamily", "fontSize", "color", "bold", "italic", "align", "anchor", "ins", "wrap", "vert", "autofit",
  "fill", "fillX", "ln", "shadow", "geom", "adj", "cantos", "paths", "src", "crop", "rot", "flipH", "flipV", "opacity",
];

/** A cópia já está igual ao que a sincronização escreveria? (compara só o que ela escreve) */
const igual = (a: Shape, b: Shape): boolean => a.box.x === b.box.x && a.box.y === b.box.y && a.box.w === b.box.w && a.box.h === b.box.h && CAMPOS_QUE_SEGUEM.every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));

/**
 * SINCRONIZA as cópias com o modelo: cada parte vinculada (sem `desvinculado`) recebe o CONTEÚDO do
 * modelo e o **arranjo** dele dentro do cartão da cópia. O cartão da cópia mantém a caixa dele
 * (posição e tamanho são livres por cópia).
 *
 * Devolve o MESMO slide quando nada mudou (o host usa isso para não redesenhar à toa).
 */
export function sincronizarCopias(slide: Slide, d: Dim): Slide {
  const root = cardDoModelo(slide);
  if (!root) return slide;
  const cardC = cardDaCopia(slide, root.id);
  const index = new Map(slide.shapes.map((s) => [s.id, s]));
  if (!cardC || !slide.shapes.some((s) => ehParteDeCopia(s))) return slide;
  let mudouAlgo = false;
  const shapes = slide.shapes.map((s) => {
    if (!ehParteDeCopia(s) || s.desvinculado) return s;
    const modelo = index.get(s.modelo!);
    if (!modelo || !modelo.ehModelo) return s;
    const conteudo: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(modelo)) {
      if (NAO_SEGUEM.has(k)) continue;
      conteudo[k] = v;
    }
    const relX = modelo.box.x - root.box.x;
    const relY = modelo.box.y - root.box.y;
    const box = s.id === cardC.id ? s.box : { x: cardC.box.x + relX, y: cardC.box.y + relY, w: modelo.box.w, h: modelo.box.h };
    const novo: Shape = {
      ...modelo,
      ...(conteudo as Partial<Shape>),
      id: s.id,
      box,
      modelo: s.modelo,
      ehModelo: undefined,
      desvinculado: undefined,
      camada: s.camada,
      oculta: s.oculta,
      name: s.name,
    };
    // a identidade do modelo não desce para a cópia (o `ehModelo` acima já sai limpo)
    delete (novo as { ehModelo?: boolean }).ehModelo;
    delete (novo as { desvinculado?: boolean }).desvinculado;
    if (igual(novo, s)) return s;
    mudouAlgo = true;
    return novo;
  });
  return mudouAlgo ? mudou(slide, shapes) : slide;
}

/** As formas escolhidas têm parte vinculada que dá para desvincular? */
export const podeDesvincular = (slide: Slide, ids: string[]): boolean => slide.shapes.some((s) => ids.includes(s.id) && ehParteDeCopia(s) && !s.desvinculado);

/** As formas escolhidas têm parte desvinculada que dá para re-vincular? */
export const podeRevincular = (slide: Slide, ids: string[]): boolean => slide.shapes.some((s) => ids.includes(s.id) && !!s.desvinculado);

/** A lâmina tem modelo e/ou cópias? (o atalho do host para não sincronizar à toa) */
export const temModelo = (slide: Slide): boolean => slide.shapes.some((s) => !!s.ehModelo || ehParteDeCopia(s));
