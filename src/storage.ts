// Armazenamento: quanto o app ocupa no disco e a limpeza do legado da renomeação.
// (As versões e o log de alterações vivem no IndexedDB — os resumos deles ficam em
// history.ts e snapshots.ts; o backup e os rascunhos têm os próprios módulos.)
import { invoke } from "@tauri-apps/api/core";

export interface StorageReport {
  /** pasta de dados atual do app */
  data_dir: string;
  /** tamanho total dela (inclui o cache do WebView) */
  data_bytes: number;
  /** pasta da versão anterior (mdCreator), quando ainda existe */
  legacy_dir: string | null;
  legacy_bytes: number;
}

/** Relatório das pastas do app (dados atuais + pasta da versão anterior). */
export async function relatorio(): Promise<StorageReport> {
  return await invoke<StorageReport>("storage_report");
}

/** Remove a pasta da versão anterior. Devolve quantos bytes foram liberados. */
export async function removerLegado(): Promise<number> {
  return await invoke<number>("storage_remove_legacy");
}
