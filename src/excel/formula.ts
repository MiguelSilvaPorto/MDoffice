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
import {
  ErroFormula,
  ehErro,
  numeroDe,
  dataDe,
  dataParaSerial,
  serialParaDataHora,
  valorParaTexto,
  type Valor,
} from "./values";
import type { ConfigPlanilha, Estilo } from "./schema";

/** O que o avaliador entrega ao motor: número, texto, booleano, vazio ou erro. */
export type Operando = Valor | ErroFormula;

const EPOCH_MS = Date.UTC(1899, 11, 30);
const DIA_MS = 86_400_000;

/** Texto como o Excel mostra (VERDADEIRO/FALSO e número com vírgula). */
export function textoDe(v: Operando): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "VERDADEIRO" : "FALSO";
  if (typeof v === "number") {
    // conversão para texto (concatenação, critérios) NÃO usa separador de milhar
    const s = String(v);
    return s.includes(".") && !s.includes("e") && !s.includes("E") ? s.replace(".", ",") : s;
  }
  return String(v);
}

/** Converte para número como as funções fazem; #VALOR! quando não dá. */
function comoNumero(v: Operando): Operando {
  if (ehErro(v)) return v;
  if (typeof v === "number") return v;
  if (v === null) return 0; // célula vazia vale zero nas operações
  if (typeof v === "boolean") return v ? 1 : 0;
  const s = textoDe(v).trim();
  if (!s) return 0;
  // a mesma regra da célula: "1.234,56" vale 1234,56, mas "Item 1" não é número
  const n = numeroDe(s);
  if (n !== null) return n;
  const d = dataDe(s);
  return d ? dataParaSerial(d) : new ErroFormula("#VALOR!");
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

/** Compara como o Excel: número < texto < lógico; texto sem diferenciar caixa. */
function comparar(a: Operando, b: Operando): number {
  if (ehErro(a) || ehErro(b)) return 0;
  // célula vazia assume o tipo do outro lado (vazia = 0, vazia = "", vazia = FALSO)
  const na =
    a === null ? (typeof b === "string" ? "" : typeof b === "boolean" ? (b ? false : false) : 0) : a;
  const nb =
    b === null ? (typeof a === "string" ? "" : typeof a === "boolean" ? (a ? false : false) : 0) : b;
  const tipo = (v: Operando): number => (typeof v === "number" ? 0 : typeof v === "string" ? 1 : 2);
  const ta = tipo(na);
  const tb = tipo(nb);
  if (ta !== tb) return ta < tb ? -1 : 1;
  if (typeof na === "number" && typeof nb === "number") return na === nb ? 0 : na < nb ? -1 : 1;
  if (typeof na === "boolean" && typeof nb === "boolean") return na === nb ? 0 : na ? 1 : -1;
  const sa = textoDe(na).toUpperCase();
  const sb = textoDe(nb).toUpperCase();
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

/**
 * Aceita os números como a pessoa digita em português: `1.234,56`, `1,5`, `10%`.
 * O avaliador trabalha com o ponto decimal; a conversão é feita só fora do texto
 * entre aspas. Quando a fórmula tem `;` (separador pt-BR), a vírgula é decimal;
 * sem `;` e sem chamada de função, também. `1.234` é milhar.
 */
function normalizarNumeros(formula: string): string {
  if (!/[.,]/.test(formula)) return formula;
  const temSeparador = formula.includes(";");
  const temFuncao = formula.includes("(");
  const converter = !temSeparador && temFuncao ? false : true;
  if (!converter) return formula;
  const partes = formula.split('"');
  for (let k = 0; k < partes.length; k += 2) {
    partes[k] = partes[k]
      // 1.234,56 (ponto de milhar + vírgula decimal) -> 1234.56
      .replace(/(\d{1,3}(?:\.\d{3})+),(\d+)/g, (_, inteiro: string, dec: string) => `${inteiro.replace(/\./g, "")}.${dec}`)
      .replace(/(\d),(\d)/g, "$1.$2");
  }
  return partes.join('"');
}

/** Quebra o texto da fórmula (sem o "=") em peças. */
export function quebrar(formula: string): Peca[] {
  const s = normalizarNumeros(formula).replace(/^=/, "");
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
    const a = this.unario();
    // no Excel a potência associa à direita: 2^3^2 = 2^(3^2) = 512
    if (opAtual(this.atual()) === "^") {
      this.i++;
      return { k: "bin", op: "^", a, b: this.potencia() };
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
  "SOMA", "SUM", "PROD", "PRODUCT", "MÉDIA", "MEDIA", "AVERAGE", "MIN", "MÍN", "MAX", "MÁX",
  "CONT.NÚM", "CONT.NUM", "COUNT", "CONT.VALORES", "COUNTA",
  "MED", "MEDIAN", "DESVPAD", "STDEV", "DESVPADP", "STDEVP",
]);

/** Funções que precisam receber o erro do argumento em vez de repassá-lo. */
const RECEBEM_ERRO = new Set(["ÉERRO", "ISERROR", "É.NÚMERO", "ISNUMBER", "VAZIO", "ISBLANK"]);

/** Item de uma agregação: o valor e se ele veio de uma faixa (o Excel ignora texto de faixa). */
interface ItemAgregacao {
  valor: Operando;
  deFaixa: boolean;
}

/** Só os números de uma lista de valores (ignora texto de faixa; converte texto solto). */
function numerosDe(itens: ItemAgregacao[]): number[] {
  const out: number[] = [];
  for (const { valor: v, deFaixa } of itens) {
    if (ehErro(v)) throw v;
    if (typeof v === "number") {
      out.push(v);
      continue;
    }
    if (v === null || v === "") continue;
    // dentro de uma faixa, texto e lógico não entram na conta (como no Excel)
    if (deFaixa) continue;
    if (typeof v === "boolean") {
      out.push(v ? 1 : 0);
      continue;
    }
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
    const itens: ItemAgregacao[] = [];
    for (const a of args) {
      if (a.k === "faixa") {
        // a chave impede que a função "volte" para dentro da própria faixa
        const chave = `${a.alvo.l1},${a.alvo.c1},${a.alvo.l2},${a.alvo.c2}`;
        if (pilha.has(chave)) return new ErroFormula("#CIRC!");
        pilha.add(chave);
        try {
          for (const v of ctx.faixaAlvo(a.alvo)) itens.push({ valor: v, deFaixa: true });
        } finally {
          pilha.delete(chave);
        }
      } else {
        itens.push({ valor: avaliar(a, ctx, pilha), deFaixa: false });
      }
    }
    return agregar(n, itens);
  }

  // SE/E/OU são preguiçosos: o ramo que não vale não é calculado (como no Excel),
  // então =SE(A1=0;0;1/A1) devolve 0 em vez de #DIV/0!.
  if (n === "SE" || n === "IF") {
    if (!args.length) return new ErroFormula("#VALOR!");
    const teste = avaliar(args[0], ctx, pilha);
    if (ehErro(teste)) return teste;
    if (comoBooleano(teste)) return args[1] ? avaliar(args[1], ctx, pilha) : true;
    return args[2] ? avaliar(args[2], ctx, pilha) : false;
  }
  if (n === "E" || n === "AND") {
    for (const a of args) {
      const v = avaliar(a, ctx, pilha);
      if (ehErro(v)) return v;
      if (!comoBooleano(v)) return false;
    }
    return true;
  }
  if (n === "OU" || n === "OR") {
    for (const a of args) {
      const v = avaliar(a, ctx, pilha);
      if (ehErro(v)) return v;
      if (comoBooleano(v)) return true;
    }
    return false;
  }

  // CONCATENAR/CONCAT aceitam faixas e juntam todas as células (o Excel faz isso)
  if (n === "CONCATENAR" || n === "CONCAT") {
    return args
      .map((a) =>
        a.k === "faixa" ? ctx.faixaAlvo(a.alvo).map((v) => textoDe(v)).join("") : textoDe(avaliar(a, ctx, pilha))
      )
      .join("");
  }

  const vals = args.map((a) => avaliar(a, ctx, pilha));
  // ÉERRO e É.NÚMERO existem justamente para receber o erro do argumento
  if (!RECEBEM_ERRO.has(n)) {
    const erro = primeiroErro(...vals);
    if (erro) return erro;
  }

  // as funções numéricas convertem com a regra pt-BR e devolvem #VALOR! em vez de NaN
  const num = (i: number, padrao = 0): Operando => {
    const v = vals[i];
    if (v === undefined) return padrao;
    return comoNumero(v);
  };

  switch (n) {
    case "ABS": {
      const a = num(0);
      return ehErro(a) ? a : Math.abs(a as number);
    }
    case "RAIZ":
    case "SQRT": {
      const a = num(0);
      if (ehErro(a)) return a;
      return (a as number) < 0 ? new ErroFormula("#NÚM!") : Math.sqrt(a as number);
    }
    case "POTÊNCIA":
    case "POWER": {
      const a = num(0);
      const b = num(1);
      if (ehErro(a)) return a;
      if (ehErro(b)) return b;
      return Math.pow(a as number, b as number);
    }
    case "INT": {
      const a = num(0);
      return ehErro(a) ? a : Math.floor(a as number);
    }
    case "ARRED":
    case "ROUND": {
      const a = num(0);
      const b = num(1, 0);
      if (ehErro(a)) return a;
      if (ehErro(b)) return b;
      return arredondar(a as number, b as number);
    }
    case "ARREDONDAR.PARA.CIMA":
    case "CEILING": {
      const a = num(0);
      return ehErro(a) ? a : Math.ceil(a as number);
    }
    case "ARREDONDAR.PARA.BAIXO":
    case "FLOOR": {
      const a = num(0);
      return ehErro(a) ? a : Math.floor(a as number);
    }
    case "MOD":
    case "RESTO": {
      const a = num(0);
      const b = num(1);
      if (ehErro(a)) return a;
      if (ehErro(b)) return b;
      if ((b as number) === 0) return new ErroFormula("#DIV/0!");
      return (a as number) - (b as number) * Math.floor((a as number) / (b as number)); // resto com o sinal do dividendo
    }
    case "PI":
      return Math.PI;
    case "SOMASE":
    case "SUMIF":
      return somase(args, ctx, pilha, false);
    case "CONT.SE":
    case "COUNTIF":
      return somase(args, ctx, pilha, true);
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
    case "TEXT":
      return formatarComoTexto(vals[0], textoDe(vals[1] ?? ""));
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
      return textoDe(vals[0]).slice(0, Math.max(0, Math.trunc((vals[1] as number) ?? 1)));
    case "DIREITA":
    case "RIGHT": {
      const s = textoDe(vals[0]);
      const n = Math.max(0, Math.trunc((vals[1] as number) ?? 1));
      return n === 0 ? "" : s.slice(Math.max(0, s.length - n));
    }
    case "EXT.TEXTO":
    case "MID": {
      const s = textoDe(vals[0]);
      const ini = Math.max(1, Math.trunc((vals[1] as number) ?? 1));
      const n = Math.max(0, Math.trunc((vals[2] as number) ?? 0));
      return s.slice(ini - 1, ini - 1 + n);
    }
    case "HOJE":
    case "TODAY":
      return Math.floor((Date.now() - EPOCH_MS) / DIA_MS);
    case "AGORA":
    case "NOW":
      return Math.floor((Date.now() - EPOCH_MS) / DIA_MS + 0.5);
    default:
      return new ErroFormula("#NOME?");
  }
}

/** Reduz as funções de agregação a um número. */
function agregar(nome: string, itens: ItemAgregacao[]): Operando {
  const nums = numerosDe(itens);
  switch (nome) {
    case "SOMA":
    case "SUM":
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
      return itens.filter(({ valor }) => valor !== null && valor !== "").length;
    case "MED":
    case "MEDIAN":
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

/** Arredonda como o Excel (2,675 vira 2,68; casas negativas arredondam o inteiro). */
function arredondar(n: number, casas: number): number {
  if (!Number.isFinite(n)) return n;
  const c = Math.max(-10, Math.min(10, Math.trunc(casas)));
  const fator = 10 ** c;
  const x = n * fator;
  if (!Number.isFinite(x)) return n;
  // toPrecision tira o ruído binário (2,675*100 = 267,49999…) e o sinal preserva
  // o comportamento do Excel nos negativos (-2,675 -> -2,68)
  const arredondado = Math.sign(x) * Math.round(Math.abs(Number(x.toPrecision(15))));
  return arredondado / fator;
}

/** SOMASE/CONT.SE: soma (ou conta) as células da faixa que passam no critério. */
function somase(args: No[], ctx: Contexto, pilha: Set<string>, apenasConta: boolean): Operando {
  const crit = args[0];
  if (crit?.k !== "faixa") return new ErroFormula("#VALOR!");
  const alvo = crit.alvo;
  const cond = args[1];
  if (!cond) return new ErroFormula("#VALOR!");
  const somaAlvo = args[2]?.k === "faixa" ? args[2].alvo : null;
  const valoresCrit = ctx.faixaAlvo(alvo);
  const larguraCrit = alvo.c2 - alvo.c1 + 1;
  const larguraSoma = somaAlvo ? somaAlvo.c2 - somaAlvo.c1 + 1 : larguraCrit;

  let soma = 0;
  let conta = 0;
  for (let i = 0; i < valoresCrit.length; i++) {
    // o índice anda linha a linha; a coluna vem do resto da divisão (intervalos
    // de várias colunas ficavam desalinhados e somavam a célula errada)
    const dl = Math.floor(i / larguraCrit);
    const dc = i % larguraCrit;
    const foraSoma = somaAlvo ? dc >= larguraSoma || somaAlvo.l1 + dl > somaAlvo.l2 : false;
    const daVez = somaAlvo
      ? foraSoma
        ? null
        : ctx.faixaAlvo({ l1: somaAlvo.l1 + dl, l2: somaAlvo.l1 + dl, c1: somaAlvo.c1 + dc, c2: somaAlvo.c1 + dc })[0] ?? null
      : valoresCrit[i];
    if (!passaNoCriterio(valoresCrit[i], cond, ctx, pilha)) continue;
    conta++;
    if (!apenasConta && typeof daVez === "number") soma += daVez;
  }
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
      const numero = numeroDe(resto);
      const outro: Operando = numero !== null ? numero : resto;
      // critério numérico ignora texto na faixa (como o Excel)
      if (typeof outro === "number" && typeof v !== "number" && m[1] !== "<>") return false;
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
  // critério sem operador: "10" casa com o número 10 (e "A*" já foi tratado acima)
  const numero = numeroDe(String(alvo));
  return comparar(v, numero !== null ? numero : alvo) === 0;
}

/** Formata um número como o TEXTO do Excel (os códigos mais comuns). */
function formatarComoTexto(v: Operando, codigo: string): string {
  if (ehErro(v)) return v.codigo;
  if (typeof v !== "number") return textoDe(v);
  const c = codigo.replace(/\[[^\]]*\]/g, "");
  if (/%/.test(c)) {
    const casas = /[.,](0+)/.exec(c)?.[1].length ?? 0;
    return `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
  }
  if (/(^|[^a-z])[dmyhs]{1,4}/i.test(c) && !/[#0]/.test(c.replace(/[dmyhs]/gi, ""))) {
    const d = serialParaDataHora(v);
    if (d) {
      const base = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
      if (/h/i.test(c)) {
        return `${base} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
      }
      return base;
    }
  }
  const casas = /[.,](0+)/.exec(c)?.[1].length ?? 0;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

// ---------- nomes de função: português <-> inglês ----------

/**
 * O .xlsx guarda as fórmulas em inglês. Esta tabela traduz os dois sentidos para
 * que um arquivo do Excel com =SUM(A1:A2) funcione aqui e um =SOMA(...) nosso
 * abra no Excel. As duas grafias continuam aceitas pelo avaliador.
 */
const NOMES_FORMULA: [string, string][] = [
  ["SOMA", "SUM"],
  ["PROD", "PRODUCT"],
  ["MÉDIA", "AVERAGE"],
  ["MEDIA", "AVERAGE"],
  ["MÍN", "MIN"],
  ["MIN", "MIN"],
  ["MÁX", "MAX"],
  ["MAX", "MAX"],
  ["CONT.NÚM", "COUNT"],
  ["CONT.NUM", "COUNT"],
  ["CONT.VALORES", "COUNTA"],
  ["COUNTA", "COUNTA"],
  ["MED", "MEDIAN"],
  ["DESVPAD", "STDEV"],
  ["DESVPADP", "STDEVP"],
  ["SE", "IF"],
  ["E", "AND"],
  ["OU", "OR"],
  ["NÃO", "NOT"],
  ["NÃO.VAZIO", "COUNTA"],
  ["VAZIO", "ISBLANK"],
  ["ÉERRO", "ISERROR"],
  ["É.NÚMERO", "ISNUMBER"],
  ["TEXTO", "TEXT"],
  ["CONCATENAR", "CONCATENATE"],
  ["CONCAT", "CONCAT"],
  ["NÚM.CARACT", "LEN"],
  ["MAIÚSCULA", "UPPER"],
  ["MINÚSCULA", "LOWER"],
  ["ESPAÇOS", "TRIM"],
  ["ESQUERDA", "LEFT"],
  ["DIREITA", "RIGHT"],
  ["EXT.TEXTO", "MID"],
  ["HOJE", "TODAY"],
  ["AGORA", "NOW"],
  ["ABS", "ABS"],
  ["RAIZ", "SQRT"],
  ["POTÊNCIA", "POWER"],
  ["INT", "INT"],
  ["ARRED", "ROUND"],
  ["ARREDONDAR.PARA.CIMA", "CEILING"],
  ["ARREDONDAR.PARA.BAIXO", "FLOOR"],
  ["MOD", "MOD"],
  ["RESTO", "MOD"],
  ["PI", "PI"],
  ["SOMASE", "SUMIF"],
  ["CONT.SE", "COUNTIF"],
];

const PT_PARA_EN = new Map(NOMES_FORMULA);
const EN_PARA_PT = new Map<string, string>();
for (const [pt, en] of NOMES_FORMULA) if (!EN_PARA_PT.has(en)) EN_PARA_PT.set(en, pt);

/** Troca os nomes de função (fora do texto entre aspas), mantendo referências e números. */
export function traduzirFormula(formula: string, paraIngles: boolean): string {
  const mapa = paraIngles ? PT_PARA_EN : EN_PARA_PT;
  let saida = "";
  let i = 0;
  while (i < formula.length) {
    const c = formula[i];
    if (c === '"') {
      let j = i + 1;
      while (j < formula.length) {
        if (formula[j] === '"') {
          if (formula[j + 1] === '"') {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      saida += formula.slice(i, Math.min(j + 1, formula.length));
      i = Math.min(j + 1, formula.length);
      continue;
    }
    if (/[\p{L}_]/u.test(c) && !/[\p{L}\p{N}_.]/u.test(formula[i - 1] ?? "")) {
      const m = /^[\p{L}_][\p{L}\p{N}_.]*/u.exec(formula.slice(i));
      if (m) {
        let j = i + m[0].length;
        while (/\s/.test(formula[j] ?? "")) j++;
        if (formula[j] === "(") {
          const traduzido = mapa.get(m[0].toUpperCase());
          saida += traduzido ?? m[0];
          i += m[0].length;
          continue;
        }
      }
    }
    saida += c;
    i++;
  }
  return saida;
}

/** Fórmula pronta para o XML do .xlsx: inglês, vírgula entre argumentos e ponto decimal. */
export function formulaParaXlsx(formula: string): string {
  let f = traduzirFormula(normalizarNumeros(formula), true);
  // separador de argumentos do XML é sempre a vírgula (fora do texto)
  const partes = f.split('"');
  for (let k = 0; k < partes.length; k += 2) {
    partes[k] = partes[k].replace(/;/g, ",").replace(/\bVERDADEIRO\b/gi, "TRUE").replace(/\bFALSO\b/gi, "FALSE");
  }
  f = partes.join('"');
  return f.replace(/^=/, "");
}

// ---------- porta de entrada ----------

/** Calcula uma fórmula. Nunca lança: devolve o erro do Excel para a grade mostrar. */
export function calcular(formula: string, ctx: Contexto): Operando {
  if (formula.trim() === "=#REF!" || formula.replace(/"[^"]*"/g, "").includes("#REF!")) {
    return new ErroFormula("#REF!");
  }
  const no = analisar(formula);
  if (!no) return new ErroFormula("#ERRO!");
  try {
    const r = avaliar(no, ctx, new Set());
    // Infinity/NaN não podem virar o texto "NaN" dentro da célula
    if (typeof r === "number" && !Number.isFinite(r)) return new ErroFormula("#NÚM!");
    return r;
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