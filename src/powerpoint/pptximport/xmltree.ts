// Leitor de XML do OOXML em árvore simples. Não usa DOMParser: roda igual no app, no WebView e no Node (testes).
// Os nomes de elementos perdem o prefixo (a:ln -> "ln"); os atributos mantêm o prefixo quando ele importa
// (r:embed, r:id), para não colidir com o atributo de mesmo nome sem prefixo.

export interface No {
  /** nome local do elemento */
  n: string;
  a: Record<string, string>;
  c: No[];
  /** texto direto do elemento (só interessa em a:t) */
  t: string;
}

const ENTIDADES: Record<string, string> = { lt: "<", gt: ">", quot: '"', apos: "'", amp: "&" };

function decodificar(s: string): string {
  if (s.indexOf("&") < 0) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e[0] === "#") {
      const cod = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cod) ? String.fromCodePoint(cod) : m;
    }
    return ENTIDADES[e] ?? m;
  });
}

function nomeLocal(tag: string): string {
  const i = tag.indexOf(":");
  return i < 0 ? tag : tag.slice(i + 1);
}

function nomeAtributo(nome: string): string {
  // mantém só o prefixo "r:" (relacionamentos); remove o resto (a14:, xmlns:...)
  if (nome.startsWith("r:")) return nome;
  const i = nome.indexOf(":");
  return i < 0 ? nome : nome.slice(i + 1);
}

/** Lê o XML inteiro e devolve o elemento raiz. */
export function lerXml(xml: string): No {
  const raiz: No = { n: "#raiz", a: {}, c: [], t: "" };
  const pilha: No[] = [raiz];
  const n = xml.length;
  let i = 0;
  while (i < n) {
    const lt = xml.indexOf("<", i);
    if (lt < 0) break;
    if (lt > i) {
      const txt = xml.slice(i, lt);
      if (txt.trim() !== "" || pilha[pilha.length - 1].n === "t") pilha[pilha.length - 1].t += decodificar(txt);
    }
    if (xml.startsWith("<!--", lt)) {
      const fim = xml.indexOf("-->", lt + 4);
      i = fim < 0 ? n : fim + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", lt)) {
      const fim = xml.indexOf("]]>", lt + 9);
      pilha[pilha.length - 1].t += xml.slice(lt + 9, fim < 0 ? n : fim);
      i = fim < 0 ? n : fim + 3;
      continue;
    }
    if (xml[lt + 1] === "?" || xml[lt + 1] === "!") {
      const fim = xml.indexOf(">", lt + 2);
      i = fim < 0 ? n : fim + 1;
      continue;
    }
    if (xml[lt + 1] === "/") {
      const fim = xml.indexOf(">", lt + 2);
      if (pilha.length > 1) pilha.pop();
      i = fim < 0 ? n : fim + 1;
      continue;
    }
    // abre elemento: lê o nome, os atributos e o "/>"
    let j = lt + 1;
    while (j < n && !/[\s/>]/.test(xml[j])) j++;
    const no: No = { n: nomeLocal(xml.slice(lt + 1, j)), a: {}, c: [], t: "" };
    let autoFecha = false;
    while (j < n) {
      while (j < n && /\s/.test(xml[j])) j++;
      if (xml[j] === ">") {
        j++;
        break;
      }
      if (xml[j] === "/") {
        autoFecha = true;
        j = xml.indexOf(">", j) + 1 || n;
        break;
      }
      let k = j;
      while (k < n && xml[k] !== "=" && !/[\s/>]/.test(xml[k])) k++;
      const nome = xml.slice(j, k);
      j = k;
      while (j < n && /\s/.test(xml[j])) j++;
      if (xml[j] !== "=") {
        if (!nome) j++;
        continue;
      }
      j++;
      while (j < n && /\s/.test(xml[j])) j++;
      const asp = xml[j];
      if (asp !== '"' && asp !== "'") continue;
      const fimV = xml.indexOf(asp, j + 1);
      const valor = xml.slice(j + 1, fimV < 0 ? n : fimV);
      j = fimV < 0 ? n : fimV + 1;
      if (!nome.startsWith("xmlns")) no.a[nomeAtributo(nome)] = decodificar(valor);
    }
    pilha[pilha.length - 1].c.push(no);
    if (!autoFecha) pilha.push(no);
    i = j;
  }
  return raiz.c[0] ?? raiz;
}

// ---- ajudantes de navegação ----

/** Primeiro filho com esse nome. */
export function filho(no: No | undefined, nome: string): No | undefined {
  if (!no) return undefined;
  for (const c of no.c) if (c.n === nome) return c;
  return undefined;
}

/** Todos os filhos com esse nome (ou todos, sem nome). */
export function filhos(no: No | undefined, nome?: string): No[] {
  if (!no) return [];
  return nome ? no.c.filter((c) => c.n === nome) : no.c;
}

/** Caminho "a/b/c" a partir do nó. */
export function caminho(no: No | undefined, via: string): No | undefined {
  let atual = no;
  for (const parte of via.split("/")) {
    atual = filho(atual, parte);
    if (!atual) return undefined;
  }
  return atual;
}

/** Atributo numérico (ou o padrão). */
export function num(no: No | undefined, chave: string, padrao = 0): number {
  const v = no?.a[chave];
  if (v === undefined || v === "") return padrao;
  const x = Number(v);
  return Number.isFinite(x) ? x : padrao;
}

/** Atributo booleano do OOXML ("1" ou "true"). */
export function bool(no: No | undefined, chave: string, padrao = false): boolean {
  const v = no?.a[chave];
  if (v === undefined) return padrao;
  return v === "1" || v === "true";
}

/** Percorre a árvore em profundidade. */
export function varrer(no: No, f: (n: No) => void): void {
  f(no);
  for (const c of no.c) varrer(c, f);
}
