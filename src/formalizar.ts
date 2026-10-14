// A janela "Formalizar": mostra o antes e o depois e deixa decidir o que muda de sentido.
//
// As trocas vêm de `broker/formalizar.ts` (o catálogo de informal + as regras de frase, no tom
// formal). Aqui é só a decisão: as seguras já entram marcadas; as que dependem de sentido vêm
// desmarcadas, com o risco explicado no title e as alternativas em chips. O "Depois" e o MIP
// acompanham cada clique — e quem aplica ao documento é o app (uma transação só: Ctrl+Z desfaz).

import { ROTULO_CLASSE } from "./broker/data/informal";
import { aplicarTrocas, mipDe, trocasDeFormalizacao, ROTULO_RISCO, type TrocaAplicada, type TrocaFormal } from "./broker/formalizar";
import { h, toast } from "./util";

export interface OpcoesFormalizar {
  /** o texto alvo (a seleção, ou o documento inteiro quando não há seleção) */
  texto: string;
  /** de onde veio o texto, para o cabeçalho: "seleção" ou "documento inteiro" */
  origem: string;
  /**
   * Aplica o texto formalizado no alvo. `aplicadas` diz onde cada troca caiu (no original e
   * no texto novo): quem aplica por trecho — o Word, que preserva o formato — usa isso;
   * quem troca o bloco inteiro de uma vez (o Markdown) pode ignorar.
   */
  aplicar: (novo: string, aplicadas: TrocaAplicada[]) => void;
}

const fmt = (n: number) => String(n).replace(".", ",");

/** Escreve o texto no destino, destacando as faixas — é o antes (vermelho) e o depois (verde). */
function pintarTrechos(destino: HTMLElement, texto: string, faixas: [number, number][], classe: string): void {
  destino.textContent = "";
  let fim = 0;
  for (const [from, to] of faixas) {
    if (from < fim || to > texto.length || from >= to) continue;
    if (from > fim) destino.append(document.createTextNode(texto.slice(fim, from)));
    destino.append(h("mark", { class: classe, text: texto.slice(from, to) }));
    fim = to;
  }
  if (fim < texto.length) destino.append(document.createTextNode(texto.slice(fim)));
}

export function abrirFormalizar(op: OpcoesFormalizar): void {
  if (document.querySelector(".fz-modal")) return;
  const trocas = trocasDeFormalizacao(op.texto);
  if (!trocas.length) {
    toast("Nada a formalizar: nenhum marcador informal foi encontrado no texto.", "ok", 3400);
    return;
  }
  // As seguras já entram marcadas; as de sentido esperam a decisão (e as manuais só informam).
  const escolhidas = new Set<number>();
  trocas.forEach((t, i) => {
    if (t.risco === "segura") escolhidas.add(i);
  });

  const fundo = h("div", { class: "modal-backdrop" });
  const modal = h("div", { class: "modal fz-modal", role: "dialog", "aria-label": "Formalizar texto" });
  fundo.append(modal);

  const escopo = h("span", { class: "fz-escopo", text: op.origem, title: "O comando pega a seleção; sem seleção, o documento inteiro" });
  const mip = h("span", { class: "fz-mip" });
  const antes = h("div", { class: "fz-texto" });
  const depois = h("div", { class: "fz-texto" });
  const lista = h("div", { class: "fz-trocas" });
  const contar = h("span", { class: "fz-contar muted" });
  const botao = h("button", { class: "btn primary", type: "button" });

  const fechar = () => {
    document.removeEventListener("keydown", tecla, true);
    fundo.remove();
  };
  const tecla = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      fechar();
    }
  };
  document.addEventListener("keydown", tecla, true);
  fundo.addEventListener("mousedown", (e) => {
    if (e.target === fundo) fechar();
  });

  const linha = (t: TrocaFormal, i: number): HTMLElement => {
    const row = h("label", { class: `fz-troca ${t.risco}`, title: t.message });
    const marcar = h("input", { class: "fz-check", type: "checkbox" });
    marcar.checked = escolhidas.has(i);
    marcar.disabled = t.risco === "manual";
    marcar.addEventListener("change", () => {
      if (marcar.checked) escolhidas.add(i);
      else escolhidas.delete(i);
      recalcular();
    });
    row.append(marcar);
    row.append(h("span", { class: `fz-risco ${t.risco}`, text: ROTULO_RISCO[t.risco] }));
    row.append(h("span", { class: "fz-classe", text: ROTULO_CLASSE[t.classe] }));
    const troca = h("span", { class: "fz-par" });
    troca.append(h("span", { class: "fz-de", text: t.de }));
    if (t.para !== undefined) {
      troca.append(h("span", { class: "fz-seta", text: "→" }));
      troca.append(h("span", { class: "fz-para", text: t.para }));
    } else {
      troca.append(h("span", { class: "fz-seta", text: "—" }), h("span", { class: "fz-para vazio", text: "sem troca pronta" }));
    }
    row.append(troca);
    for (const alt of t.alternativas) {
      const chip = h("button", { class: "fz-alt", type: "button", text: alt, title: `Usar “${alt}”` });
      chip.addEventListener("click", (e) => {
        e.preventDefault();
        t.para = alt;
        escolhidas.add(i);
        pintar();
        recalcular();
      });
      row.append(chip);
    }
    return row;
  };

  const secoes: [string, TrocaFormal[]][] = [
    ["Marcadas — trocas seguras", trocas.filter((t) => t.risco === "segura")],
    ["Decida — dependem do sentido", trocas.filter((t) => t.risco === "sentido")],
    ["Reformule você", trocas.filter((t) => t.risco === "manual")],
  ];

  function pintar(): void {
    lista.textContent = "";
    lista.append(h("div", { class: "fz-cabecalho" }, [h("h3", { text: "Trocas" }), contar]));
    for (const [titulo, doGrupo] of secoes) {
      if (!doGrupo.length) continue;
      const secao = h("div", { class: "fz-secao" });
      secao.append(h("h3", { text: `${titulo} (${doGrupo.length})` }));
      for (const t of doGrupo) secao.append(linha(t, trocas.indexOf(t)));
      lista.append(secao);
    }
  }

  function recalcular(): void {
    const novas = trocas.filter((_, i) => escolhidas.has(i));
    const resultado = aplicarTrocas(op.texto, novas);
    pintarTrechos(antes, op.texto, resultado.aplicadas.map((a) => a.de), "fz-marca velho");
    pintarTrechos(depois, resultado.texto, resultado.aplicadas.map((a) => a.para), "fz-marca novo");
    mip.textContent = `MIP ${fmt(mipDe(op.texto))} → ${fmt(mipDe(resultado.texto))}`;
    contar.textContent = `${novas.length} troca(s) marcada(s) de ${trocas.length}`;
    botao.textContent = novas.length ? `Aplicar ${novas.length} troca(s)` : "Aplicar";
    botao.disabled = resultado.texto === op.texto;
  }

  botao.addEventListener("click", () => {
    const novas = trocas.filter((_, i) => escolhidas.has(i));
    const resultado = aplicarTrocas(op.texto, novas);
    fechar();
    op.aplicar(resultado.texto, resultado.aplicadas);
  });

  antes.textContent = op.texto;
  depois.textContent = op.texto;
  modal.append(
    h("div", { class: "fz-topo" }, [
      h("div", { class: "fz-titulo" }, [
        h("h2", { text: "Formalizar texto" }),
        h("p", { class: "fz-sub muted", text: "As trocas seguras já vêm marcadas. As que dependem do sentido esperam você." }),
      ]),
      escopo,
      mip,
      h("button", { class: "btn icon fz-x", type: "button", title: "Fechar (Esc)", "aria-label": "Fechar", text: "✕", onClick: fechar }),
    ]),
    h("div", { class: "fz-corpo" }, [
      h("div", { class: "fz-painel" }, [h("h3", { text: "Antes" }), antes]),
      h("div", { class: "fz-painel" }, [h("h3", { text: "Depois" }), depois]),
    ]),
    lista,
    h("div", { class: "fz-rodape" }, [
      h("span", { class: "fz-dica muted", text: "O MIP conta os marcadores informais por mil palavras. Ctrl+Z desfaz tudo de uma vez." }),
      h("span", { class: "dr-spacer" }),
      h("button", { class: "btn", type: "button", text: "Cancelar", onClick: fechar }),
      botao,
    ])
  );

  pintar();
  recalcular();
  document.body.append(fundo);
}
