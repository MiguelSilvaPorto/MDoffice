// F4 — o aprendizado do corretor num arquivo: exportar e importar para levar de um computador
// para outro (ou guardar uma cópia) sem espalhar texto.
//
// O arquivo é um JSON pequeno e legível com os NÚMEROS do aprendizado (trocas, classes de erro,
// calibragem, termos e métricas) mais o dicionário pessoal. Nenhum documento entra aqui: a única
// "informação" é a palavra que o app já aprendeu a não marcar.
import * as aprendido from "../aprendizado";
import * as classes from "../spell/classeErro";
import * as decisao from "../spell/decisao";
import * as termos from "./termos";
import * as metricas from "./metricas";

export const VERSAO = 1;

const KEY_DICIONARIO = "mdc.ignore-words";

function lerDicionario(): string[] {
  try {
    const bruto = localStorage.getItem(KEY_DICIONARIO);
    const lista = bruto ? (JSON.parse(bruto) as unknown) : [];
    return Array.isArray(lista) ? lista.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function gravarDicionario(palavras: string[]): void {
  try {
    localStorage.setItem(KEY_DICIONARIO, JSON.stringify(palavras));
  } catch {
    /* sem armazenamento */
  }
}

/** O aprendizado inteiro como texto JSON (para baixar num arquivo). */
export function exportarAprendizado(): string {
  return JSON.stringify(
    {
      app: "mdoffice",
      tipo: "aprendizado-do-corretor",
      versao: VERSAO,
      quando: new Date().toISOString(),
      corretor: {
        pares: aprendido.dadosAprendizado(),
        classes: classes.dadosClasses(),
        calibragem: decisao.calibragem(),
        termos: termos.dadosTermos(),
        metricas: metricas.dadosMetricas(),
      },
      dicionario: lerDicionario(),
    },
    null,
    2
  );
}

export interface ResultadoImportacao {
  ok: boolean;
  /** o que entrou (quando deu certo) */
  resumo?: string;
  /** o dicionário pessoal do arquivo (o app recarrega o dele com isto) */
  dicionario?: string[];
  erro?: string;
}

/**
 * Lê um arquivo de aprendizado e repõe os dados (o arquivo SUBSTITUI o aprendizado atual).
 * Devolve o dicionário do arquivo para o app recarregar o seu.
 */
export function importarAprendizado(texto: string): ResultadoImportacao {
  try {
    const d = JSON.parse(texto) as {
      app?: string;
      tipo?: string;
      versao?: number;
      corretor?: { pares?: unknown; classes?: unknown; calibragem?: unknown; termos?: unknown; metricas?: unknown };
      dicionario?: unknown;
    };
    if (d?.app !== "mdoffice" || d?.tipo !== "aprendizado-do-corretor") {
      return { ok: false, erro: "Este arquivo não é um aprendizado do mdOffice." };
    }
    if (d.versao !== VERSAO) {
      return { ok: false, erro: `O arquivo é da versão ${d.versao ?? "?"} e esta cópia entende a versão ${VERSAO}.` };
    }
    const c = d.corretor ?? {};
    const pares = aprendido.restaurarAprendizado(c.pares ?? []);
    const nClasses = classes.restaurarClasses(c.classes ?? {});
    decisao.restaurarCalibragem(c.calibragem ?? { ok: 0, ruim: 0 });
    const nTermos = termos.restaurarTermos(c.termos ?? { v: 1, itens: {} });
    metricas.restaurarMetricas(c.metricas ?? {});
    const dicionario = Array.isArray(d.dicionario) ? d.dicionario.filter((p): p is string => typeof p === "string") : [];
    gravarDicionario(dicionario);
    return {
      ok: true,
      resumo: `${pares} troca(s), ${nClasses} classe(s) de erro, ${nTermos} termo(s) e ${dicionario.length} palavra(s) no dicionário.`,
      dicionario,
    };
  } catch (e) {
    return { ok: false, erro: "Não consegui ler o arquivo: " + (e instanceof Error ? e.message : String(e)) };
  }
}
