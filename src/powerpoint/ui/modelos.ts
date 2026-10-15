// Galeria do botão Template (fita): cartões com a prévia de cada modelo — fundo, texto, acento e fonte.
//
// A grade tem DUAS seções e a ordem é de propósito: **Seus modelos** (o cartão "+", para guardar
// esta apresentação quantas vezes quiser, e os cartões que a pessoa já guardou — cada um com o ×
// no canto para apagar) e os **modelos do app**. O catálogo são 22 cartões: com ele na frente, o
// "+" e os modelos do usuário ficavam no fim de uma grade que rola, então quem criava um modelo
// abria a galeria de novo e não achava nem o cartão novo nem como criar outro (parecia que só
// dava para criar um). O "+" primeiro mantém a criação à vista, sem rolagem.
import { MODELOS, type ModeloPPT } from "../edicao/modelos";
import { decoracoesDe } from "../edicao/desenhos";
import type { Shape } from "../schema";
import { FAMILIAS, rampaDeTons } from "../edicao/estilos";
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

/** O desenho do modelo em miniatura (a capa dele): as mesmas decorações que a lâmina recebe. */
function htmlDesenho(m: ModeloPPT, cores: { bg: string; fg: string; accent: string; muted: string }): string {
  if (!m.desenho) return "";
  const poligono = (s: Shape): string => {
    if (s.flipH && s.flipV) return "100% 100%,100% 0,0 0";
    if (s.flipH) return "100% 0,100% 100%,0 100%";
    if (s.flipV) return "0 100%,0 0,100% 0";
    return "0 0,0 100%,100% 100%";
  };
  const partes = decoracoesDe(m.desenho, "titulo", cores, 1.6).map((s) => {
    const css = [`left:${s.box.x}%`, `top:${s.box.y}%`, `width:${s.box.w}%`, `height:${s.box.h}%`];
    const cor = s.fillX?.kind === "solid" ? s.fillX : undefined;
    if (cor) css.push(`background:#${cor.color}`, `opacity:${cor.alpha}`);
    if (s.ln) css.push(`border:${Math.max(1, Math.round(s.ln.w / 1.5))}px solid #${s.ln.color}`, `opacity:${s.ln.alpha}`, "box-sizing:border-box");
    if (s.geom === "ellipse") css.push("border-radius:50%");
    if (s.geom === "rtTriangle") css.push(`clip-path:polygon(${poligono(s)})`);
    return `<span style="${css.join(";")}"></span>`;
  });
  return `<span class="pp-tpl-deco">${partes.join("")}</span>`;
}

/** Cartão de prévia: o mesmo desenho para os modelos do app e para os do usuário. */
function cartao(m: ModeloPPT, dados: string): string {
  const t = themeOf(m.tema);
  const bg = m.cores?.bg || m.bg || t.bg;
  const fg = m.cores?.fg || t.fg;
  const muted = m.cores?.muted || t.muted;
  const accent = m.cores?.accent || t.accent;
  // modelo com Estilo de Cor: a prévia do fundo é a PRÓPRIA rampa do estilo (a mesma que as
  // lâminas recebem ao aplicar) — o cartão mostra o gradiente da família na inclinação certa
  const rec = m.estilo ? FAMILIAS[m.estilo.familia] : null;
  const rampa = m.estilo && rec ? rampaDeTons(rec.base || accent, m.estilo.intensidade, rec.desvio) : null;
  const previaBg = rampa ? `background:linear-gradient(135deg,#${rampa.claro} 0%,#${rampa.cor} 45%,#${rampa.escuro} 100%)` : `background:#${bg}`;
  return `<button type="button" class="pp-tpl${m.estilo ? " pp-tpl-com-estilo" : ""}" ${dados} title="${esc(m.nome)} — ${esc(m.descricao)}">
      <span class="pp-tpl-previa" style="${previaBg};color:#${fg}">
        ${htmlDesenho(m, { bg, fg, accent, muted })}
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

/** O cartão que salva a apresentação atual como um modelo seu — vem sempre no começo da grade. */
const CARTAO_CRIAR = `<button type="button" class="pp-tpl pp-tpl-mais" data-criar title="Salvar esta apresentação como um modelo seu (pode criar quantos quiser)">
      <span class="pp-tpl-previa pp-tpl-previa-mais"><span class="pp-tpl-mais-sinal">+</span></span>
      <span class="pp-tpl-nome">Novo modelo</span>
    </button>`;

/**
 * Abre a galeria de modelos; `aoEscolher` recebe o modelo clicado.
 * `idNovo` é o modelo recém-criado: o cartão dele fica em destaque e à vista (a grade pode ser
 * longa e o cartão novo nasceria fora da tela).
 */
export function abrirModelos(ancora: HTMLElement, aoEscolher: (m: ModeloPPT) => void, acoes: AcoesModelos = {}, idNovo?: string): void {
  const el = abrirPopup(ancora, "", { classe: "pp-pop-modelos", alinharDireita: true });

  const desenhar = (): void => {
    const usuario = lerModelosUsuario();
    const rolagem = el.scrollTop;
    const cartoes =
      CARTAO_CRIAR +
      usuario.map((m) => cartao(m, `data-u="${esc(m.id)}"`)).join("") +
      `<div class="pp-pop-t pp-tpls-t">Modelos do app</div>` +
      MODELOS.map((m, i) => cartao(m, `data-i="${i}"`)).join("");
    el.innerHTML = `<div class="pp-pop-t">Modelos de apresentação</div><div class="pp-tpls">${cartoes}</div>`;
    // apagar um cartão redesenha a grade: a rolagem de onde a pessoa estava volta (sem isto a
    // galeria saltaria para o topo a cada ×)
    el.scrollTop = rolagem;
    // o popup pode ter crescido: se passar da janela, sobe e é puxado para a esquerda (o abrirPopup
    // só posiciona na abertura, quando o conteúdo ainda está vazio — sem isto a última coluna da
    // grade fica fora da tela e o catálogo parece ter menos modelos)
    const r = el.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 8) {
      const topo = Math.max(8, (parseFloat(el.style.top) || 0) - (r.bottom - (window.innerHeight - 8)));
      el.style.top = `${topo}px`;
    }
    if (r.right > window.innerWidth - 8) {
      const esquerda = Math.max(8, (parseFloat(el.style.left) || 0) - (r.right - (window.innerWidth - 8)));
      el.style.left = `${esquerda}px`;
    }
  };
  const realcar = (id: string): void => {
    const cartaoNovo = [...el.querySelectorAll<HTMLElement>("[data-u]")].find((b) => b.dataset.u === id);
    if (!cartaoNovo) return;
    cartaoNovo.scrollIntoView({ block: "nearest" });
    cartaoNovo.classList.add("pp-tpl-novo");
    window.setTimeout(() => cartaoNovo.classList.remove("pp-tpl-novo"), 1800);
  };
  desenhar();
  if (idNovo) realcar(idNovo);

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
        const antes = lerModelosUsuario().length;
        acoes.criar?.(nome);
        // o modelo novo é o último da lista; sem ele (o armazenamento recusou) não há o que realçar
        const lista = lerModelosUsuario();
        const novo = lista.length > antes ? lista[lista.length - 1] : null;
        // reabre a galeria com o cartão novo à vista (a âncora continua na fita)
        if (ancora.isConnected) abrirModelos(ancora, aoEscolher, acoes, novo?.id);
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
