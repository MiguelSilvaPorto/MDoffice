// Modelos de apresentação criados pelo usuário: ficam no armazenamento local do app
// (não viajam no documento) e aparecem no mesmo popup do botão Template, junto dos presets.
import type { DeckSetup, Slide } from "./schema";
import { modeloDoDeck, type ModeloPPT } from "./edicao/modelos";

const CHAVE = "mdc.pp.modelosUsuario";

/** Lista os modelos do usuário (tolera armazenamento vazio ou corrompido). */
export function lerModelosUsuario(): ModeloPPT[] {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return [];
    const lista = JSON.parse(bruto) as ModeloPPT[];
    return Array.isArray(lista) ? lista.filter((m) => m && typeof m.id === "string" && typeof m.nome === "string" && !!m.tema) : [];
  } catch {
    return [];
  }
}

/** Grava a lista inteira. Devolve `false` quando o armazenamento recusa (cheio, bloqueado). */
export function gravarModelosUsuario(lista: ModeloPPT[]): boolean {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(lista));
    return true;
  } catch {
    /* sem armazenamento */
    return false;
  }
}

/**
 * Cria um modelo a partir do deck atual e o guarda no fim da lista.
 * Nome repetido ganha um sufixo (2, 3…) para não confundir na hora de aplicar.
 * Devolve `null` quando o armazenamento recusa a gravação — o modelo não existiria depois e o
 * host precisa dizer isso, em vez de comemorar um modelo que sumiu.
 */
export function criarModeloUsuario(slides: Slide[], setup: DeckSetup, nome: string): ModeloPPT | null {
  const lista = lerModelosUsuario();
  const base = (nome ?? "").trim() || "Meu modelo";
  let nomeFinal = base;
  let n = 2;
  while (lista.some((m) => m.nome.toLowerCase() === nomeFinal.toLowerCase())) nomeFinal = `${base} ${n++}`;
  const modelo = modeloDoDeck(slides, setup, nomeFinal, `usuario-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  return gravarModelosUsuario([...lista, modelo]) ? modelo : null;
}

/** Remove um modelo do usuário pelo id. Devolve `false` quando o armazenamento recusou a gravação. */
export function removerModeloUsuario(id: string): boolean {
  return gravarModelosUsuario(lerModelosUsuario().filter((m) => m.id !== id));
}
