// Painel do diagnóstico da escrita: mostra o log de decisões do corretor.
//
// Desligado por padrão. Liga por `?diag=1` na URL (e fica ligado no navegador), por
// `localStorage["mdc.diag"] = "1"` ou pelo console (`__mdofficeDiag.ligar()`).
// Quando ligado, aparece um botão flutuante "Diagnóstico (N)" com o resumo e o JSONL.
import {
  diagAoMudar,
  diagAtivo,
  diagEntradas,
  diagJSONL,
  diagLigar,
  diagLimpar,
  diagResumo,
  diagSessao,
} from "../broker/diag";

const CHAVE = "mdc.diag";

let botao: HTMLButtonElement | null = null;
let painel: HTMLDivElement | null = null;

/** Liga o painel se a URL/localStorage pedirem e publica o atalho de console. */
export function initDiagPanel(): void {
  let guardado = false;
  try {
    guardado = localStorage.getItem(CHAVE) === "1";
  } catch {
    /* sem armazenamento */
  }
  const porUrl = new URLSearchParams(location.search).get("diag") === "1";
  if (porUrl || guardado) ligar();

  const gancho = {
    ligar: () => ligar(),
    desligar: () => desligar(),
    abrir: () => abrir(),
    dump: () => diagJSONL(),
    resumo: () => diagResumo(),
    limpar: () => {
      diagLimpar();
      atualizarBotao();
      renderizar();
    },
  };
  (window as unknown as Record<string, unknown>).__mdofficeDiag = gancho;
}

function ligar(): void {
  if (!diagAtivo()) diagLigar();
  try {
    localStorage.setItem(CHAVE, "1");
  } catch {
    /* sem armazenamento */
  }
  if (!botao) criarBotao();
  atualizarBotao();
}

function desligar(): void {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* sem armazenamento */
  }
  diagAoMudar(null);
  painel?.remove();
  painel = null;
  botao?.remove();
  botao = null;
}

function criarBotao(): void {
  botao = document.createElement("button");
  botao.type = "button";
  botao.style.cssText = [
    "position:fixed",
    "right:18px",
    "bottom:18px",
    "z-index:9998",
    "padding:7px 12px",
    "border-radius:999px",
    "border:1px solid var(--borda, #3a3a3a)",
    "background:var(--fundo-painel, #1f1f1f)",
    "color:var(--texto, #e6e6e6)",
    "font:600 12px/1 system-ui, sans-serif",
    "cursor:pointer",
    "box-shadow:0 6px 18px rgba(0,0,0,.35)",
  ].join(";");
  botao.title = "Log de decisões do corretor (clique para abrir)";
  botao.addEventListener("click", abrir);
  document.body.appendChild(botao);
  diagAoMudar(atualizarBotao);
}

function atualizarBotao(): void {
  if (!botao) return;
  botao.textContent = `Diagnóstico (${diagEntradas().length})`;
}

function linhaDe(e: ReturnType<typeof diagEntradas>[number]): string {
  const hora = new Date(e.at).toLocaleTimeString("pt-BR");
  const alvo = e.palavra ? ` “${e.palavra}”` : "";
  const faixa = e.from !== undefined ? ` [${e.from}-${e.to ?? "?"}]` : "";
  const origem = e.tipo ? `${e.tipo}: ` : "";
  const detalhe = e.motivo ? ` — ${e.motivo}` : "";
  const janela = e.janela ? `\n    …${e.janela}…` : "";
  return `#${e.n} ${hora} · ${e.gatilho} · ${e.veredito}\n  ${origem}${e.regra}${alvo}${faixa}${detalhe}${janela}`;
}

function renderizar(): void {
  if (!painel) return;
  const corpo = painel.querySelector<HTMLElement>("[data-corpo]");
  if (!corpo) return;
  const r = diagResumo();
  const entradas = diagEntradas();
  const ultimas = entradas.slice(-250).reverse();
  const cabeca =
    `sessão ${diagSessao()} · ${r.total} decisão(ões) · ${r.aplicados} aplicada(s) · ${r.ignorados} ignorada(s)\n\n` +
    r.porRegra.map(([regra, n]) => `  ${String(n).padStart(4)} × ${regra}`).join("\n") +
    `\n\n── últimas decisões ──\n\n`;
  corpo.textContent = cabeca + ultimas.map(linhaDe).join("\n\n");
}

function abrir(): void {
  if (painel) {
    renderizar();
    return;
  }
  painel = document.createElement("div");
  painel.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:9999",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "background:rgba(0,0,0,.45)",
  ].join(";");

  const caixa = document.createElement("div");
  caixa.style.cssText = [
    "width:min(920px, 92vw)",
    "height:min(78vh, 760px)",
    "display:flex",
    "flex-direction:column",
    "gap:10px",
    "padding:14px",
    "border-radius:12px",
    "border:1px solid var(--borda, #3a3a3a)",
    "background:var(--fundo-painel, #1f1f1f)",
    "color:var(--texto, #e6e6e6)",
    "font:12px/1.45 system-ui, sans-serif",
    "box-shadow:0 18px 50px rgba(0,0,0,.5)",
  ].join(";");

  const titulo = document.createElement("div");
  titulo.textContent = "Diagnóstico do corretor — decisões";
  titulo.style.cssText = "font:700 14px/1.2 system-ui, sans-serif";

  const corpo = document.createElement("pre");
  corpo.dataset.corpo = "1";
  corpo.style.cssText = [
    "flex:1",
    "overflow:auto",
    "margin:0",
    "padding:10px",
    "border-radius:8px",
    "background:rgba(255,255,255,.04)",
    "font:11px/1.5 ui-monospace, Consolas, monospace",
    "white-space:pre-wrap",
    "word-break:break-word",
  ].join(";");

  const botoes = document.createElement("div");
  botoes.style.cssText = "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap";
  const criar = (rotulo: string, aoClicar: () => void): HTMLButtonElement => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = rotulo;
    b.style.cssText = "padding:6px 12px;border-radius:7px;border:1px solid var(--borda,#3a3a3a);background:transparent;color:inherit;font:600 12px/1 system-ui,sans-serif;cursor:pointer";
    b.addEventListener("click", aoClicar);
    return b;
  };
  botoes.append(
    criar("Copiar JSONL", () => {
      void navigator.clipboard?.writeText(diagJSONL());
    }),
    criar("Baixar .jsonl", () => {
      const blob = new Blob([diagJSONL()], { type: "application/x-ndjson" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mdoffice-escrita-${diagSessao()}.jsonl`;
      a.click();
      URL.revokeObjectURL(url);
    }),
    criar("Limpar", () => {
      diagLimpar();
      atualizarBotao();
      renderizar();
    }),
    criar("Fechar", () => {
      painel?.remove();
      painel = null;
    })
  );

  caixa.append(titulo, corpo, botoes);
  painel.appendChild(caixa);
  painel.addEventListener("click", (ev) => {
    if (ev.target === painel) {
      painel?.remove();
      painel = null;
    }
  });
  document.body.appendChild(painel);
  renderizar();
}
