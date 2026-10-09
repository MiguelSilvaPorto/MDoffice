// Livro de planilha: o estado em memória, a cópia para o rascunho/histórico e
// as operações de aba (nova, duplicar, excluir, mover, renomear).
// Mesmo papel do src/powerpoint/model.ts.

import { type Celula, type ConfigPlanilha, type Folha, type Livro } from "./schema";

export const CONFIG_PADRAO: ConfigPlanilha = {
  grade: true,
  zoom: 100,
  casas: 2,
  moeda: "R$",
};

/** Texto (JSON) guardado no rascunho e no histórico. */
export interface LivroSnapshot {
  v: 1;
  config: ConfigPlanilha;
  livro: Livro;
}

export function serialize(livro: Livro, config: ConfigPlanilha): string {
  const snap: LivroSnapshot = { v: 1, config, livro };
  return JSON.stringify(snap);
}

export function deserialize(texto: string): LivroSnapshot | null {
  try {
    const snap = JSON.parse(texto) as Partial<LivroSnapshot>;
    if (!snap || !snap.livro || !Array.isArray(snap.livro.folhas) || !snap.livro.folhas.length) return null;
    const folhas = snap.livro.folhas.map((f) => ({
      nome: f.nome || "Planilha1",
      celulas: f.celulas ?? {},
      colunas: f.colunas ?? {},
      linhas: f.linhas ?? {},
      mesclas: Array.isArray(f.mesclas) ? f.mesclas : [],
      congelado: f.congelado,
    }));
    return {
      v: 1,
      config: { ...CONFIG_PADRAO, ...(snap.config ?? {}) },
      livro: { folhas, ativa: Math.max(0, Math.min(folhas.length - 1, snap.livro.ativa ?? 0)) },
    };
  } catch {
    return null;
  }
}

// ---------- abas ----------

/** Excel não deixaUltrapassar 31 caracteres nem usar : \ / ? * [ ] no nome. */
export function limparNomeAba(nome: string): string {
  const limpo = nome.replace(/[:\\/?*[\]]/g, "-").trim().slice(0, 31);
  return limpo || "Planilha";
}

/** Nome livre dentro do livro (igual Planilha1, Planilha2…). */
export function nomeLivre(folhas: Folha[], base = "Planilha"): string {
  const usadas = new Set(folhas.map((f) => f.nome.toLowerCase()));
  for (let i = 1; i < 9999; i++) {
    const nome = `${base}${i}`;
    if (!usadas.has(nome.toLowerCase())) return nome;
  }
  return `${base} ${Date.now()}`;
}

export function novaFolha(nome = "Planilha1"): Folha {
  return { nome: limparNomeAba(nome), celulas: {}, colunas: {}, linhas: {}, mesclas: [] };
}

export function duplicarFolha(f: Folha, nome: string): Folha {
  return {
    nome: limparNomeAba(nome),
    celulas: structuredClone(f.celulas),
    colunas: { ...f.colunas },
    linhas: { ...f.linhas },
    mesclas: [...f.mesclas],
    congelado: f.congelado ? { ...f.congelado } : undefined,
  };
}

/** Insere uma aba depois da posição dada. */
export function inserirFolha(livro: Livro, pos: number, folha: Folha): { livro: Livro; indice: number } {
  const folhas = [...livro.folhas];
  const indice = Math.max(0, Math.min(folhas.length, pos));
  folhas.splice(indice, 0, folha);
  return { livro: { ...livro, folhas, ativa: indice }, indice };
}

export function removerFolha(livro: Livro, indice: number): { livro: Livro; indice: number } {
  const folhas = livro.folhas.filter((_, i) => i !== indice);
  if (!folhas.length) folhas.push(novaFolha()); // o livro nunca fica sem aba
  const ativa = Math.max(0, Math.min(folhas.length - 1, indice > livro.ativa ? livro.ativa - 1 : livro.ativa));
  return { livro: { ...livro, folhas, ativa }, indice: ativa };
}

/** Move a aba de `de` para `para` (índices na posição atual). */
export function moverFolha(livro: Livro, de: number, para: number): Livro {
  const folhas = [...livro.folhas];
  const [f] = folhas.splice(de, 1);
  folhas.splice(Math.max(0, Math.min(folhas.length, para)), 0, f);
  const ativaAntiga = livro.ativa;
  let ativa = ativaAntiga;
  if (ativaAntiga === de) ativa = para;
  else if (de < ativaAntiga && para >= ativaAntiga) ativa = ativaAntiga - 1;
  else if (de > ativaAntiga && para <= ativaAntiga) ativa = ativaAntiga + 1;
  return { ...livro, folhas, ativa: Math.max(0, Math.min(folhas.length - 1, ativa)) };
}

/** Renomeia a aba mantendo os nomes únicos. */
export function renomearFolha(livro: Livro, indice: number, nome: string): Livro {
  const atual = livro.folhas[indice];
  if (!atual) return livro;
  const folhas = [...livro.folhas];
  const proprio = new Set(folhas.filter((_, i) => i !== indice).map((f) => f.nome.toLowerCase()));
  let alvo = limparNomeAba(nome);
  if (proprio.has(alvo.toLowerCase())) alvo = `${alvo} (${indice + 1})`.slice(0, 31);
  folhas[indice] = { ...atual, nome: alvo };
  return { ...livro, folhas };
}

// ---------- células ----------

/** Uma célula vazia (o mesmo objeto para não ocupar memória). */
export const VAZIA: Celula = { texto: "" };

/** A célula está de fato vazia (pode ser apagada para aliviar o arquivo)? */
export const ehVazia = (c: Celula | undefined): boolean => !c || (!c.texto && !c.estilo);

/** Quantas células com texto a aba tem (sem contar as que só têm estilo). */
export function contarPreenchidas(f: Folha): number {
  return Object.values(f.celulas).filter((c) => !!c.texto).length;
}

/** Texto de uma célula (o que se vê quando abre a barra de fórmulas). */
export const textoDe = (f: Folha, refA1: string): string => f.celulas[refA1]?.texto ?? "";

/** Resumo para o rodapé e para a barra de título. */
export function resumo(livro: Livro, config: ConfigPlanilha): string {
  const n = livro.folhas.length;
  const usadas = livro.folhas.reduce((t, f) => t + contarPreenchidas(f), 0);
  return `${n} aba${n === 1 ? "" : "s"} · ${usadas} célula${usadas === 1 ? "" : "s"} preenchida${
    usadas === 1 ? "" : "s"
  } · ${config.zoom}%`;
}

/**
 * Livro de exemplo que "Novo" abre: um orçamento simples, com fórmula de total —
 * é o que mostra ao usuário que o motor calcula de verdade.
 */
export function livroDeExemplo(): { livro: Livro; config: ConfigPlanilha } {
  const f = novaFolha("Orçamento");
  const celulas: Record<string, Celula> = {};
  const linha = (r: number, valores: (string | number)[], estilos: (Celula["estilo"] | undefined)[] = []) => {
    valores.forEach((v, i) => {
      const estilo = estilos[i];
      const texto = typeof v === "number" ? String(v).replace(".", ",") : v;
      celulas[refDe(r, i)] = { texto, estilo };
    });
  };
  const cab = { negrito: true, fundo: "E8F0FE", alinhamento: "centro" as const };
  linha(0, ["Item", "Categoria", "Quantidade", "Valor unitário", "Total"], [cab, cab, cab, cab, cab]);
  const dados: [string, string, number, number][] = [
    ["Desenvolvimento", "Pessoal", 2, 5200],
    ["Infraestrutura", "Servidores", 1, 1800],
    ["Licenças", "Tecnologia", 4, 320],
    ["Suporte mensal", "Operação", 1, 950],
  ];
  dados.forEach(([item, cat, qtd, valor], i) => {
    const r = i + 1;
    linha(
      r,
      [item, cat, qtd, valor, `=C${r + 1}*D${r + 1}`],
      [undefined, undefined, { numero: "decimal" }, { numero: "moeda" }, { numero: "moeda" }]
    );
  });
  // linha de totais: o rótulo ocupa A6:D6 mesclado e E6 traz a fórmula
  f.mesclas = ["A6:D6"];
  celulas.A6 = { texto: "Total geral", estilo: { negrito: true, fundo: "F1F5F9" } };
  celulas.E6 = {
    texto: "=SOMA(E2:E5)",
    formula: true,
    estilo: { negrito: true, numero: "moeda", fundo: "F1F5F9" },
  };
  f.celulas = celulas;
  f.colunas = { 0: 210, 3: 120, 4: 120 };
  f.congelado = { colunas: 0, linhas: 1 };
  const f2 = novaFolha("Notas");
  f2.celulas = {
    A1: {
      texto: "Como esta planilha funciona",
      estilo: { negrito: true },
    },
    A3: {
      texto: "Clique numa célula e digite. Comece com = para escrever uma fórmula, como =SOMA(E2:E5).",
    },
    A4: {
      texto: "Números aceitos 1.234,56 (ou 1234.56), datas dd/mm/aaaa, moeda R$ e porcentagem 15%.",
    },
    A5: { texto: "Use a fita acima para formatar, somar e ajustar colunas. Ctrl+S grava um .xlsx de verdade." },
  };
  return { livro: { folhas: [f, f2], ativa: 0 }, config: { ...CONFIG_PADRAO } };
}

/** "linha de tela, coluna de tela" -> "A1" (0-based -> ref). */
function refDe(linha: number, col: number): string {
  let s = "";
  let n = col;
  for (;;) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
    if (n < 0) break;
  }
  return `${s}${linha + 1}`;
}