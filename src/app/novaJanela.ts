// Abrir um documento numa janela própria: é o que a aba arrastada para fora vira.
// No app (Tauri) é uma janela de verdade; no navegador de desenvolvimento, uma janela do navegador.
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { temBackend } from "../backup";
import { toast } from "../util";
import { urlDoDocumento, type PedidoDeJanela } from "./docNaUrl";

/** Abre o documento numa janela independente. Devolve false quando não deu (a aba fica onde está). */
export function abrirEmNovaJanela(pedido: PedidoDeJanela, titulo: string): boolean {
  const url = urlDoDocumento(pedido);
  if (temBackend()) {
    try {
      // a janela nova começa pelo mesmo app; o `?doc=` faz ela abrir SÓ este documento
      // (a sessão das outras janelas não é restaurada nem sobrescrita)
      const janela = new WebviewWindow(`doc-${Date.now()}`, {
        url,
        title: titulo,
        width: 1280,
        height: 860,
        minWidth: 720,
        minHeight: 480,
      });
      void janela.once("tauri://error", (e) => {
        const detalhe = String((e as { payload?: unknown } | null)?.payload ?? e);
        toast(`Não consegui abrir a janela: ${detalhe}`, "err", 6000);
      });
      return true;
    } catch (e) {
      toast(`Não consegui abrir a janela: ${String(e)}`, "err", 6000);
      return false;
    }
  }
  // navegador (desenvolvimento): uma janela do navegador com o mesmo endereço
  const janela = window.open(url, "_blank", "width=1280,height=860");
  if (!janela) toast("O navegador bloqueou a janela — libere pop-ups para este endereço.", "info", 6000);
  return !!janela;
}
