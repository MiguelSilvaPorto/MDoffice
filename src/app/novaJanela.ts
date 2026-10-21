// Abrir um documento numa janela própria: é o que a aba arrastada para fora vira.
//
// No navegador é uma janela nova (ou uma aba, se o navegador preferir); no PWA instalado,
// uma janela do próprio app. O documento é identificado na URL (`?doc=<id>`).
import { toast } from "../util";
import { urlDoDocumento, type PedidoDeJanela } from "./docNaUrl";

/** Abre o documento numa janela independente. Devolve false quando não deu (a aba fica onde está). */
export function abrirEmNovaJanela(pedido: PedidoDeJanela, _titulo: string): boolean {
  const url = urlDoDocumento(pedido);
  const janela = window.open(url, "_blank", "width=1280,height=860");
  if (!janela) toast("O navegador bloqueou a janela — libere pop-ups para este endereço.", "info", 6000);
  return !!janela;
}
