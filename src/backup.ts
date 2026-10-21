// Ponte com o backup em disco (comandos Rust de `commands/backup.rs`).
//
// Duas camadas: o histórico de dentro do app (commits e versões, ver `snapshots.ts` e
// `history.ts`) e as cópias reais em disco, que sobrevivem a limpar os dados do app.

import { exportCommits, listCommits, type Commit } from "./snapshots";
import { CONFIG_PADRAO, carimbo, type BackupConfig } from "./backupPolicy";
import type { BackupEntry, BackupFile, BackupIndex, BackupWriteResult, IndexFile } from "./backupPolicy";
import { invoke, emApp } from "./ponte";

// a política e a apresentação (perfis, carimbo de data, tamanhos) ficam em backupPolicy.ts
export {
  CONFIG_PADRAO,
  PERFIS,
  carimbo,
  diaDeHoje,
  numerosDoPerfil,
  tamanhoLegivel,
  type BackupConfig,
  type Perfil,
} from "./backupPolicy";

// os tipos das cópias também (a interface e o disco do navegador usam os mesmos)
export type { BackupEntry, BackupFile, BackupIndex, BackupWriteResult, IndexFile };

/**
 * O app tem onde gravar o backup? (o Tauri, ou o navegador com uma pasta concedida)
 *
 * No navegador o backup vive em `.mdoffice/backups` DENTRO da pasta que a pessoa escolheu —
 * nada vai para uma pasta escondida do sistema, e o backup viaja junto com os documentos.
 */
export function temBackend(): boolean {
  return emApp();
}

export async function lerConfig(): Promise<BackupConfig> {
  if (!temBackend()) return { ...CONFIG_PADRAO };
  try {
    return await invoke<BackupConfig>("backup_config");
  } catch {
    return { ...CONFIG_PADRAO };
  }
}

export async function gravarConfig(cfg: BackupConfig): Promise<void> {
  if (!temBackend()) return;
  await invoke("backup_save_config", { config: cfg });
}

/** Pasta de backup da própria aplicação. */
export async function pastaDoApp(): Promise<string> {
  if (!temBackend()) throw new Error("O backup em disco precisa de uma pasta: este navegador não dá acesso ao disco.");
  return await invoke<string>("backup_app_root");
}

/** Cria/verifica a pasta escolhida pelo usuário e devolve o caminho. */
export async function prepararPasta(path: string): Promise<string> {
  return await invoke<string>("backup_prepare_root", { path });
}

/** Pastas de backup ativas. */
export async function pastasAtivas(): Promise<string[]> {
  if (!temBackend()) return [];
  try {
    return await invoke<string[]>("backup_roots");
  } catch {
    return [];
  }
}



/**
 * Grava uma cópia datada do documento nas duas pastas.
 *
 * Devolve o resultado para a interface saber se deu certo em todas (ou se alguma
 * falhou, por exemplo um HD externo desconectado).
 */
export async function gravar(path: string): Promise<BackupWriteResult> {
  if (!temBackend()) return { written: [], failed: [], skipped: false };
  try {
    return await invoke<BackupWriteResult>("backup_write", { path, stamp: carimbo() });
  } catch {
    return { written: [], failed: ["Não foi possível gravar o backup."], skipped: false };
  }
}

/** Cópias de um documento. */
export async function listar(path: string): Promise<BackupEntry> {
  if (!temBackend()) return { original: path, copies: [], bytes: 0, missing: false };
  try {
    return await invoke<BackupEntry>("backup_list", { path });
  } catch {
    return { original: path, copies: [], bytes: 0, missing: false };
  }
}

/** Copia uma das cópias de volta para o caminho original. */
export async function restaurar(path: string, root: string, name: string): Promise<string> {
  return await invoke<string>("backup_restore", { path, root, name });
}

/** Apaga uma cópia específica. */
export async function apagarCopia(path: string, root: string, name: string): Promise<void> {
  await invoke("backup_delete", { path, root, name });
}

/** Apaga as cópias antigas conforme a política. Devolve quantas saiu. */
export async function limpar(maxCopies: number, maxDays: number): Promise<number> {
  if (!temBackend()) return 0;
  return await invoke<number>("backup_prune", { maxCopies, maxDays });
}

/** Remove todas as cópias de um documento. */
export async function esquecer(path: string): Promise<number> {
  if (!temBackend()) return 0;
  try {
    return await invoke<number>("backup_forget", { path });
  } catch {
    return 0;
  }
}

/** Métricas de espaço de todos os documentos com backup (é o que o monitor vai ler). */
export async function indice(): Promise<BackupIndex> {
  if (!temBackend()) return { roots: [], files: [], copies: 0, bytes: 0 };
  try {
    return await invoke<BackupIndex>("backup_index");
  } catch {
    return { roots: [], files: [], copies: 0, bytes: 0 };
  }
}

/** Documentos com backup cujo original sumiu do disco. */
export async function sumidos(): Promise<BackupEntry[]> {
  if (!temBackend()) return [];
  try {
    return await invoke<BackupEntry[]>("backup_missing");
  } catch {
    return [];
  }
}

/** Documentos cujas cópias mais antigas já têm muitos dias. */
export async function antigos(minDays: number): Promise<IndexFile[]> {
  if (!temBackend()) return [];
  try {
    return await invoke<IndexFile[]>("backup_aged", { minDays });
  } catch {
    return [];
  }
}

// ---------- o log de alterações vai junto do backup ----------

/**
 * Exporta o log de alterações para a pasta de backup, junto da âncora.
 *
 * Se os dados do app forem limpos, o log volta do backup — o histórico não é só uma
 * aos dados do navegador.
 */
export async function exportarLog(doc: string): Promise<void> {
  if (!temBackend()) return;
  const commits = await listCommits(doc);
  if (!commits.length) return;
  const roots = await pastasAtivas();
  const json = exportCommits(commits);
  for (const root of roots) {
    try {
      await invoke("backup_save_history", { path: doc, root, json });
    } catch {
      // uma pasta pode estar indisponível: tenta a outra
    }
  }
}

/** Lê o log de alterações que veio do backup (null se ainda não houver). */
export async function lerLog(doc: string): Promise<string | null> {
  if (!temBackend()) return null;
  for (const root of await pastasAtivas()) {
    try {
      const json = await invoke<string | null>("backup_load_history", { path: doc, root });
      if (json) return json;
    } catch {
      // tenta a próxima
    }
  }
  return null;
}

/** Apaga o log exportado de um documento. */
export async function apagarLog(doc: string): Promise<void> {
  if (!temBackend()) return;
  for (const root of await pastasAtivas()) {
    try {
      await invoke("backup_clear_history", { path: doc, root });
    } catch {
      // ignora
    }
  }
}

export { type Commit };
