// Resolvedor do rebase (reutilizável durante o fecho desta promoção). Apagar depois.
// CHANGELOG: mantém o lado da main, tirando o MEU bloco (promovido) e a cópia duplicada do
// gerador (a entrada dele já está no "Adicionado").
// historico: mantém os DOIS lados (as notas das outras sessões e a minha).
import { readFileSync, writeFileSync } from "node:fs";

const marcas = (t) => (t.match(/^(<<<<<<<|=======|>>>>>>>)/gm) || []).length;

// --- CHANGELOG ---
{
  const arquivo = "CHANGELOG.md";
  let t = readFileSync(arquivo, "utf8");
  if (marcas(t)) {
    const linhas = t.split(/\r?\n/);
    const ini = linhas.findIndex((l) => l === "<<<<<<< HEAD");
    const meio = linhas.findIndex((l, i) => i > ini && l === "=======");
    const fim = linhas.findIndex((l, i) => i > meio && l.startsWith(">>>>>>> "));
    if (ini < 0 || meio < 0 || fim < 0) throw new Error("marcas do CHANGELOG em lugar inesperado");
    let corpo = linhas.slice(ini + 1, meio);
    const tiraBloco = (ls, primeira, ultima) => {
      const a = ls.findIndex((l) => l.startsWith(primeira));
      if (a < 0) return ls; // já não está (promoção já resolvida antes)
      let b = a;
      while (b < ls.length && !ultima.test(ls[b])) b++;
      if (b >= ls.length) throw new Error("não achei o fim do bloco: " + primeira);
      const fimBloco = b + 1 < ls.length && ls[b + 1] === "" ? b + 2 : b + 1;
      return ls.slice(0, a).concat(ls.slice(fimBloco));
    };
    corpo = tiraBloco(corpo, "- **Fita: os menus de forma abrem mesmo sem forma escolhida", /sem seleção, como no PowerPoint\.$/);
    corpo = tiraBloco(corpo, "- **Designs criados na hora (o gerador das Ideias)**", /antes de a ideia aparecer\.$/);
    linhas.splice(ini, fim - ini + 1, ...corpo);
    t = linhas.join("\r\n");
    writeFileSync(arquivo, t, "utf8");
    console.log("CHANGELOG: resolvido (minha entrada + cópia do gerador saíram do Não adicionado)");
  } else {
    console.log("CHANGELOG: sem conflito");
  }
}

// --- historico ---
{
  const arquivo = "docs/historico-tecnico.md";
  let t = readFileSync(arquivo, "utf8");
  if (marcas(t)) {
    const linhas = t.split(/\r?\n/);
    const ini = linhas.findIndex((l) => l === "<<<<<<< HEAD");
    const meio = linhas.findIndex((l, i) => i > ini && l === "=======");
    const fim = linhas.findIndex((l, i) => i > meio && l.startsWith(">>>>>>> "));
    if (ini < 0 || meio < 0 || fim < 0) throw new Error("marcas do histórico em lugar inesperado");
    const cabeca = linhas.slice(ini + 1, meio);
    const meu = linhas.slice(meio + 1, fim);
    linhas.splice(ini, fim - ini + 1, ...cabeca, "", ...meu);
    writeFileSync(arquivo, linhas.join("\r\n"), "utf8");
    console.log(`histórico: resolvido (${cabeca.length} linhas de outras sessões + ${meu.length} minhas)`);
  } else {
    console.log("histórico: sem conflito");
  }
}
