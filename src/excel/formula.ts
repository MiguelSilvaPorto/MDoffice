// Avaliador de fórmulas do Excel.
//
// O texto de uma célula começa com "=" (ex.: "=SOMA(B2:B10)*1.1"). Aqui ele é
// quebrado em peças, transformado em árvore e calculado.
//
// O que este arquivo NÃO faz — e por isso o app avisa ao salvar —:
//   • referência entre abas ("Planilha2!A1") vira #REF!;
//   • não há nomes definidos nem tabela dinâmica.
//
// Precedência, do mais fraco ao mais forte (igual à do Excel):
//   comparação (= <> < > <= >=)  >  concatenação (&)  >  adição (+ -)
//   >  multiplicação (* /)  >  potência (^)  >  unário (- +)  >  percentual (%)

import { intervalo, ref, type Intervalo } from "./refs";
import { ErroFormula, ehErro, valorParaTexto, type Valor } from "./values";
import type { ConfigPlanilha, Estilo } from "./schema";

/** O que o avaliador entrega ao motor: número, texto, booleano, vazio ou erro. */
export type Operando = Valor | ErroFormula;

const EPOCH_MS = Date.UTC(1899, 11, 30);
const DIA_MS = 86_400_000;

const ehNumero = (v: Operando): v is number => typeof v === "number";

/** Texto como o Excel mostra (VERDADEIRO/FALSO e número com vírgula). */
export function textoDe(v: Operando): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "VERDADEIRO" : "FALSO";
  if (typeof v === "number") return v.toLocaleString("pt-BR", { maximumFractionDigits: 10 });
  return String(v);
}

/** Converte para número como as funções fazem; #VALOR! quando não dá. */
function comoNumero(v: Operando): Operando {
  if (ehErro(v)) return v;
  if (typeof v === "number") return v;
  if (v === null) return 0; // célula vazia vale zero nas operações
  if (typeof v === "boolean") return v ? 1 : 0;
  const s = textoDe(v).trim();
  const n = Number(s.replace(/\s/g, "").replace(",", "."));
  if (Number.isFinite(n) && s !== "") return n;
  const d = serialDeTexto(s);
  return d === null ? new ErroFormula("#VALOR!") : d;
}

/** "01/01/2026" -> serial do Excel (o motor não usa esta função para exibir datas). */
function serialDeTexto(s: string): number | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
  if (!m) return null;
  const a = +m[3] < 100 ? (+m[3] < 30 ? 2000 + +m[3] : 1900 + +m[3]) : +m[3];
  const d = new Date(Date.UTC(a, +m[2] - 1, +m[1]));
  if (d.getUTCMonth() !== +m[2] - 1) return null;
  return Math.floor((Date.UTC(a, +m[2] - 1, +m[1]) - EPOCH_MS) / DIA_MS);
}

/** Converte para texto (erro passa adiante). */
const comoTexto = (v: Operando): Operando => (ehErro(v) ? v : textoDe(v));

/** Verdadeiro/falso para SE, E, OU (0 e vazio são falsos, como no Excel). */
function comoBooleano(v: Operando): boolean {
  if (ehErro(v)) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (v === null) return false;
  const s = textoDe(v).trim().toUpperCase();
  return s !== "" && s !== "FALSO" && s !== "FALSE" && s !== "0";
}

/** Compara como o Excel: números antes de texto; texto sem diferenciar caixa. */
function comparar(a: Operando, b: Operando): number {
  if (ehErro(a) || ehErro(b)) return 0;
  if (ehNumero(a) && ehNumero(b)) return a === b ? 0 : a < b ? -1 : 1;
  if (typeof a === "boolean" || typeof b === "boolean") {
    const x = comoBooleano(a) ? 1 : 0;
    const y = comoBooleano(b) ? 1 : 0;
    return x === y ? 0 : x < y ? -1 : 1;
  }
  const sa = ehNumero(a) ? a : textoDe(a).toUpperCase();
  const sb = ehNumero(b) ? b : textoDe(b).toUpperCase();
  return sa === sb ? 0 : sa < sb ? -1 : 1;
}

const primeiroErro = (...vs: Operando[]): Operando | null => {
  for (const v of vs) if (ehErro(v)) return v;
  return null;
};

// ---------- peças (tokens) ----------

type Peca =
  | { t: "num"; v: number }
  | { t: "txt"; v: string }
  | { t: "ref"; v: string }
  | { t: "outraAba"; v: string }
  | { t: "nome"; v: string }
  | { t: "op"; v: string }
  | { t: "abre" }
  | { t: "fecha" }
  | { t: "sep"; v: number };

const OPERADORES = ["<=", ">=", "<>", "+", "-", "*", "/", "^", "&", "%", "=", "<", ">"];

/** O token atual é um operador? Então devolve o símbolo (ou null). */
function opAtual(p: Peca | undefined): string | null {
  return p?.t === "op" ? p.v : null;
}

/** O token atual é uma referência? Então devolve o A1 (ou null). */
function refAtual(p: Peca | undefined): string | null {
  return p?.t === "ref" ? p.v : null;
}

/** Quebra o texto da fórmula (sem o "=") em peças. */
export function quebrar(formula: string): Peca[] {
  const s = formula.replace(/^=/, "");
  const pecas: Peca[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    // texto entre aspas; "" dentro do texto é uma aspas
    if (c === '"') {
      let j = i + 1;
      let saida = "";
      while (j < s.length) {
        if (s[j] === '"') {
          if (s[j + 1] === '"') {
            saida += '"';
            j += 2;
            continue;
          }
          break;
        }
        saida += s[j];
        j++;
      }
      pecas.push({ t: "txt", v: saida });
      i = Math.min(j + 1, s.length);
      continue;
    }
    if (/\d/.test(c) || (c === "." && /\d/.test(s[i + 1] ?? ""))) {
      const m = /^\d*\.?\d+([eE][+-]?\d+)?/.exec(s.slice(i))!;
      pecas.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    // referência: $A$1, A$1, $A1, A1
    if (/[A-Za-z$\p{L}]/u.test(c)) {
      const m = /^\$?([A-Za-z]{1,3})\$?(\d{1,7})/.exec(s.slice(i));
      if (m) {
        pecas.push({ t: "ref", v: `${m[1].toUpperCase()}${m[2]}` });
        i += m[0].length;
        continue;
      }
      // referência a outra aba: Planilha2!A1 (ainda não suportada)
      const outra = /^([\p{L}_][\p{L}\p{N}_.]*)!(\$?[A-Za-z]{1,3}\$?\d{1,7})(?::(\$?[A-Za-z]{1,3}\$?\d{1,7}))?/u.exec(
        s.slice(i)
      );
      if (outra) {
        pecas.push({ t: "outraAba", v: outra[2].replace(/\$/g, "").toUpperCase() });
        i += outra[0].length;
        continue;
      }
      // nome de função: aceita letras com acento (POTÊNCIA, NÃO, MÍNIMO…)
      const nome = /^[\p{L}_][\p{L}\p{N}_.]*/u.exec(s.slice(i))!;
      pecas.push({ t: "nome", v: nome[0].toUpperCase() });
      i += nome[0].length;
      continue;
    }
    if (c === "(") {
      pecas.push({ t: "abre" });
      i++;
      continue;
    }
    if (c === ")") {
      pecas.push({ t: "fecha" });
      i++;
      continue;
    }
    if (c === "," || c === ";") {
      pecas.push({ t: "sep", v: c === "," ? 1 : 0 });
      i++;
      continue;
    }
    // ":" é o operador de intervalo (A1:C3); os demais são aritméticos e lógicos
    const op = s[i] === ":" ? ":" : OPERADORES.find((o) => s.startsWith(o, i));
    if (op) {
      pecas.push({ t: "op", v: op });
      i += op.length;
      continue;
    }
    i++; // caractere fora do padrão: ignorado
  }
  return pecas;
}

// ---------- árvore ----------

type No =
  | { k: "lit"; v: Operando }
  | { k: "ref"; alvo: string }
  | { k: "faixa"; alvo: Intervalo }
  | { k: "bin"; op: string; a: No; b: No }
  | { k: "un"; op: string; a: No }
  | { k: "pct"; a: No }
  | { k: "chamada"; nome: string; args: No[] };

class ErroSintaxe extends Error {}

class Montador {
  private i = 0;
  constructor(private readonly p: Peca[]) {}

  private atual(): Peca | undefined {
    return this.p[this.i];
  }

  private consome(t: Peca["t"]): boolean {
    if (this.atual()?.t !== t) return false;
    this.i++;
    return true;
  }

  resolver(): No {
    if (!this.p.length) throw new ErroSintaxe("fórmula vazia");
    const no = this.comparacao();
    if (this.atual()) throw new ErroSintaxe("sobrou tokens na fórmula");
    return no;
  }

  private comparacao(): No {
    let a = this.concatenacao();
    for (;;) {
      const op = opAtual(this.atual());
      if (!op || !["=", "<>", "<", ">", "<=", ">="].includes(op)) break;
      this.i++;
      a = { k: "bin", op, a, b: this.concatenacao() };
    }
    return a;
  }

  private concatenacao(): No {
    let a = this.adicao();
    while (opAtual(this.atual()) === "&") {
      this.i++;
      a = { k: "bin", op: "&", a, b: this.adicao() };
    }
    return a;
  }

  private adicao(): No {
    let a = this.multiplicacao();
    for (;;) {
      const op = opAtual(this.atual());
      if (op !== "+" && op !== "-") break;
      this.i++;
      a = { k: "bin", op, a, b: this.multiplicacao() };
    }
    return a;
  }

  private multiplicacao(): No {
    let a = this.potencia();
    for (;;) {
      const op = opAtual(this.atual());
      if (op !== "*" && op !== "/") break;
      this.i++;
      a = { k: "bin", op, a, b: this.potencia() };
    }
    return a;
  }

  private potencia(): No {
    let a = this.unario();
    while (opAtual(this.atual()) === "^") {
      this.i++;
      a = { k: "bin", op: "^", a, b: this.unario() };
    }
    return a;
  }

  private unario(): No {
    const op = opAtual(this.atual());
    if (op === "-" || op === "+") {
      this.i++;
      const a = this.unario();
      return op === "-" ? { k: "un", op: "-", a } : a;
    }
    return this.posFixo();
  }

  private posFixo(): No {
    let a = this.primario();
    while (opAtual(this.atual()) === "%") {
      this.i++;
      a = { k: "pct", a };
    }
    return a;
  }

  private primario(): No {
    const p = this.atual();
    if (!p) throw new ErroSintaxe("fórmula incompleta");
    if (p.t === "num" || p.t === "txt") {
      this.i++;
      return { k: "lit", v: p.v };
    }
    if (p.t === "outraAba") {
      this.i++;
      return { k: "lit", v: new ErroFormula("#REF!") };
    }
    if (p.t === "ref") {
      this.i++;
      if (opAtual(this.atual()) === ":") {
        this.i++;
        const prox = refAtual(this.atual());
        if (prox) {
          this.i++;
          const r = intervalo(`${p.v}:${prox}`);
          if (r) return { k: "faixa", alvo: r };
        }
        throw new ErroSintaxe("faixa inválida");
      }
      return { k: "ref", alvo: p.v };
    }
    if (p.t === "nome") {
      this.i++;
      const nome = p.v;
      if (!this.consome("abre")) {
        // sem parêntese: só faz sentido como VERDADEIRO/FALSO
        if (nome === "VERDADEIRO" || nome === "TRUE") return { k: "lit", v: true };
        if (nome === "FALSO" || nome === "FALSE") return { k: "lit", v: false };
        return { k: "chamada", nome, args: [] };
      }
      const args: No[] = [];
      if (!this.consome("fecha")) {
        do {
          // argumento vazio (SOMA(A1,,B2)) vale célula vazia
          if (this.atual()?.t === "sep") args.push({ k: "lit", v: null });
          else args.push(this.comparacao());
        } while (this.consome("sep"));
        if (!this.consome("fecha")) throw new ErroSintaxe("falta fechar parêntese");
      }
      return { k: "chamada", nome, args };
    }
    if (p.t === "abre") {
      this.i++;
      const a = this.comparacao();
      if (!this.consome("fecha")) throw new ErroSintaxe("falta fechar parêntese");
      return a;
    }
    throw new ErroSintaxe("token inesperado");
  }
}

/** Transforma a fórmula em árvore; null quando a sintaxe está errada. */
export function analisar(formula: string): No | null {
  try {
    return new Montador(quebrar(formula)).resolver();
  } catch {
    return null;
  }
}

// ---------- avaliação ----------

/** O que o avaliador precisa do livro para resolver referências. */
export interface Contexto {
  /** valor já calculado de uma célula da aba atual */
  valorDe(alvo: string): Operando;
  /** valores das células de uma faixa, na ordem (linha a linha) */
  faixaAlvo(alvo: Intervalo): Operando[];
}

/** Funções que recebem faixas inteiras em vez de célula por célula. */
const AGREGACOES = new Set([
  "SOMA", "PROD", "MÉDIA", "MEDIA", "MIN", "MÍN", "MAX", "MÁX",
  "CONT.NÚM", "CONT.NUM", "COUNT", "CONT.VALORES", "COUNTA",
  "MED", "DESVPAD", "STDEV", "DESVPADP", "STDEVP",
]);

/** Funções que precisam receber o erro do argumento em vez de repassá-lo. */
const RECEBEM_ERRO = new Set(["ÉERRO", "ISERROR", "É.NÚMERO", "ISNUMBER", "VAZIO", "ISBLANK"]);

/** Só os números de uma lista de valores (ignora texto, vazio e lógicos). */
function numerosDe(lista: Operando[]): number[] {
  const out: number[] = [];
  for (const v of lista) {
    if (ehErro(v)) throw v;
    if (typeof v === "number") {
      out.push(v);
      continue;
    }
    if (typeof v === "boolean" || v === null) continue;
    const n = comoNumero(v);
    if (ehErro(n)) throw n;
    out.push(n as number);
  }
  return out;
}

function avaliar(no: No, ctx: Contexto, pilha: Set<string>): Operando {
  switch (no.k) {
    case "lit":
      return no.v;
    case "ref": {
      if (pilha.has(no.alvo)) return new ErroFormula("#CIRC!"); // referência circular
      pilha.add(no.alvo);
      try {
        return ctx.valorDe(no.alvo);
      } finally {
        pilha.delete(no.alvo);
      }
    }
    case "faixa":
      // uma faixa usada direto (=A1:B2) devolve a primeira célula, como o Excel
      return ctx.faixaAlvo(no.alvo)[0] ?? null;
    case "un": {
      const a = avaliar(no.a, ctx, pilha);
      if (ehErro(a)) return a;
      const n = comoNumero(a);
      return ehErro(n) || n === null ? n : -n;
    }
    case "pct": {
      const a = avaliar(no.a, ctx, pilha);
      if (ehErro(a)) return a;
      const n = comoNumero(a);
      return ehErro(n) ? n : (n as number) / 100;
    }
    case "bin": {
      const a = avaliar(no.a, ctx, pilha);
      const b = avaliar(no.b, ctx, pilha);
      const erro = primeiroErro(a, b);
      if (erro) return erro;
      if (no.op === "&") return `${textoDe(a)}${textoDe(b)}`;
      if (["=", "<>", "<", ">", "<=", ">="].includes(no.op)) {
        const c = comparar(a, b);
        switch (no.op) {
          case "=":
            return c === 0;
          case "<>":
            return c !== 0;
          case "<":
            return c < 0;
          case ">":
            return c > 0;
          case "<=":
            return c <= 0;
          default:
            return c >= 0;
        }
      }
      const x = comoNumero(a);
      const y = comoNumero(b);
      if (ehErro(x)) return x;
      if (ehErro(y)) return y;
      const p = x as number;
      const q = y as number;
      switch (no.op) {
        case "+":
          return p + q;
        case "-":
          return p - q;
        case "*":
          return p * q;
        case "/":
          return q === 0 ? new ErroFormula("#DIV/0!") : p / q;
        default:
          return Math.pow(p, q);
      }
    }
    case "chamada":
      return chamada(no.nome, no.args, ctx, pilha);
  }
}

/** Executa uma função pelo nome (aceita português e inglês). */
function chamada(nome: string, args: No[], ctx: Contexto, pilha: Set<string>): Operando {
  const n = nome.toUpperCase();

  if (AGREGACOES.has(n)) {
    const lista: Operando[] = [];
    for (const a of args) {
      if (a.k === "faixa") {
        // a chave impede que a função "volte" para dentro da própria faixa
        const chave = `${a.alvo.l1},${a.alvo.c1},${a.alvo.l2},${a.alvo.c2}`;
        if (pilha.has(chave)) return new ErroFormula("#CIRC!");
        pilha.add(chave);
        try {
          lista.push(...ctx.faixaAlvo(a.alvo));
        } finally {
          pilha.delete(chave);
        }
      } else {
        lista.push(avaliar(a, ctx, pilha));
      }
    }
    return agregar(n, lista);
  }

  const vals = args.map((a) => avaliar(a, ctx, pilha));
  // ÉERRO e É.NÚMERO existem justamente para receber o erro do argumento
  if (!RECEBEM_ERRO.has(n)) {
    const erro = primeiroErro(...vals);
    if (erro) return erro;
  }

  switch (n) {
    case "ABS":
      return Math.abs(vals[0] as number);
    case "RAIZ":
    case "SQRT":
      return (vals[0] as number) < 0 ? new ErroFormula("#NÚM!") : Math.sqrt(vals[0] as number);
    case "POTÊNCIA":
    case "POWER":
      return Math.pow(vals[0] as number, vals[1] as number);
    case "INT":
      return Math.floor(vals[0] as number);
    case "ARRED":
    case "ROUND":
      return arredondar(vals[0] as number, vals[1] as number);
    case "ARREDONDAR.PARA.CIMA":
    case "CEILING":
      return Math.ceil(vals[0] as number);
    case "ARREDONDAR.PARA.BAIXO":
    case "FLOOR":
      return Math.floor(vals[0] as number);
    case "MOD":
    case "RESTO": {
      const a = vals[0] as number;
      const b = vals[1] as number;
      if (b === 0) return new ErroFormula("#DIV/0!");
      return a - b * Math.floor(a / b); // resto com o sinal do dividendo
    }
    case "PI":
      return Math.PI;
    case "SOMASE":
      return somase(args, ctx, pilha, false);
    case "CONT.SE":
    case "COUNTIF":
      return somase(args, ctx, pilha, true);
    case "SE":
    case "IF": {
      const teste = comoBooleano(vals[0]);
      if (teste) return vals[1] ?? null;
      return vals.length > 2 ? vals[2] : false;
    }
    case "E":
    case "AND":
      return vals.every(comoBooleano);
    case "OU":
    case "OR":
      return vals.some(comoBooleano);
    case "NÃO":
    case "NOT":
      return !comoBooleano(vals[0]);
    case "NÃO.VAZIO":
    case "COUNTA":
      return vals.filter((v) => v !== null && v !== "").length;
    case "VAZIO":
    case "ISBLANK":
      return vals[0] === null;
    case "ÉERRO":
    case "ISERROR":
      return ehErro(vals[0]);
    case "É.NÚMERO":
    case "ISNUMBER":
      return typeof vals[0] === "number";
    case "TEXTO":
    case "CONCATENAR":
    case "CONCAT":
      return vals.map(textoDe).join("");
    case "NÚM.CARACT":
    case "LEN":
      return textoDe(vals[0]).length;
    case "MAIÚSCULA":
    case "UPPER":
      return textoDe(vals[0]).toUpperCase();
    case "MINÚSCULA":
    case "LOWER":
      return textoDe(vals[0]).toLowerCase();
    case "ESPAÇOS":
    case "TRIM":
      return textoDe(vals[0]).trim().replace(/\s+/g, " ");
    case "ESQUERDA":
    case "LEFT":
      return textoDe(vals[0]).slice(0, Math.max(0, Math.trunc(vals[1] as number)));
    case "DIREITA":
    case "RIGHT": {
      const s = textoDe(vals[0]);
      const n = Math.max(0, Math.trunc(vals[1] as number));
      return n === 0 ? "" : s.slice(Math.max(0, s.length - n));
    }
    case "EXT.TEXTO":
    case "MID": {
      const s = textoDe(vals[0]);
      const ini = Math.max(1, Math.trunc(vals[1] as number));
      const n = Math.max(0, Math.trunc(vals[2] as number));
      return s.slice(ini - 1, ini - 1 + n);
    }
    case "HOJE":
    case "TODAY":
      return Math.floor((Date.now() - EPOCH_MS) / DIA_MS);
    case "AGORA":
    case "NOW":
      return Math.floor((Date.now() - EPOCH_MS) / DIA_MS + 0.5);
    default:
      return new ErroFormula(`#NOME? (${nome})`);
  }
}

/** Reduz as funções de agregação a um número. */
function agregar(nome: string, lista: Operando[]): Operando {
  const nums = numerosDe(lista);
  switch (nome) {
    case "SOMA":
      return nums.reduce((a, b) => a + b, 0);
    case "PROD":
    case "PRODUCT":
      return nums.length ? nums.reduce((a, b) => a * b, 1) : 0;
    case "MÉDIA":
    case "MEDIA":
    case "AVERAGE":
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : new ErroFormula("#DIV/0!");
    case "MIN":
    case "MÍN":
      return nums.length ? Math.min(...nums) : 0;
    case "MAX":
    case "MÁX":
      return nums.length ? Math.max(...nums) : 0;
    case "CONT.NÚM":
    case "COUNT":
    case "CONT.NUM":
      return nums.length;
    case "CONT.VALORES":
    case "COUNTA":
      return lista.filter((v) => v !== null && v !== "").length;
    case "MED":
      if (!nums.length) return new ErroFormula("#NÚM!");
      const o = [...nums].sort((a, b) => a - b);
      const meio = o.length >> 1;
      return o.length % 2 ? o[meio] : (o[meio - 1] + o[meio]) / 2;
    case "DESVPAD":
    case "STDEV":
      return nums.length < 2 ? new ErroFormula("#DIV/0!") : desvio(nums, true);
    case "DESVPADP":
    case "STDEVP":
      return nums.length < 2 ? new ErroFormula("#DIV/0!") : desvio(nums, false);
    default:
      return new ErroFormula("#NOME?");
  }
}

function desvio(nums: number[], amostra: boolean): number {
  const media = nums.reduce((a, b) => a + b, 0) / nums.length;
  const soma = nums.reduce((a, b) => a + (b - media) ** 2, 0);
  return Math.sqrt(soma / (nums.length - (amostra ? 1 : 0)));
}

/** Arredonda como o Excel (2,675 vira 2,68; o JS puro daria 2,67). */
function arredondar(n: number, casas: number): number {
  const c = Math.max(0, Math.min(10, Math.trunc(casas)));
  // o truque do expoente evita o clássico 2,675 -> 2,67 do JavaScript
  return Math.round(Number(`${n}e${c}`)) / f(c);
}

const f = (c: number): number => 10 ** c;

/** SOMASE/CONT.SE: soma (ou conta) as células da faixa que passam no critério. */
function somase(args: No[], ctx: Contexto, pilha: Set<string>, apenasConta: boolean): Operando {
  const crit = args[0];
  if (crit?.k !== "faixa") return new ErroFormula("#VALOR!");
  const alvo = crit.alvo;
  const cond = args[1];
  if (!cond) return new ErroFormula("#VALOR!");
  const somaAlvo = args[2]?.k === "faixa" ? args[2].alvo : null;
  const valoresCrit = ctx.faixaAlvo(alvo);
  const totalLinhas = alvo.l2 - alvo.l1 + 1;

  let soma = 0;
  let conta = 0;
  for (let i = 0; i < valoresCrit.length; i++) {
    const alvoCelula = somaAlvo
      ? { ...somaAlvo, l1: somaAlvo.l1 + i, l2: somaAlvo.l1 + i, c1: somaAlvo.c1, c2: somaAlvo.c2 }
      : null;
    const daVez = alvoCelula ? ctx.faixaAlvo(alvoCelula)[0] ?? null : null;
    if (!passaNoCriterio(valoresCrit[i], cond, ctx, pilha)) continue;
    conta++;
    if (!apenasConta && typeof daVez === "number") soma += daVez;
  }
  void totalLinhas;
  return apenasConta ? conta : soma;
}

/** O valor da célula passa no critério? Aceita ">10", "A*", "<>x" e texto exato. */
function passaNoCriterio(v: Operando, cond: No, ctx: Contexto, pilha: Set<string>): boolean {
  const alvo = avaliar(cond, ctx, pilha);
  if (ehErro(alvo)) return false;
  if (typeof alvo === "string") {
    const s = alvo.trim();
    // ">=10", "<>5", "<=abc": compara com o número/texto do outro lado
    const m = /^(>=|<=|<>|>|<|=)\s*(.*)$/.exec(s);
    if (m) {
      const resto = m[2].trim();
      const numero = Number(resto.replace(",", "."));
      const outro: Operando = Number.isFinite(numero) && resto !== "" ? numero : resto;
      const c = comparar(v, outro);
      switch (m[1]) {
        case ">=":
          return c >= 0;
        case "<=":
          return c <= 0;
        case "<>":
          return c !== 0;
        case ">":
          return c > 0;
        case "<":
          return c < 0;
        default:
          return c === 0;
      }
    }
    if (/[*?]/.test(s)) {
      // curinga do Excel: * qualquer sequência, ? um caractere
      const re = new RegExp(
        `^${s.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`,
        "i"
      );
      return re.test(textoDe(v));
    }
  }
  return comparar(v, alvo) === 0;
}

// ---------- porta de entrada ----------

/** Calcula uma fórmula. Nunca lança: devolve o erro do Excel para a grade mostrar. */
export function calcular(formula: string, ctx: Contexto): Operando {
  const no = analisar(formula);
  if (!no) return new ErroFormula("#ERRO!");
  try {
    return avaliar(no, ctx, new Set());
  } catch (e) {
    return ehErro(e) ? e : new ErroFormula("#VALOR!");
  }
}

/** O texto começa com "=" e portanto é fórmula? */
export const ehFormula = (texto: string): boolean => texto.trimStart().startsWith("=");

/** Monta a fórmula de um botão de agregação (ex.: "=SOMA(B2:B10)"). */
export function formulaAgregacao(fn: string, faixaRef: string): string {
  return `=${fn}(${faixaRef})`;
}

/** Texto pronto para desenhar na grade (inclusive os erros, sem.classes). */
export function valorFormatado(v: Operando, cfg: ConfigPlanilha, estilo?: Estilo): string {
  if (ehErro(v)) return v.codigo;
  return valorParaTexto(v, estilo, cfg);
}

export { ref, ErroFormula, ehErro };