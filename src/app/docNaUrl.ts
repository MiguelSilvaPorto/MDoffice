// O documento que uma janela própria deve abrir — vem na URL (`?doc=<caminho>&draft=1`).
// Módulo puro (sem DOM nem Tauri): é o contrato entre a janela que ENTREGA a aba e a que a recebe.

export interface PedidoDeJanela {
  /** caminho do arquivo (ou do rascunho guardado pelo app) */
  path: string;
  /** true quando o caminho é um rascunho do app (não um arquivo seu) */
  draft: boolean;
}

/** Lê o pedido da query string; `null` = janela normal (restaura a sessão). */
export function docDaUrl(busca: string): PedidoDeJanela | null {
  const q = new URLSearchParams(busca);
  const path = q.get("doc");
  if (!path) return null;
  return { path, draft: q.get("draft") === "1" };
}

/** A URL de uma janela para o documento (o inverso de `docDaUrl`). */
export function urlDoDocumento(pedido: PedidoDeJanela): string {
  const q = new URLSearchParams({ doc: pedido.path });
  if (pedido.draft) q.set("draft", "1");
  return `index.html?${q.toString()}`;
}
