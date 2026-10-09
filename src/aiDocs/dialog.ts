// A janela "Skills e regras": escolhe o modelo, preenche o formulário e vê o arquivo nascer ao lado.
import DOMPurify from "dompurify";
import { marked } from "marked";
import { h, loadJSON, saveJSON, toast } from "../util";
import { MODELOS, type Modelo, type Valores } from "./modelos";

export interface OpcoesAiDocs {
  /** coloca o texto no documento aberto, no cursor */
  inserir: (md: string) => void;
  /** abre o texto como um documento novo */
  novo: (nome: string, md: string) => void;
  copiar: (md: string) => Promise<boolean>;
}

const CHAVE = (id: string) => `mdc.aidocs.${id}`;

export function abrirAiDocs(op: OpcoesAiDocs): void {
  if (document.querySelector(".aid-modal")) return;
  let atual: Modelo = MODELOS.find((m) => m.id === loadJSON<string>("mdc.aidocs.ultimo", "skill")) ?? MODELOS[0];
  const valores = new Map<string, Valores>();
  const valoresDe = (m: Modelo): Valores => {
    let v = valores.get(m.id);
    if (!v) {
      v = loadJSON<Valores>(CHAVE(m.id), {});
      valores.set(m.id, v);
    }
    return v;
  };
  let vista: "md" | "render" = "md";

  const fundo = h("div", { class: "modal-backdrop aid-fundo" });
  const modal = h("div", { class: "modal aid-modal", role: "dialog", "aria-label": "Skills e regras para IA" });
  fundo.append(modal);

  const abas = h("div", { class: "aid-tipos" });
  const form = h("div", { class: "aid-form" });
  const previa = h("div", { class: "aid-previa" });
  const rodape = h("div", { class: "aid-rodape" });

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

  modal.append(
    h("div", { class: "aid-topo" }, [
      h("div", {}, [h("h2", { text: "Skills e regras para IA" }), h("p", { class: "aid-sub", text: "Preencha à esquerda; o arquivo aparece pronto à direita." })]),
      abas,
      h("button", { class: "btn icon aid-x", type: "button", title: "Fechar (Esc)", "aria-label": "Fechar", text: "✕", onClick: fechar }),
    ]),
    h("div", { class: "aid-corpo" }, [form, previa]),
    rodape
  );

  let relogio = 0;
  const gerar = () => atual.gerar(valoresDe(atual));

  function pintarAbas(): void {
    abas.textContent = "";
    for (const m of MODELOS) {
      abas.append(
        h("button", {
          class: `aid-tipo${m.id === atual.id ? " on" : ""}`,
          type: "button",
          text: m.nome,
          title: m.resumo,
          onClick: () => {
            atual = m;
            saveJSON("mdc.aidocs.ultimo", m.id);
            tudo();
          },
        })
      );
    }
  }

  function pintarForm(): void {
    const v = valoresDe(atual);
    form.textContent = "";
    form.append(h("p", { class: "aid-resumo", text: atual.resumo }));
    for (const c of atual.campos) {
      let entrada: HTMLElement;
      if (c.tipo === "escolha") {
        const sel = h("select", { class: "aid-in", "data-campo": c.id });
        for (const o of c.opcoes ?? []) sel.append(h("option", { value: o, text: o }));
        sel.value = v[c.id] || c.opcoes?.[0] || "";
        entrada = sel;
      } else if (c.tipo === "texto") {
        entrada = h("input", { class: "aid-in", type: "text", "data-campo": c.id, placeholder: c.placeholder ?? "", value: v[c.id] ?? "" });
      } else {
        const ta = h("textarea", { class: "aid-in", "data-campo": c.id, rows: c.tipo === "lista" ? 4 : 3, placeholder: c.placeholder ?? "" });
        ta.value = v[c.id] ?? "";
        entrada = ta;
      }
      form.append(h("label", { class: "aid-campo" }, [h("span", { class: "aid-rot", text: c.rotulo }), entrada, h("small", { class: "aid-ajuda", text: c.ajuda })]));
    }
  }

  function pintarPrevia(): void {
    const md = gerar();
    previa.textContent = "";
    const barra = h("div", { class: "aid-previa-barra" }, [
      h("span", { class: "aid-arquivo", text: atual.arquivo(valoresDe(atual)) }),
      h("span", { class: "aid-enche" }),
      h("button", { class: `aid-vista${vista === "md" ? " on" : ""}`, type: "button", text: "Markdown", onClick: () => ((vista = "md"), pintarPrevia()) }),
      h("button", { class: `aid-vista${vista === "render" ? " on" : ""}`, type: "button", text: "Como fica", onClick: () => ((vista = "render"), pintarPrevia()) }),
    ]);
    const conteudo = h("div", { class: vista === "md" ? "aid-md" : "aid-render markdown-body" });
    if (vista === "md") conteudo.append(h("pre", { text: md }));
    else {
      // o frontmatter vira um cartão (como as ferramentas mostram), o resto é Markdown comum
      const m = /^---\n([\s\S]*?)\n---\n?/.exec(md);
      const corpo = m ? md.slice(m[0].length) : md;
      const cartao = m ? `<div class="aid-front">${m[1].split("\n").map((l) => `<div><b>${esc(l.split(":")[0])}</b>${esc(l.slice(l.indexOf(":")))}</div>`).join("")}</div>` : "";
      conteudo.innerHTML = cartao + DOMPurify.sanitize(String(marked.parse(corpo, { gfm: true, async: false })));
    }
    previa.append(barra, conteudo);
  }

  function pintarRodape(): void {
    const dicas = atual.checar(valoresDe(atual));
    rodape.textContent = "";
    const lista = h("ul", { class: "aid-dicas" });
    for (const d of dicas) lista.append(h("li", { class: `aid-dica ${d.nivel}`, text: d.texto }));
    const md = () => gerar();
    const nome = () => atual.arquivo(valoresDe(atual));
    rodape.append(
      lista,
      h("div", { class: "aid-acoes" }, [
        h("button", {
          class: "btn small",
          type: "button",
          text: "Preencher exemplo",
          title: "Mostra como fica um modelo completo",
          onClick: () => {
            valores.set(atual.id, { ...atual.exemplo });
            saveJSON(CHAVE(atual.id), valores.get(atual.id));
            tudo();
          },
        }),
        h("button", {
          class: "btn small",
          type: "button",
          text: "Limpar",
          onClick: () => {
            valores.set(atual.id, {});
            saveJSON(CHAVE(atual.id), {});
            tudo();
          },
        }),
        h("span", { class: "aid-enche" }),
        h("button", { class: "btn small", type: "button", text: "Copiar", onClick: async () => toast((await op.copiar(md())) ? "Copiado." : "Não consegui copiar.", "ok", 1800) }),
        h("button", { class: "btn small", type: "button", text: "Inserir no documento", onClick: () => (op.inserir(md()), fechar()) }),
        h("button", { class: "btn primary small", type: "button", text: `Criar ${nome()}`, onClick: () => (op.novo(nome(), md()), fechar()) }),
      ])
    );
  }

  function tudo(): void {
    pintarAbas();
    pintarForm();
    pintarPrevia();
    pintarRodape();
  }

  form.addEventListener("input", (e) => {
    const el = e.target as HTMLInputElement;
    const id = el.dataset.campo;
    if (!id) return;
    const v = valoresDe(atual);
    v[id] = el.value;
    window.clearTimeout(relogio);
    relogio = window.setTimeout(() => {
      saveJSON(CHAVE(atual.id), v);
      pintarPrevia();
      pintarRodape();
    }, 120);
  });

  tudo();
  document.body.append(fundo);
  form.querySelector<HTMLElement>(".aid-in")?.focus();
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
