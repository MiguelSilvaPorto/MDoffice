// Teste rápido da lógica de patch: aplica, desfaz e reconstrói versões.
// Roda com: npx tsx scripts/testar-snapshots.mts
import { linhasLadoALado } from "../src/history.ts";
import { applyOps, diffText, revertOps } from "../src/snapshots.ts";

let falhas = 0;
function checa(nome: string, ok: boolean, detalhe = "") {
  if (ok) {
    console.log(`  ok   ${nome}`);
  } else {
    falhas++;
    console.log(`  FALHA ${nome} ${detalhe}`);
  }
}

console.log("diff/apply/revert");

// 1. texto novo do zero
{
  const ops = diffText("", "Olá mundo");
  checa("do vazio", applyOps("", ops) === "Olá mundo", JSON.stringify(ops));
}

// 2. texto apagado
{
  const ops = diffText("Olá mundo", "");
  checa("para o vazio", applyOps("Olá mundo", ops) === "");
}

// 3. trocar uma palavra no meio de um parágrafo longo
{
  const antes = "A ".repeat(500) + "gato" + " B ".repeat(500);
  const depois = antes.replace("gato", "cachorro");
  const ops = diffText(antes, depois);
  checa("troca no meio de texto longo", applyOps(antes, ops) === depois, `${ops.length} ops: ${JSON.stringify(ops).slice(0, 200)}`);
  checa(
    "patch pequeno para texto longo",
    ops.length <= 2 && ops[0].next.length < 20 && ops[0].prev.length < 20,
    JSON.stringify(ops).slice(0, 200)
  );
  checa("desfazer volta ao original", revertOps(depois, ops) === antes);
}

// 4. insertion no início, meio e fim
{
  const base = "linha um\nlinha dois\nlinha três";
  for (const [antes, depois] of [
    ["XX\n" + base, base],
    [base + "\nXX", base],
    ["linha um\nXX\nlinha dois\nlinha três", base],
  ] as [string, string][]) {
    const ops = diffText(antes, depois);
    checa(`inserir/remover ${JSON.stringify(depois).slice(0, 20)}`, applyOps(antes, ops) === depois, JSON.stringify(ops));
    checa(`  └ desfazer`, revertOps(depois, ops) === antes);
  }
}

// 5. apagar parágrafos inteiros
{
  const antes = "# T\n\np1\n\np2\n\np3\n";
  const depois = "# T\n\np1\n";
  const ops = diffText(antes, depois);
  checa("apagar parágrafos", applyOps(antes, ops) === depois, JSON.stringify(ops));
  checa("  └ desfazer", revertOps(depois, ops) === antes);
}

// 6. vários comandos seguidos reconstruem o texto
{
  const textos = [
    "primeiro texto",
    "primeiro texto com mais uma frase",
    "primeiro texto com mais uma frase!\n\nsegundo parágrafo",
    "outro texto totalmente diferente",
    "",
  ];
  let atual = textos[0];
  const todos: { texto: string; ops: ReturnType<typeof diffText> }[] = [];
  for (let i = 1; i < textos.length; i++) {
    const ops = diffText(atual, textos[i]);
    checa(`passo ${i}`, applyOps(atual, ops) === textos[i]);
    todos.push({ texto: textos[i], ops });
    atual = textos[i];
  }
  // desfazendo na ordem inversa volta ao começo
  let volta = atual;
  for (let i = todos.length - 1; i >= 0; i--) volta = revertOps(volta, todos[i].ops);
  checa("desfazer todos volta ao início", volta === textos[0], JSON.stringify(volta));
}

// 7. unicode e emojis (o app edita português com acento)
{
  const antes = "# Título\n\nAção e coração ❤️ fim.";
  const depois = "# Título novo\n\nAção, reação e coração ❤️ fim.";
  const ops = diffText(antes, depois);
  checa("unicode", applyOps(antes, ops) === depois, JSON.stringify(ops));
  checa("  └ desfazer unicode", revertOps(depois, ops) === antes);
}

// 8. documento gigante não trava (cai no caminho de substitution)
{
  const grande = "palavra ".repeat(30_000);
  const t0 = Date.now();
  const ops = diffText(grande, grande + "fim");
  const ms = Date.now() - t0;
  checa("documento grande em menos de 3s", ms < 3000, `${ms}ms`);
  checa("  └ apply correto", applyOps(grande, ops) === grande + "fim");
}

// 9. ids do IndexedDB não são usados aqui: só a lógica pura
checa("diffText de textos iguais devolve vazio", diffText("igual", "igual").length === 0);

// 10. histórico: o diff lado a lado (antes × depois, pareados linha a linha)
{
  const antes = ["# T", "", "a", "b", "c", "d"].join("\n");
  const depois = ["# T", "", "a", "B", "c", "d"].join("\n");
  checa("sem mudanças não há linhas (a tela mostra o aviso)", linhasLadoALado(antes, antes).length === 0);
  const rows = linhasLadoALado(antes, depois);
  const mudanca = rows.filter((r) => r.kind === "mudanca");
  checa(
    "a troca vira UMA linha: o antes à esquerda, o depois à direita",
    mudanca.length === 1 && mudanca[0].esq?.text === "b" && mudanca[0].dir?.text === "B",
    JSON.stringify(mudanca)
  );
  checa(
    "o contexto sai pareado nos dois lados",
    rows.some((r) => r.kind === "same" && r.esq?.text === "a" && r.dir?.text === "a"),
    JSON.stringify(rows.slice(0, 3))
  );
  checa("o trecho longe da mudança vira um pulo", rows.some((r) => r.kind === "pulo"), JSON.stringify(rows));
  const ins = linhasLadoALado("a\nc", "a\nb\nc").filter((r) => r.kind === "mudanca");
  checa("inserção deixa a esquerda vazia", ins.length === 1 && ins[0].esq === null && ins[0].dir?.text === "b", JSON.stringify(ins));
  const rem = linhasLadoALado("a\nb\nc", "a\nc").filter((r) => r.kind === "mudanca");
  checa("remoção deixa a direita vazia", rem.length === 1 && rem[0].esq?.text === "b" && rem[0].dir === null, JSON.stringify(rem));
  const bloco = linhasLadoALado("x1\nx2\nx3", "y1\ny2").filter((r) => r.kind === "mudanca");
  checa(
    "bloco pareia até o fim e sobra o excedente do lado maior",
    bloco.length === 3 && bloco[0].esq?.text === "x1" && bloco[1].dir?.text === "y2" && bloco[2].esq?.text === "x3" && bloco[2].dir === null,
    JSON.stringify(bloco)
  );
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);