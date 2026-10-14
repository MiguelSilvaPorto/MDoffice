// Galeria do botão Template (fita): cartões com a prévia de cada modelo — fundo, texto, acento e fonte.
// Além dos presets, lista os modelos criados pelo usuário e o cartão "+" (criar a partir do deck atual).
import { MODELOS, type ModeloPPT } from "../edicao/modelos";
import { lerModelosUsuario } from "../modelosUsuario";
import { themeOf } from "../themes";
import { pedirTexto } from "../../dialogoTexto";
import { abrirPopup, fecharPopup } from "./popup";

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

export interface AcoesModelos {
  /** cria um modelo com o nome pedido (o host guarda no armazenamento local) */
  criar?: (nome: string) => void;
  /** remove um modelo do usuário pelo id */
  excluir?: (id: string) => void;
}

/** Cartão de prévia: o mesmo desenho para os presets e para os modelos do usuário. */
function cartao(m: ModeloPPT, dados: string): string {
  const t = themeOf(m.tema);
  const bg = m.cores?.bg || m.bg || t.bg;
  const fg = m.cores?.fg || t.fg;
  const muted = m.cores?.muted || t.muted;
  const accent = m.cores?.accent || t.accent;
  return `<button type="button" class="pp-tpl" ${dados} title="${esc(m.nome)} — ${esc(m.descricao)}">
      <span class="pp-tpl-previa" style="background:#${bg};color:#${fg}">
        <span class="pp-tpl-aa" style="font-family:'${esc(m.fonte)}'">Aa</span>
        <span class="pp-tpl-linhas">
          <span style="background:#${fg}"></span>
          <span style="background:#${muted}"></span>
          <span style="background:#${accent}"></span>
        </span>
      </span>
      <span class="pp-tpl-nome">${esc(m.nome)}</span>
      ${m.usuario ? `<span class="pp-tpl-x" data-x="${esc(m.id)}" title="Remover este modelo">×</span>` : ""}
    </button>`;
}

/** Abre a galeria de modelos; `aoEscolher` recebe o modelo clicado. */
export function abrirModelos(ancora: HTMLElement, aoEscolher: (m: ModeloPPT) => void, acoes: AcoesModelos = {}): void {
  const el = abrirPopup(ancora, "", { classe: "pp-pop-modelos", alinharDireita: true });

  const desenhar = (): void => {
    const usuario = lerModelosUsuario();
    const cartoes =
      MODELOS.map((m, i) => cartao(m, `data-i="${i}"`)).join("") +
      usuario.map((m) => cartao(m, `data-u="${esc(m.id)}"`)).join("") +
      `<button type="button" class="pp-tpl pp-tpl-mais" data-criar title="Salvar esta apresentação como um modelo seu">
        <span class="pp-tpl-previa pp-tpl-previa-mais"><span class="pp-tpl-mais-sinal">+</span></span>
        <span class="pp-tpl-nome">Novo modelo</span>
      </button>`;
    el.innerHTML = `<div class="pp-pop-t">Modelos de apresentação</div><div class="pp-tpls">${cartoes}</div>`;
    // o popup pode ter crescido: se passar da janela, sobe (o abrirPopup só posiciona na abertura)
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) {
      const topo = Math.max(8, (parseFloat(el.style.top) || 0) - (r.bottom - (window.innerHeight - 8)));
      el.style.top = `${topo}px`;
    }
  };
  desenhar();

  el.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const remover = t.closest<HTMLElement>("[data-x]");
    if (remover) {
      e.stopPropagation();
      acoes.excluir?.(remover.dataset.x!);
      desenhar();
      return;
    }
    const criar = t.closest<HTMLElement>("[data-criar]");
    if (criar) {
      void (async () => {
        // fecha a galeria antes do diálogo: os cliques nele não são "fora do popup"
        fecharPopup();
        const nome = await pedirTexto({
          titulo: "Novo modelo",
          rotulo: "Nome do novo modelo",
          dica: "O modelo guarda o visual desta apresentação (tema, cores e fonte) e passa a aparecer no botão Template.",
          valor: "Meu modelo",
        });
        if (nome === null) return;
        acoes.criar?.(nome);
        // reabre a galeria com o cartão novo (a âncora continua na fita)
        if (ancora.isConnected) abrirModelos(ancora, aoEscolher, acoes);
      })();
      return;
    }
    const preset = t.closest<HTMLElement>("[data-i]");
    if (preset) {
      fecharPopup();
      aoEscolher(MODELOS[Number(preset.dataset.i)]);
      return;
    }
    const meu = t.closest<HTMLElement>("[data-u]");
    if (meu) {
      const m = lerModelosUsuario().find((x) => x.id === meu.dataset.u);
      if (m) {
        fecharPopup();
        aoEscolher(m);
      }
    }
  });
}
