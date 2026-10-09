// Política e apresentação do backup, sem depender de nada: só contas e textos.
//
// Fica separado de `backup.ts` (que fala com o backend) para poder ser testado sozinho
// e para deixar claro o que é decisão de política e o que é chamada ao Rust.

/** Configuração do backup, espelhada no `backup.json` que o backend grava. */
export interface BackupConfig {
  enabled: boolean;
  /** guarda a cópia do estado anterior a cada novo backup */
  protect: boolean;
  /** pasta escolhida pelo usuário (null = só a pasta do app) */
  user_root: string | null;
  /** cópias por arquivo (0 = sem limite) */
  max_copies: number;
  /** dias para manter (0 = não apaga por tempo) */
  max_days: number;
}

export type Perfil = "leve" | "equilibrado" | "maximo" | "personalizado";

/**
 * Perfis de segurança: quanto cada documento guarda.
 *
 * Nenhum perfil tem teto de espaço em disco — a limpeza é só por quantidade e prazo.
 * Um monitor de espaço (ainda por vir) vai ler o índice e recomendar o que apagar.
 */
export const PERFIS: { id: Perfil; nome: string; desc: string; copias: number; dias: number }[] = [
  { id: "leve", nome: "Leve", desc: "Guarda pouco e por pouco tempo. Basta para o dia a dia.", copias: 10, dias: 7 },
  {
    id: "equilibrado",
    nome: "Equilibrado",
    desc: "Cópias de um mês, até 50 por documento. Cobre a maioria dos imprevistos.",
    copias: 50,
    dias: 30,
  },
  {
    id: "maximo",
    nome: "Máxima segurança",
    desc: "Quase tudo por um ano, até 200 cópias por documento.",
    copias: 200,
    dias: 365,
  },
  { id: "personalizado", nome: "Personalizado", desc: "Você mesmo define a quantidade e o prazo.", copias: 50, dias: 30 },
];

export const CONFIG_PADRAO: BackupConfig = {
  enabled: true,
  protect: true,
  user_root: null,
  max_copies: 50,
  max_days: 30,
};

/** Números do perfil escolhido (personalizado usa os valores da configuração). */
export function numerosDoPerfil(perfil: Perfil, maxCopies: number, maxDays: number): { copias: number; dias: number } {
  if (perfil === "personalizado") return { copias: maxCopies, dias: maxDays };
  const p = PERFIS.find((x) => x.id === perfil);
  return { copias: p?.copias ?? 50, dias: p?.dias ?? 30 };
}

/** Data/hora local no formato do nome de arquivo (`2026-10-09_10-42-13`). */
export function carimbo(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  );
}

/** O dia de hoje (`2026-10-09`), para marcar o backup diário. */
export function diaDeHoje(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Tamanho legível para a interface ("2 KB", "5.0 MB", "3.00 GB"). */
export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}