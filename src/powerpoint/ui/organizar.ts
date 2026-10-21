// O menu "Organizar" (ordem, alinhamento, grupo, giro e bloqueio).
//
// É o MESMO menu nos dois lugares: a fita abre pelo botão "Organizar" (ícone de cópias) e o
// menu de contexto da forma abre pelo item "Organizar" — com o mesmo ícone, para ficar óbvio
// que é a mesma coisa.

import { abrirPopup, fecharPopup } from "./popup";

/** Os comandos, na ordem do Office: primeiro o par dos extremos ("Trazer para a frente" e, logo
 *  abaixo, "Enviar para trás") e só depois os passos de camada ("Avançar"/"Recuar"). */
export const ITENS_ORGANIZAR: [string, string][] = [
  ["z-topo", "Trazer para a frente"],
  ["z-fundo", "Enviar para trás"],
  ["z-frente", "Avançar"],
  ["z-tras", "Recuar"],
  ["agrupar", "Agrupar"],
  ["desagrupar", "Desagrupar"],
  ["al-esquerda", "Alinhar à esquerda"],
  ["al-centro", "Centralizar na horizontal"],
  ["al-direita", "Alinhar à direita"],
  ["al-topo", "Alinhar ao topo"],
  ["al-meio", "Centralizar na vertical"],
  ["al-base", "Alinhar embaixo"],
  ["dist-h", "Distribuir na horizontal"],
  ["dist-v", "Distribuir na vertical"],
  ["girar-90", "Girar 90° à direita"],
  ["girar--90", "Girar 90° à esquerda"],
  ["espelhar-h", "Espelhar na horizontal"],
  ["espelhar-v", "Espelhar na vertical"],
  ["igualar-largura", "Mesma largura"],
  ["igualar-altura", "Mesma altura"],
  ["bloquear", "Bloquear / desbloquear"],
];

/** Abre o menu "Organizar" ancorado no elemento indicado e chama `run` com o comando.
 *  `aoLado` é para o item do menu de contexto: o menu completo abre ao lado dele (como um
 *  submenu), em vez de tentar caber embaixo — lá embaixo não cabe e ele subia para o topo. */
export function abrirMenuOrganizar(
  ancora: HTMLElement,
  run: (cmd: string, valor?: string) => void,
  op: { aoLado?: boolean } = {}
): void {
  const el = abrirPopup(
    ancora,
    ITENS_ORGANIZAR.map(([c, n]) => `<button type="button" class="pp-pop-item" data-o="${c}">${n}</button>`).join(""),
    { classe: "pp-pop-menu", aoLado: op.aoLado }
  );
  el.addEventListener("click", (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>("[data-o]");
    if (!b) return;
    fecharPopup();
    const c = b.dataset.o!;
    if (c.startsWith("girar-")) run("girar", c.slice(6));
    else if (c.startsWith("al-")) run("alinhar", c.slice(3));
    else if (c.startsWith("dist-")) run("distribuir", c.slice(5));
    else if (c.startsWith("espelhar-")) run("espelhar", c.slice(9));
    else if (c.startsWith("igualar-")) run("igualar", c.slice(8));
    else run(c);
  });
}

/** O item "Organizar" (o mesmo ícone do botão da fita) para o menu de contexto. */
export const ITEM_ORGANIZAR = `<button type="button" class="pp-pop-item pp-pop-organizar" data-organizar><span class="ppr-seta">⧉</span><span>Organizar</span><span class="pp-pop-caret">▸</span></button>`;
