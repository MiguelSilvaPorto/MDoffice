// Armazenamento: quanto o app ocupa, estimado pelo próprio navegador.
//
// Até a W3 este módulo lia a pasta de dados do Windows (e o cache do WebView) pelo backend
// Rust. Agora o que o app guarda vive no navegador (IndexedDB, Cache Storage e localStorage)
// e na pasta concedida — e o tamanho de tudo isso quem sabe é o `navigator.storage.estimate()`.

export interface StorageReport {
  /** rótulo do que está sendo medido (o navegador não expõe caminho absoluto) */
  data_dir: string;
  /** bytes usados por esta origem (IndexedDB, cache e armazenamento local) */
  data_bytes: number;
  /** quota que o navegador concede, em bytes (0 = desconhecida) */
  quota_bytes: number;
  cache_bytes: number;
  legacy_dir: string | null;
  legacy_bytes: number;
}

/** Relatório do armazenamento do app (o que o navegador informa). */
export async function relatorio(): Promise<StorageReport> {
  let uso = 0;
  let quota = 0;
  try {
    const estimativa = await navigator.storage?.estimate?.();
    uso = estimativa?.usage ?? 0;
    quota = estimativa?.quota ?? 0;
  } catch {
    /* navegador sem a API: fica zerado, e a tela diz que não há número */
  }
  return {
    data_dir: "Este navegador (IndexedDB e cache)",
    data_bytes: uso,
    quota_bytes: quota,
    cache_bytes: 0,
    legacy_dir: null,
    legacy_bytes: 0,
  };
}
