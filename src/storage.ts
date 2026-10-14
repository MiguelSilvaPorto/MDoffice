// Armazenamento: quanto o app ocupa no disco, a limpeza do legado da renomeação e o limite
// do cache do WebView. (As versões e o log de alterações vivem no IndexedDB — os resumos deles
// ficam em history.ts e snapshots.ts; o backup e os rascunhos têm os próprios módulos.)
import { invoke } from "@tauri-apps/api/core";

export interface StorageReport {
  /** pasta de dados atual do app */
  data_dir: string;
  /** tamanho total dela (inclui o cache do WebView) */
  data_bytes: number;
  /** só o cache do WebView, dentro da pasta de dados */
  cache_bytes: number;
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

export interface CacheConfig {
  /** teto pedido para o cache do WebView, em MB (0 = automático) */
  limite_mb: number;
  /** teto que a janela desta sessão recebeu, em MB (0 = automático) */
  aplicado_mb: number;
}

/** O teto do cache do WebView e o que está valendo nesta sessão (MB; 0 = automático). */
export async function limiteDoCache(): Promise<CacheConfig> {
  return await invoke<CacheConfig>("storage_cache_config");
}

/** Grava o teto do cache (MB). Vale na próxima abertura do app. */
export async function definirLimiteDoCache(limiteMb: number): Promise<CacheConfig> {
  return await invoke<CacheConfig>("storage_set_cache_limit", { limiteMb });
}
