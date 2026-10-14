// Diálogo de uma linha de texto do app — o lugar certo para pedir um nome.
//
// Existe porque os `prompt()` nativos ("localhost:1420 diz…") não seguem o tema, não têm o
// desenho do app e param a janela inteira. Aqui: OK/Enter confirmam, Esc/Cancelar/clicar fora
// devolvem `null`, e um `validar` opcional mostra o erro na própria janela.
import { h } from "./util";

export interface OpcoesTexto {
  /** título da janela */
  titulo: string;
  /** rótulo do campo */
  rotulo: string;
  /** dica curta abaixo do rótulo */
  dica?: string;
  /** valor inicial (já selecionado ao abrir) */
  valor?: string;
  /** texto do botão de confirmar (padrão "OK") */
  ok?: string;
  /** valida e devolve a mensagem de erro, ou null quando estiver tudo bem */
  validar?: (valor: string) => string | null;
  /**
   * Com 2+, o campo vira uma área de várias linhas (código): Enter quebra a linha e
   * Ctrl+Enter confirma (além do botão).
   */
  linhas?: number;
}

/** Pergunta um texto com o visual do app. Devolve o valor digitado ou `null` se cancelar. */
export function pedirTexto(op: OpcoesTexto): Promise<string | null> {
  return new Promise((resolve) => {
    const backdrop = h("div", { class: "modal-backdrop" });
    const modal = h("div", { class: "modal dialogo-texto" });
    modal.innerHTML = `
      <header class="wm-head">
        <svg class="ic"><use href="#i-text"/></svg>
        <h2 data-titulo></h2>
        <button class="btn icon" data-cancelar title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
      </header>
      <div class="wm-body">
        <label class="st-field">
          <span class="st-field-label"><b data-rotulo></b>${op.dica ? "<small data-dica></small>" : ""}</span>
          ${op.linhas && op.linhas > 1 ? `<textarea rows="${op.linhas}" spellcheck="false" autocomplete="off"></textarea>` : `<input type="text" spellcheck="false" autocomplete="off">`}
        </label>
        <p class="dg-erro" data-erro hidden></p>
      </div>
      <footer class="wm-foot">
        <span class="dr-spacer"></span>
        <button class="btn" data-cancelar>Cancelar</button>
        <button class="btn primary" data-ok></button>
      </footer>`;
    backdrop.append(modal);
    document.body.append(backdrop);

    // textos por textContent: títulos/rótulos de fora nunca viram HTML
    modal.querySelector("[data-titulo]")!.textContent = op.titulo;
    modal.querySelector("[data-rotulo]")!.textContent = op.rotulo;
    if (op.dica) modal.querySelector("[data-dica]")!.textContent = op.dica;
    const entrada = modal.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea")!;
    const multilinha = entrada instanceof HTMLTextAreaElement;
    const erro = modal.querySelector<HTMLElement>("[data-erro]")!;
    const ok = modal.querySelector<HTMLButtonElement>("[data-ok]")!;
    ok.textContent = op.ok ?? "OK";
    entrada.value = op.valor ?? "";
    entrada.focus();
    if (multilinha) entrada.setSelectionRange(entrada.value.length, entrada.value.length);
    else entrada.select();

    let feito = false;
    const fim = (valor: string | null) => {
      if (feito) return;
      feito = true;
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      resolve(valor);
    };
    const confirmar = () => {
      const valor = entrada.value;
      const problema = op.validar?.(valor) ?? null;
      if (problema) {
        erro.textContent = problema;
        erro.hidden = false;
        entrada.focus();
        return;
      }
      fim(valor);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        fim(null);
      } else if (e.key === "Enter") {
        if (multilinha && !e.ctrlKey && !e.metaKey) return; // no código, Enter quebra a linha
        e.preventDefault();
        e.stopPropagation();
        confirmar();
      }
    };
    document.addEventListener("keydown", onKey, true);
    modal.querySelectorAll("[data-ok]").forEach((b) => b.addEventListener("click", confirmar));
    modal.querySelectorAll("[data-cancelar]").forEach((b) => b.addEventListener("click", () => fim(null)));
    // apagar o erro assim que a pessoa mexe no texto
    entrada.addEventListener("input", () => {
      erro.hidden = true;
    });
    backdrop.addEventListener("mousedown", (e) => {
      if (e.target === backdrop) fim(null);
    });
  });
}
