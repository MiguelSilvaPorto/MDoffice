// Testa a correção automática: regras de pontuação/limpeza, política da varredura e o ritmo aprendido.
// Uso: node scripts/testar-correcao.mjs
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "correcao-"));

/**
 * O `?raw` do Vite, que o esbuild não conhece sozinho: as regras ABNT vivem em
 * `src/broker/abnt/regras/*.toml` e entram no pacote como texto (é assim que o app
 * as carrega também). Sem este plugin, empacotar `style/index.ts` falha no primeiro
 * `.toml?raw`.
 */
const pluginRaw = {
  name: "raw",
  setup(api) {
    api.onResolve({ filter: /\?raw$/ }, (args) => ({
      path: resolve(dirname(args.importer), args.path.replace(/\?raw$/, "")),
      namespace: "raw",
    }));
    api.onLoad({ filter: /.*/, namespace: "raw" }, (args) => ({
      contents: readFileSync(args.path, "utf8"),
      loader: "text",
    }));
  },
};

const empacotar = async (entrada, saida) => {
  await build({ entryPoints: [join(raiz, entrada)], bundle: true, platform: "node", format: "esm", outfile: join(tmp, saida), logLevel: "error", plugins: [pluginRaw] });
  return import(pathToFileURL(join(tmp, saida)).href);
};
/** Empacota um módulo escrito aqui (para juntar checkStyle + tom + stats + catálogo NUM bundle só). */
const empacotarFonte = async (fonte, saida) => {
  await build({ stdin: { contents: fonte, resolveDir: raiz, loader: "ts" }, bundle: true, platform: "node", format: "esm", outfile: join(tmp, saida), logLevel: "error", plugins: [pluginRaw] });
  return import(pathToFileURL(join(tmp, saida)).href);
};

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

const S = await empacotar("src/broker/style/index.ts", "style.mjs");
const A = await empacotar("src/broker/autofix.ts", "autofix.mjs");
const R = await empacotar("src/broker/personal/autofmt.ts", "autofmt.mjs");
// Módulos de formalidade: checkStyle + tom + stats + catálogo no MESMO bundle, para
// o setTone() daqui valer para o checkStyle que está sendo chamado.
const F = await empacotarFonte(
  `export { checkStyle } from "./src/broker/style/index.ts";
   export { setTone } from "./src/broker/tone.ts";
   export { stats, marcadoresInformais } from "./src/broker/stats.ts";
   export { INFORMAL, ROTULO_CLASSE } from "./src/broker/data/informal.ts";`,
  "formalidade.mjs"
);
const CLASSES = new Set(Object.keys(F.ROTULO_CLASSE));
const ehMarcador = (i) => CLASSES.has(i.classe);
const porClasse = (texto, classe) => F.checkStyle(texto).filter((i) => i.classe === classe);

/** Aplica todos os fixes numa transação, como o editor (em caso de sobreposição, o maior vence). */
const aplicar = (texto) => {
  const lista = S.checkStyle(texto)
    .filter((i) => i.fix !== undefined)
    .map((i) => ({ from: i.from, to: i.to, insert: i.fix }))
    .sort((a, b) => a.from - b.from);
  const safe = [];
  for (const c of lista) {
    const ultimo = safe[safe.length - 1];
    if (ultimo && c.from < ultimo.to) {
      if (c.to - c.from > ultimo.to - ultimo.from) safe[safe.length - 1] = c;
      continue;
    }
    safe.push(c);
  }
  let out = texto;
  for (const c of [...safe].sort((a, b) => b.from - a.from)) out = out.slice(0, c.from) + c.insert + out.slice(c.to);
  return out;
};
const igual = (nome, texto, esperado) => {
  const r = aplicar(texto);
  ok(nome, r === esperado, r === esperado ? "" : `→ ${JSON.stringify(r)}`);
};

// ---------------------------------------------------------------- ponto final
igual("ponto final no fim do parágrafo", "O relatorio ficou pronto", "O relatorio ficou pronto.");
igual("não fecha frase terminando em conector", "O relatorio ficou pronto para", "O relatorio ficou pronto para");
igual("título não recebe ponto", "## titulo sem ponto", "## titulo sem ponto");
igual("item de lista não recebe ponto", "- item sem ponto", "- item sem ponto");
igual("reticências ficam intactas", "Esperando...", "Esperando...");
igual("quatro pontos viram três (reticências)", "Esperando....", "Esperando...");
igual("quatro pontos no meio da frase também", "Ele pensou.... O plano mudou.", "Ele pensou... O plano mudou.");
igual("linha pontilhada longa fica (separador)", "Introdução..... 5", "Introdução..... 5");

// ---------------------------------------------------------------- vírgulas
igual("vírgula antes de “mas”", "eu comprei pão mas esqueci o leite", "Eu comprei pão, mas esqueci o leite.");
igual("expressão intercalada sem sobrar espaço", "O resultado no entanto foi diferente", "O resultado, no entanto, foi diferente.");
igual("“isto é” com acento casa", "O resultado isto é o número final ficou alto", "O resultado, isto é, o número final ficou alto.");
igual("conectivo no início da frase", "Por isso decidimos mudar o plano", "Por isso, decidimos mudar o plano.");
igual("“porém” abrindo a frase", "Porém decidimos mudar o plano", "Porém, decidimos mudar o plano.");
igual("“entretanto” abrindo a frase", "Entretanto faltou testar o sistema", "Entretanto, faltou testar o sistema.");
igual("“portanto” intercalado nos dois lados", "ele chegou atrasado portanto perdemos a reunião", "Ele chegou atrasado, portanto, perdemos a reunião.");
igual("“entretanto” intercalado não duplica vírgulas", "O time entregou o projeto entretanto faltou teste", "O time entregou o projeto, entretanto faltou teste.");
igual("“porém” intercalado ganha só a vírgula de antes", "O plano deu certo porém faltou verba", "O plano deu certo, porém faltou verba.");
igual("“entretanto” já com vírgula antes não é tocado", "O time entregou o projeto, entretanto faltou teste.", "O time entregou o projeto, entretanto faltou teste.");
igual("frase subordinada longa ganha vírgula", "A reunião foi longa pois muita coisa estava pendente", "A reunião foi longa, pois muita coisa estava pendente.");
igual("não mexe em código", "Use `no entanto` no texto", "Use `no entanto` no texto.");
igual("não mexe em número", "O valor é 1.000,00", "O valor é 1.000,00.");

// ---------------------------------------------------------------- limpeza
igual("dois pontos seguidos viram um", "O relatorio ficou pronto.. O proximo item tambem", "O relatorio ficou pronto. O proximo item tambem.");
igual("pontos separados por espaço viram um", "O relatorio ficou pronto. . O proximo item tambem", "O relatorio ficou pronto. O proximo item tambem.");
igual("vírgulas duplicadas viram uma", "atrasado,, portanto perdemos a reunião", "Atrasado, portanto perdemos a reunião.");
igual("frase colada ganha o ponto", "O relatorio ficou pronto O proximo item tambem", "O relatorio ficou pronto. O proximo item tambem.");
igual("frase colada antes de nome próprio não arrisca", "falei O Pedro ontem", "Falei O Pedro ontem.");
igual("quebra de frase comprida só entra no “Corrigir tudo”", "um dois três quatro cinco seis sete oito nove dez onze e doze", "Um dois três quatro cinco seis sete oito nove dez onze. E doze.");

// ---------------------------------------------------------------- ABNT: citação autor-data (NBR 10520:2023)
{
  const citacao = (texto) => S.checkStyle(texto).filter((i) => i.word.startsWith("("));
  const misto = citacao("Como defende (Silva, 2020), o tema segue atual");
  ok("ABNT 2023: caixa mista (Silva, 2020) não é acusada", misto.length === 0, misto.map((i) => i.message).join(" | "));
  const alta = citacao("Como defende (SILVA, 2020), o tema segue atual");
  ok(
    "ABNT 2023: caixa alta (SILVA, 2020) vira sugestão de caixa mista",
    alta.length === 1 && alta[0].fix === undefined && alta[0].suggestions[0] === "(Silva, 2020)",
    JSON.stringify(alta)
  );
  const sigla = citacao("Segundo (IBGE, 2020), a taxa subiu");
  ok("ABNT 2023: sigla curta (IBGE, 2020) não é acusada", sigla.length === 0, sigla.map((i) => i.message).join(" | "));
  igual(
    "ABNT 2023: sugestão de caixa mista não entra na correção automática",
    "Como defende (SILVA, 2020), o tema segue atual.",
    "Como defende (SILVA, 2020), o tema segue atual."
  );
}
{
  const etAl = (texto) => S.checkStyle(texto).filter((i) => i.word.startsWith("et"));
  const comPonto = etAl("Silva et al. defendem essa ideia.");
  const semPonto = etAl("Silva et al defendem essa ideia.");
  ok("ABNT 2023: “et al.” é aceito", comPonto.length === 0, comPonto.map((i) => i.message).join(" | "));
  ok("ABNT 2023: “et al” (sem ponto) também é aceito", semPonto.length === 0, semPonto.map((i) => i.message).join(" | "));
  const errado = etAl("Silva et. al defendem essa ideia.");
  ok(
    "ABNT 2023: “et. al” volta para “et al.” citando a norma",
    errado.length === 1 && errado[0].fix === "et al." && errado[0].message.includes("10520:2023"),
    JSON.stringify(errado)
  );
}

// ---------------------------------------------------------------- formalidade (Onda 3)
// Catálogo informal → formal por classe, seguro × sugestão, tom e MIP.
// Exemplos por classe (o catálogo inteiro é provado no primeiro bloco):
//   internetês: "vc vai ao evento?", "me avise qdo chegar", "qto custa o projeto?"
//   contração: "vou pra casa agora", "o arquivo tá pronto", "o prazo é curto, né?"
//   muleta: "tipo assim, o sistema falhou", "sei lá o que aconteceu", "digamos assim…"
//   gíria: "um baita problema", "ok, podemos seguir", "o resultado ficou da hora"
//   vagueza: "essa coisa ficou estranha", "um monte de gente reclamou"
//   oralidade: "o pessoal terminou a tarefa", "dá pra ver que o número subiu"
//   atenuação: "acho que o prazo é curto", "mais ou menos 30 participantes"
//   redundância: "vamos subir para cima", "repetir de novo", "a verdade real"
//   clichê: "nos dias de hoje, tudo é digital", "vem crescendo no setor"
{
  const semCaso = F.INFORMAL.filter((p) => !F.marcadoresInformais(p.exemplo).some((m) => m.classe === p.classe)).map((p) => p.exemplo);
  ok("catálogo: todo padrão casa o próprio exemplo", semCaso.length === 0, semCaso.join(" | "));
  ok("catálogo: 50+ padrões por classe", F.INFORMAL.length >= 50, `${F.INFORMAL.length}`);
  const classes = new Set(F.INFORMAL.map((p) => p.classe));
  ok(
    "catálogo: cobre as 9 classes",
    ["internetes", "contracao", "muleta", "giria", "oralidade", "atenuacao", "redundancia", "vagueza", "cliche"].every((c) => classes.has(c)),
    Array.from(classes).join(",")
  );
  const incoerentes = F.INFORMAL.filter((p) => (p.fix !== undefined) !== p.seguro);
  ok("catálogo: seguro e correção direta andam juntos", incoerentes.length === 0, incoerentes.map((p) => p.exemplo).join(" | "));
}
{
  // seguro = pode corrigir sozinho (tem correção direta); sugestão = só propõe
  const pra = porClasse("Vou pra casa agora.", "contracao");
  ok("seguro: “pra → para” tem correção direta", pra.length === 1 && pra[0].fix === "para" && pra[0].suggestions.length === 0, JSON.stringify(pra));
  const inicio = porClasse("pra começar, o plano mudou", "contracao");
  ok("seguro: no começo da frase a troca já sai com maiúscula", inicio.length === 1 && inicio[0].fix === "Para", JSON.stringify(inicio));
  const acho = porClasse("Vamos decidir, acho que o prazo é curto", "atenuacao");
  ok(
    "sugestão: “acho que” não corrige sozinho e traz duas alternativas",
    acho.length === 1 && acho[0].fix === undefined && acho[0].suggestions.includes("considera-se que") && acho[0].suggestions.includes("entende-se que") && /risco/.test(acho[0].message),
    JSON.stringify(acho)
  );
  const conclusao = porClasse("Retomamos na conclusão final do texto", "redundancia");
  ok("sugestão: “conclusão final” só sugere", conclusao.some((i) => i.fix === undefined && i.suggestions.includes("conclusão")), JSON.stringify(conclusao));
  const cima = porClasse("Vamos subir para cima.", "redundancia");
  ok("seguro: redundância tem correção direta", cima.length === 1 && cima[0].fix === "subir", JSON.stringify(cima));
  const prg = porClasse("Isso é pra gente revisar", "contracao");
  ok("“pra gente” dispara uma troca só", prg.length === 1 && prg[0].fix === "para nós", JSON.stringify(prg));
}
{
  // tom: informal não opina; neutro só os casos claros; formal aponta tudo
  F.setTone("formal");
  const formal = F.checkStyle("acho que dá pra melhorar").filter(ehMarcador).map((i) => i.classe);
  ok("tom formal: casos claros e sutis aparecem", formal.includes("contracao") && formal.includes("atenuacao"), formal.join(","));
  F.setTone("neutro");
  const neutro = F.checkStyle("acho que dá pra melhorar").filter(ehMarcador).map((i) => i.classe);
  ok("tom neutro: só o caso claro", neutro.includes("contracao") && !neutro.includes("atenuacao"), neutro.join(","));
  F.setTone("informal");
  const informal = F.checkStyle("acho que dá pra melhorar").filter(ehMarcador);
  ok("tom informal: nenhum marcador de registro", informal.length === 0, informal.map((i) => i.word).join(","));
  F.setTone("formal");
}
{
  // frase formal por janelas (oralidade e atenuação que dependem do contexto)
  const oral = (t) => F.checkStyle(t).filter((i) => i.classe === "oralidade");
  const ag = oral("A gente vê que o prazo é curto.");
  ok("a gente: oferece “nós vemos” e a impessoal “Vê-se”", ag.length === 1 && ag[0].fix === "Nós vemos" && ag[0].suggestions.includes("Vê-se"), JSON.stringify(ag));
  const agObj = oral("a gente analisou os dados.");
  ok("a gente + objeto: só orienta (a concordância mudaria)", agObj.length === 1 && agObj[0].fix === undefined, JSON.stringify(agObj));
  const agMin = oral("a gente vê que o prazo é curto.");
  ok("a gente minúsculo no começo da frase sai em maiúscula", agMin.length === 1 && agMin[0].fix === "Nós vemos", JSON.stringify(agMin));
  const ai = oral("Aí eu fui ao mercado.");
  ok("“Aí eu fui”: sugere “Então, eu” e “Em seguida, eu”", ai.length === 1 && ai[0].suggestions.includes("Então, eu") && ai[0].suggestions.includes("Em seguida, eu"), JSON.stringify(ai));
  ok("“aí” locativo fica em paz", oral("Aí está o problema.").length === 0);
  const ent = F.checkStyle("Então eu fui ao mercado.").filter((i) => i.classe === "muleta");
  ok("“Então eu fui”: sugere “Portanto, eu”", ent.length === 1 && ent[0].suggestions.includes("Portanto, eu"), JSON.stringify(ent));
  const rep = F.checkStyle("Era curto e então cortamos tudo, então reescrevemos.").filter((i) => i.classe === "muleta");
  ok("“então” repetido: a 2ª vez pede variação", rep.length === 1 && rep[0].suggestions.includes("logo"), JSON.stringify(rep));
  const vv = oral("Você vê que o prazo mudou.");
  ok("“você vê que” → impessoal", vv.length === 1 && vv[0].suggestions.includes("Observa-se que"), JSON.stringify(vv));
  const ha = F.checkStyle("Ele saiu há três anos atrás.").filter((i) => i.classe === "redundancia");
  ok("“há três anos atrás” → “há três anos”", ha.length === 1 && ha[0].fix === "há três anos", JSON.stringify(ha));
}
{
  // frases do degrau 2: clichês, perífrase de gerúndio e plano em 1ª pessoa
  const cli = (t) => F.checkStyle(t).filter((i) => i.classe === "cliche");
  const baixo = (i) => i.suggestions.map((s) => s.toLowerCase());
  const hoje = cli("Nos dias de hoje, tudo é digital.");
  ok("clichê com troca fixa: “nos dias de hoje” → “Atualmente”", hoje.length === 1 && hoje[0].fix === "Atualmente", JSON.stringify(hoje));
  const soma = cli("O dado é de suma importância.");
  ok("clichê: “de suma importância” → “essencial”", soma.length === 1 && soma[0].fix === "essencial", JSON.stringify(soma));
  const faz = cli("Faz-se necessário revisar o prazo.");
  ok("clichê: “faz-se necessário” só sugere", faz.length === 1 && faz[0].fix === undefined && baixo(faz[0]).includes("é necessário"), JSON.stringify(faz));
  const sabido = cli("É sabido que o tema é polêmico.");
  ok("clichê: “é sabido que” aponta o caminho", sabido.length === 1 && sabido[0].fix === undefined && baixo(sabido[0]).includes("sabe-se que"), JSON.stringify(sabido));
  const crescendo = cli("A demanda vem crescendo no setor.");
  ok("clichê: “vem crescendo” → “tem crescido”", crescendo.length === 1 && crescendo[0].fix === "tem crescido", JSON.stringify(crescendo));

  const oral = (t) => F.checkStyle(t).filter((i) => i.classe === "oralidade");
  const peri = oral("Vou estar enviando o relatório amanhã.");
  ok("perífrase: “vou estar enviando” vira “Enviarei”", peri.length === 1 && peri[0].fix === undefined && peri[0].suggestions.includes("Enviarei"), JSON.stringify(peri));
  const peri2 = oral("vamos estar fazendo a revisão");
  ok("perífrase: “vamos estar fazendo” vira “faremos” (irregular)", peri2.length === 1 && baixo(peri2[0]).includes("faremos"), JSON.stringify(peri2));
  const peri3 = oral("vão estar trazendo os dados");
  ok("perífrase: “vão estar trazendo” vira “trarão”", peri3.length === 1 && baixo(peri3[0]).includes("trarão"), JSON.stringify(peri3));
  const peri4 = oral("A equipe vai estar analisando o material.");
  ok("perífrase: 3ª pessoa vira “analisará”", peri4.length === 1 && baixo(peri4[0]).includes("analisará"), JSON.stringify(peri4));
  const plano = oral("Vou fazer a análise dos dados.");
  ok(
    "plano em 1ª pessoa: avisa e mostra a passiva (“será feito”)",
    plano.length === 1 && plano[0].fix === undefined && plano[0].suggestions.length === 0 && /será feito/.test(plano[0].message) && /gênero/.test(plano[0].message),
    JSON.stringify(plano)
  );
  const plano2 = oral("Vamos enviar o relatório.");
  ok("plano no plural: a passiva vai ao plural (“serão enviados”)", plano2.length === 1 && /serão enviados/.test(plano2[0].message), JSON.stringify(plano2));
  F.setTone("neutro");
  ok("perífrase e plano não aparecem no tom neutro", oral("Vou estar enviando o relatório. Vou fazer a análise.").length === 0);
  F.setTone("formal");

  const dapra = oral("Dá pra ver que o número subiu.");
  ok("“dá pra ver que” → “Observa-se que”", dapra.length === 1 && dapra[0].suggestions.includes("Observa-se que"), JSON.stringify(dapra));
  const dapra2 = oral("Dá para ver que o número subiu.");
  ok("“dá para ver que” também entra", dapra2.length === 1 && dapra2[0].suggestions.includes("Observa-se que"), JSON.stringify(dapra2));
  const certa = F.checkStyle("O resultado, de certa forma, surpreendeu.").filter((i) => i.classe === "vagueza");
  ok("“de certa forma” entra como vagueza", certa.length === 1 && certa[0].suggestions.includes("em certa medida"), JSON.stringify(certa));
  const criar = F.checkStyle("O time quer criar novo processo.").filter((i) => i.classe === "redundancia");
  ok("“criar novo” → “criar”", criar.length === 1 && criar[0].fix === "criar", JSON.stringify(criar));
}
{
  // exclusões: citação, código, URL, sigla e e-mail
  const marcas = (t) => F.checkStyle(t).filter(ehMarcador);
  ok("citação (>) fica fora do registro", marcas("> vc deve revisar o texto").length === 0, marcas("> vc deve revisar o texto").map((i) => i.word).join(","));
  ok("citação com oralidade fica fora", marcas("> A gente vê que o prazo é curto.").length === 0);
  ok("bloco de código fica fora", marcas("```\nvc tb qdo msm\n```").length === 0);
  ok("URL fica fora", marcas("veja https://exemplo.com/vc?q=1 agora").length === 0);
  ok("sigla em caixa alta não é internetês", marcas("O exame de TB deu positivo.").length === 0, marcas("O exame de TB deu positivo.").map((i) => i.word).join(","));
  ok("e-mail fica fora", marcas("escreva para vc@exemplo.com agora").length === 0);
}
{
  // MIP: marcadores informais por 1.000 palavras, antes/depois e por classe
  F.setTone("formal");
  const s = F.stats("A gente vê que o prazo é curto, mas o time tá confiante.");
  ok("MIP: conta os marcadores do texto", s.mip > 0 && s.mipDepois < s.mip, `mip=${s.mip} depois=${s.mipDepois}`);
  ok(
    "MIP: contagem por classe",
    s.marcadoresPorClasse.some((c) => c.classe === "oralidade") && s.marcadoresPorClasse.some((c) => c.classe === "contracao"),
    JSON.stringify(s.marcadoresPorClasse)
  );
  ok(
    "MIP: cada marcador traz trecho, frase e risco",
    s.marcadores.length === 2 && s.marcadores.every((m) => m.frase.includes(m.word) && typeof m.seguro === "boolean"),
    JSON.stringify(s.marcadores.map((m) => [m.word, m.frase]))
  );
  const limpo = F.stats("A análise do relatório foi concluída pela equipe.");
  ok("MIP: texto formal sem marcadores zera", limpo.mip === 0 && limpo.marcadores.length === 0, `mip=${limpo.mip}`);
  F.setTone("informal");
  const semTom = F.stats("Vou pra casa agora.");
  ok("MIP: a métrica não depende do tom", semTom.mip > 0, `mip=${semTom.mip}`);
  ok("MIP: peso 3 ÷ 4 palavras × 1.000 = 750", semTom.mip === 750, `mip=${semTom.mip}`);
  F.setTone("formal");
}

// ---------------------------------------------------------------- formalidade: aplicação
igual("formalidade: internetês entra na correção", "qto custa o projeto?", "Quanto custa o projeto?");
igual("formalidade: contração entra na correção", "O arquivo tá pronto.", "O arquivo está pronto.");
igual("formalidade: redundância entra na correção", "Vamos subir para cima.", "Vamos subir.");
igual("formalidade: muleta com troca fixa entra", "O sistema falhou tipo assim.", "O sistema falhou por exemplo.");
igual("formalidade: sugestão não entra na correção automática", "eu acho que o prazo é curto", "Eu acho que o prazo é curto.");
igual("formalidade: “pra gente” vira uma troca só", "Isso é pra gente revisar", "Isso é para nós revisar.");
igual("formalidade: citação não é tocada", "> acho que o prazo é curto.", "> acho que o prazo é curto.");

// ---------------------------------------------------------------- política da varredura
const T = "eu comprei pao mas esqueci o leite";
const fimT = T.length;
const p1 = A.planejarVarredura(T, { pos: fimT, from: 0, to: fimT, parFrom: 0, parTo: fimT, parConcluido: true });
ok("política: parágrafo concluído fecha com ponto", p1.some((c) => c.insert === "leite."));
const p2 = A.planejarVarredura(T, { pos: 5, from: 0, to: fimT, parFrom: 0, parTo: fimT, parConcluido: false });
ok("política: parágrafo em andamento não fecha com ponto", !p2.some((c) => c.insert === "leite."));
ok("política: vírgulas entram mesmo em andamento", p2.some((c) => c.insert === ", mas"));
const posLeite = T.indexOf("leite") + 2;
const p3 = A.planejarVarredura(T, { pos: posLeite, from: 0, to: fimT, parFrom: 0, parTo: fimT, parConcluido: true });
ok("política: não toca a palavra sob o cursor", !p3.some((c) => c.from <= posLeite && posLeite <= c.to));
const G = "pronto O proximo item";
const p4 = A.planejarVarredura(G, { pos: G.length, from: 0, to: G.length, parFrom: 0, parTo: G.length, parConcluido: true });
ok("política: frase colada entra na varredura", p4.some((c) => c.insert === "o. "));
const Q = "um dois três quatro cinco seis sete oito nove dez onze e doze";
const p5 = A.planejarVarredura(Q, { pos: Q.length, from: 0, to: Q.length, parFrom: 0, parTo: Q.length, parConcluido: true });
ok("política: quebra de frase comprida nunca entra sozinha", !p5.some((c) => c.insert.startsWith(". ")));

// ---------------------------------------------------------------- ritmo aprendido
R.limparRitmo();
ok("ritmo: começa em 3,5 s", R.ritmoDePausa() === 3500, `${R.ritmoDePausa()} ms`);
R.marcarAplicacao("a");
R.observarEdicao("a"); // Ctrl+Z: voltou ao texto de antes
ok("ritmo: correção desfeita faz esperar mais", R.ritmoDePausa() > 3500, `${R.ritmoDePausa()} ms`);
R.limparRitmo();
R.marcarAplicacao("b");
R.marcarAplicacao("c"); // a de “b” ficou de pé até a próxima pausa: valeu
ok("ritmo: correção mantida faz agir mais cedo", R.ritmoDePausa() < 3500, `${R.ritmoDePausa()} ms`);
for (let i = 0; i < 30; i++) R.marcarAplicacao(`x${i}`);
ok("ritmo: limite mínimo respeitado", R.ritmoDePausa() >= 1500, `${R.ritmoDePausa()} ms`);
R.limparRitmo();
for (let i = 0; i < 30; i++) {
  R.marcarAplicacao(`y${i}`);
  R.observarEdicao(`y${i}`);
}
ok("ritmo: limite máximo respeitado", R.ritmoDePausa() <= 8000, `${R.ritmoDePausa()} ms`);
R.limparRitmo();
ok("ritmo: zerar volta ao padrão", R.ritmoDePausa() === 3500);

// ---------------------------------------------------------------- memória do checkStyle
{
  const antes = S.checkStyle("O relatorio ficou pronto");
  antes[0].message = "mutado por engano";
  const depois = S.checkStyle("O relatorio ficou pronto");
  ok("memória: mutação de fora não vaza", depois[0].message !== "mutado por engano");
}

// ---------------------------------------------------------------- aprendizado com recusas
// Armazenamento de mentira (o navegador tem localStorage; o Node, não): permite
// conferir o que SERIA gravado — inclusive que só vão números.
let armazem = new Map();
globalThis.localStorage = {
  getItem: (k) => armazem.get(k) ?? null,
  setItem: (k, v) => void armazem.set(k, v),
  removeItem: (k) => void armazem.delete(k),
};
const L = await empacotar("src/broker/aprendizado.ts", "aprendizado.mjs");
const CE = await empacotar("src/broker/spell/classeErro.ts", "classe.mjs");

const confia = (errado, certo) => L.correcoesConfiadas().some(([e, c]) => e === errado && c === certo);
{
  L.limparAprendizado();
  ok("aprendizado: começa vazio", L.totalAprendido() === 0 && L.correcoesConfiadas().length === 0);

  L.registrarCorrecao("estenso", "extenso");
  ok("aprendizado: um aceite ainda não confia", !confia("estenso", "extenso"));
  L.registrarCorrecao("estenso", "extenso");
  ok("aprendizado: dois aceites viram correção confiável", confia("estenso", "extenso"));

  // Desfazer o que o app aplicou sozinho desconta o par: confiável volta a ser sugestão.
  L.marcarAplicadasAuto([["estenso", "extenso"]]);
  const descontados = L.registrarDesfazerAplicadas();
  ok("aprendizado: o Ctrl+Z desconta o par aplicado sozinho", descontados === 1 && !confia("estenso", "extenso"));
  ok("aprendizado: o par desfeito volta a ser sugestão", L.confiancaDoPar("estenso", "extenso") === 0);
  L.registrarCorrecao("estenso", "extenso");
  L.registrarCorrecao("estenso", "extenso");
  ok("aprendizado: aceitar de novo recupera a confiança", confia("estenso", "extenso"));
}
{
  // Recusar a sugestão (digitar por cima) pesa menos e já nasce descontando.
  L.limparAprendizado();
  L.registrarRecusaDeSugestao("extenso", "estenso"); // palavra sugerida, o que estava escrito
  ok("aprendizado: recusar a sugestão já desconta", L.confiancaDoPar("estenso", "extenso") === -1);
  L.registrarCorrecao("estenso", "extenso");
  L.registrarCorrecao("estenso", "extenso");
  ok("aprendizado: depois de uma recusa, dois aceites ainda não bastam", !confia("estenso", "extenso"));
  L.registrarCorrecao("estenso", "extenso");
  ok("aprendizado: com um aceite a mais, o par volta a ser confiável", confia("estenso", "extenso"));
}
{
  // Recusa repetida não afunda o par para sempre: tem piso (dá para reaprender).
  L.limparAprendizado();
  for (let i = 0; i < 10; i++) L.registrarRecusaAoDesfazer("falado", "falido");
  ok("aprendizado: recusa repetida respeita o piso", L.confiancaDoPar("falado", "falido") === -2);
}
{
  // Trocas que ficaram de pé (a varredura seguinte não mexeu nelas) não viram recusa.
  L.limparAprendizado();
  L.registrarCorrecao("maneria", "maneira");
  L.registrarCorrecao("maneria", "maneira");
  L.marcarAplicadasAuto([["maneria", "maneira"]]);
  L.limparAplicadasAuto();
  ok("aprendizado: sem Ctrl+Z, o que foi aplicado continua aprendido", L.registrarDesfazerAplicadas() === 0 && confia("maneria", "maneira"));
  L.registrarRecusaAoDesfazer(", mas", "mas");
  ok("aprendizado: recusa de pontuação é ignorada", L.confiancaDoPar(", mas", "mas") === 0);
  ok("aprendizado: o armazenamento guarda só o par e o placar", (() => {
    const bruto = JSON.parse(armazem.get("mdc.corretor.aprendido") ?? "[]");
    return Array.isArray(bruto) && bruto.every((r) => typeof r.n === "number" && typeof r.errado === "string" && typeof r.certo === "string");
  })());
}
{
  // O veredito do ritmo avisa o aprendizado: `observarEdicao` devolve true quando
  // o texto volta exatamente ao de antes da varredura.
  R.limparRitmo();
  R.marcarAplicacao("texto de antes");
  ok("ritmo: avisa quando a varredura foi desfeita", R.observarEdicao("texto de antes") === true);
  ok("ritmo: edição normal não avisa desfazer", R.observarEdicao("outra coisa") === false);
  R.limparRitmo();
}

// ---------------------------------------------------------------- classes de erro
{
  // O pacote de `aprendizado.ts` tem a própria cópia dos contadores; aqui começa
  // limpo para conferir os pesos de partida e, depois, o efeito de cada decisão.
  CE.limparClasses();
  const classe = (e, c) => CE.classificarErro(e, c)?.classe;
  ok("classe: transposição de letras vizinhas", classe("maneria", "maneira") === "transposicao");
  ok("classe: tecla vizinha no ABNT2", classe("casa", "cada") === "tecla-vizinha");
  ok("classe: tecla vizinha na diagonal (s/x)", classe("estenso", "extenso") === "tecla-vizinha");
  ok("classe: só acento", classe("cafe", "café") === "acento");
  ok("classe: acento/cedilha", classe("cacador", "caçador") === "acento");
  ok("classe: dígrafo ss/ç", classe("excessao", "exceção") === "digrafo");
  ok("classe: dígrafo x/ch", classe("chicara", "xícara") === "digrafo");
  ok("classe: falta de letra", classe("conhecimeto", "conhecimento") === "falta-letra");
  ok("classe: letra a mais", classe("conhecimento", "conhecimeto") === "letra-a-mais");
  ok("classe: troca simples", classe("agora", "apora") === "troca-simples");
  ok("classe: palavras muito diferentes caem em “outra”", classe("casa", "prédio") === "outra");
  ok("classe: nada a classificar devolve null", CE.classificarErro("casa", "casa") === null && CE.classificarErro("casa", "casa.") === null);

  const c = CE.classificarErro("maneria", "maneira");
  ok("classe: devolve um peso plausível", c.peso === CE.PESOS_BASE.transposicao && c.peso > 0 && c.peso <= 1);
  ok("classe: sem histórico, o peso é o de partida", CE.pesoDaClasse("transposicao") === CE.PESOS_BASE.transposicao);
  ok("classe: sem histórico, não há bônus", CE.bonusDaClasse("maneria", "maneira") === 0);

  // Contadores por classe: aceitar uma classe sobe o peso dela; recusar desce.
  for (let i = 0; i < 6; i++) CE.registrarClasse("maneria", "maneira", true);
  const pesoTransposicao = CE.pesoDaClasse("transposicao");
  ok("classe: a classe que a pessoa aceita sobe", pesoTransposicao > CE.PESOS_BASE.transposicao, `${pesoTransposicao}`);
  ok("classe: o candidato da classe aceita ganha bônus", CE.bonusDaClasse("maneria", "maneira") > 0);
  for (let i = 0; i < 6; i++) CE.registrarClasse("cafe", "café", false);
  ok("classe: a classe recusada desce", CE.pesoDaClasse("acento") < CE.PESOS_BASE.acento);
  ok("classe: o candidato da classe recusada perde", CE.bonusDaClasse("cafe", "café") < 0);
  const resumo = CE.resumoClasses();
  ok("classe: o resumo traz só contadores", resumo.length >= 2 && resumo.every((r) => Number.isInteger(r.ok) && Number.isInteger(r.nao)));
  ok("classe: só números vão para o armazenamento", (() => {
    const bruto = JSON.parse(armazem.get("mdc.corretor.classes") ?? "{}");
    return Object.values(bruto).every((v) => typeof v.ok === "number" && typeof v.nao === "number");
  })());
  CE.limparClasses();
  ok("classe: zerar volta ao peso de partida", CE.pesoDaClasse("transposicao") === CE.PESOS_BASE.transposicao && CE.pesoDaClasse("acento") === CE.PESOS_BASE.acento);
}

// ---------------------------------------------------------------- desempenho
{
  const frase = "eu comprei pao mas esqueci o leite e depois voltei a padaria no entanto estava fechada ";
  let grande = "";
  for (let i = 0; i < 120; i++) grande += `${i} ${frase}`;
  const t0 = performance.now();
  S.checkStyle(`${grande}x`);
  const ms = performance.now() - t0;
  ok("desempenho: varredura de ~12 mil caracteres abaixo de 25 ms", ms < 25, `${ms.toFixed(1)} ms`);
}

// ---------------------------------------------------------------- contexto e decisão
const CTX = await empacotar("src/broker/spell/contexto.ts", "contexto.mjs");
const DEC = await empacotar("src/broker/spell/decisao.ts", "decisao.mjs");

{
  // modelo de teste: "vou → para" (forte), "para → casa" (forte), "para → casas" (raro)
  const json = {
    w: ["<s>", "casa", "casas", "caza", "para", "vou", "muito"],
    n: [0, 900, 400, 0, 800, 300, 700],
    b: {
      5: [4, 700, 1, 5], // vou → para (700), vou → casa (5)
      4: [1, 600, 2, 90], // para → casa (600), para → casas (90)
    },
    bt: { 4: 700, 5: 720 },
  };
  const m = CTX.montarContexto(json);
  ok("contexto: monta o modelo com índices e total", !!m && m.indice.get("casa") === 1 && m.total === 3100);
  const bom = CTX.notaContexto("casa", "para", m);
  const ruim = CTX.notaContexto("casas", "para", m);
  ok("contexto: a sequência que existe puxa a nota", bom > 0.3 && bom > ruim, `casa=${bom.toFixed(2)} casas=${ruim.toFixed(2)}`);
  ok("contexto: sem contexto não há bônus", CTX.notaContexto("casa", undefined, m) === 0);
  ok("contexto: contexto desconhecido não penaliza", CTX.notaContexto("casa", "zzz", m) === 0);
  ok("contexto: formato inválido devolve null", CTX.montarContexto({ w: [] }) === null);

  const certo = DEC.decidir({ pontos: [0.8, 0.78], certo: true });
  ok("decisão: classe de certeza aplica mesmo com empate", certo.aplicar === true && certo.motivo === "classe de certeza");
  const folgado = DEC.decidir({ pontos: [0.9, 0.5] });
  ok("decisão: vencedor folgado aplica", folgado.aplicar === true && folgado.confianca > 0.62, JSON.stringify(folgado));
  const empate = DEC.decidir({ pontos: [0.8, 0.79] });
  ok("decisão: empate técnico vira sugestão", empate.aplicar === false, empate.motivo);
  const semMargem = DEC.decidir({ pontos: [0.4, 0.25] });
  ok("decisão: sem margem mínima não aplica", semMargem.aplicar === false && semMargem.motivo.includes("empate"), semMargem.motivo);
  ok("decisão: candidato único com certeza aplica", DEC.decidir({ pontos: [0.5], certo: true }).aplicar === true);
  ok("decisão: sem candidato não aplica", DEC.decidir({ pontos: [] }).aplicar === false);
  ok("decisão: limiar padrão sem histórico", DEC.tauAtual() === DEC.TAU_INICIAL, String(DEC.tauAtual()));
  const probs = DEC.probabilidades([1, 0]);
  ok("decisão: softmax concentra no vencedor", probs[0] > 0.9 && Math.abs(probs[0] + probs[1] - 1) < 1e-9);

  // calibragem do limiar (no teste não há localStorage: o módulo usa a memória)
  DEC.limparCalibragem();
  ok("calibragem: começa zerada e no limiar padrão", DEC.tauAtual() === DEC.TAU_INICIAL && DEC.calibragem().ok === 0 && DEC.calibragem().ruim === 0);
  DEC.registrarAplicacaoAuto();
  DEC.registrarMantidaSePendente();
  DEC.registrarMantidaSePendente(); // sem veredito aberto, não conta de novo
  ok("calibragem: o veredito conta uma vez só", DEC.calibragem().ok === 1 && DEC.calibragem().ruim === 0, JSON.stringify(DEC.calibragem()));
  DEC.registrarAplicacaoAuto();
  DEC.registrarDesfeitaSePendente();
  ok("calibragem: desfazer conta como ruim", DEC.calibragem().ruim === 1);
  DEC.limparCalibragem();
  for (let i = 0; i < 40; i++) DEC.registrarDesfeita();
  const tauAlto = DEC.tauAtual();
  ok("calibragem: muitas desfeitas sobem o limiar", tauAlto > DEC.TAU_INICIAL && tauAlto <= 0.85, String(tauAlto));
  DEC.limparCalibragem();
  for (let i = 0; i < 60; i++) DEC.registrarMantida();
  const tauBaixo = DEC.tauAtual();
  ok("calibragem: muitas mantidas descem o limiar", tauBaixo < DEC.TAU_INICIAL && tauBaixo >= 0.55, String(tauBaixo));
  DEC.limparCalibragem();
}

// ---------------------------------------------------------------- confusões e teclado
const CF = await empacotar("src/broker/spell/confusoes.ts", "confusoes.mjs");
const TC = await empacotar("src/broker/spell/teclado.ts", "teclado.mjs");

{
  ok("teclado: vizinha do ABNT2 custa metade", TC.custoDeTecla("a", "s") === 0.5 && TC.custoDeTecla("a", "p") === 1);
  ok("teclado: a própria tecla não custa nada", TC.custoDeTecla("a", "a") === 0);
  ok(
    "confusões: par do português custa menos que troca comum",
    CF.custoDeTroca("c", "ç") < 0.5 && CF.custoDeTroca("g", "j") < 0.5 && CF.custoDeTroca("a", "p") === 1,
    `cç=${CF.custoDeTroca("c", "ç")} gj=${CF.custoDeTroca("g", "j")}`
  );
  ok(
    "confusões: distância ponderada desconta a classe",
    CF.distanciaPonderada("geito", "jeito", 2) < 0.6 && CF.distanciaPonderada("casa", "caza", 2) <= 0.5,
    `geito→jeito=${CF.distanciaPonderada("geito", "jeito", 2)} casa→caza=${CF.distanciaPonderada("casa", "caza", 2)}`
  );
  ok(
    "confusões: h mudo e dobra de letra são baratos",
    CF.distanciaPonderada("hoje", "oje", 2) <= 0.5 && CF.distanciaPonderada("exesso", "exeso", 2) <= 0.5,
    `hoje→oje=${CF.distanciaPonderada("hoje", "oje", 2)} exesso→exeso=${CF.distanciaPonderada("exesso", "exeso", 2)}`
  );
  ok("confusões: inversão de vizinhas custa meia edição", CF.distanciaPonderada("maneira", "maneria", 2) <= 0.6, String(CF.distanciaPonderada("maneira", "maneria", 2)));
  const variantes = CF.variantesDeConfusao("excessao");
  ok("confusões: variantes trocam pares de letras", variantes.includes("exceçao") && variantes.includes("excesao"), variantes.slice(0, 6).join(", "));
  ok("confusões: o limite segura a explosão", CF.variantesDeConfusao("excessosss", 5).length <= 5);
  ok("confusões: troca sem relação custa a edição inteira", CF.distanciaPonderada("casa", "lua", 2) > 2);

  // variantes de classe (acento nas duas direções, par de letras, "h" mudo e dobra)
  ok("variantes de classe: acento nas duas direções", CF.variantesDeClasse("media").includes("média") && CF.variantesDeClasse("média").includes("media"));
  ok("variantes de classe: par de letras (x↔ch)", CF.variantesDeClasse("xama").includes("chama"));
  ok("variantes de classe: h mudo e dobra", CF.variantesDeClasse("hoje").includes("oje") && CF.variantesDeClasse("lissta").includes("lista"));
}

// ---------------------------------------------------------------- uso e contexto
const USO = await empacotar("src/broker/spell/uso.ts", "uso.mjs");

{
  // Modelo de teste com o formato do LangModel (o uso real vem de ghost/model.ts).
  const modelo = {
    idOf: new Map([
      ["<s>", 0],
      ["a", 1],
      ["media", 2],
      ["média", 3],
      ["severidade", 4],
      ["chama", 5],
      ["xama", 6],
    ]),
    data: { n: [0, 5000, 300, 900, 1200, 800, 700] },
    total: 10000,
    bigram: (id) => ({ succ: id === 1 || id === 0 ? [{ id: 3, count: id === 1 ? 600 : 400 }] : [], total: id === 1 || id === 0 ? 700 : 0 }),
    display: (id) => ["<s>", "a", "media", "média", "severidade", "chama", "xama"][id],
  };
  const t1 = USO.trocaPorContexto("media", "a", modelo);
  ok("uso: acha a leitura que o contexto pede", t1?.palavra === "média" && t1.vantagem >= 20, JSON.stringify(t1));
  ok("uso: sem contexto não opina", USO.trocaPorContexto("media", undefined, modelo) === null);
  ok("uso: contexto fora do vocabulário não opina", USO.trocaPorContexto("media", "inexistente", modelo) === null);
  ok("uso: escrita fora do vocabulário não opina", USO.trocaPorContexto("zzzzz", "a", modelo) === null);
  ok("uso: escrita que já combina não é questionada", USO.trocaPorContexto("média", "a", modelo) === null);
  ok("uso: sem modelo não opina", USO.trocaPorContexto("media", "a", null) === null);
  ok("uso: início de frase conta como contexto", USO.trocaPorContexto("media", "<s>", modelo)?.palavra === "média");
}

// ---------------------------------------------------------------- rerank por contexto (F4)
// A régua do rerank com o modelo de idioma: contexto manda; bônus de classe/uso só desempata.
const RK = await empacotar("src/broker/personal/rerank.ts", "rerank.mjs");

{
  const ordem = RK.ordemPorContexto;
  ok("rerank: contexto claro promove", ordem(["cade", "casa"], [0.01, 0.3], [0, 0])[0] === "casa");
  ok(
    "rerank: evidência fraca não mexe (o caso “messmo” → “mesh”)",
    ordem(["mesmo", "mesh"], [0.0027, 0.0341], [0, 0])[0] === "mesmo",
    JSON.stringify(ordem(["mesmo", "mesh"], [0.0027, 0.0341], [0, 0]))
  );
  ok(
    "rerank: 2,4× ainda não é claro (o caso “revissão” → “previsão”)",
    ordem(["revisão", "previsão"], [0.0424, 0.1029], [0, 0])[0] === "revisão"
  );
  ok("rerank: bônus de classe sozinho não promove", ordem(["casa", "caza"], [0.001, 0.002], [0, 0.03])[0] === "casa");
  ok("rerank: a promoção leva junto a ordem do resto", JSON.stringify(ordem(["a", "b", "c"], [0.01, 0.4, 0.02], [0, 0, 0])) === JSON.stringify(["b", "a", "c"]));
  ok("rerank: uma sugestão só não tem o que ordenar", ordem(["a"], [0.5], [0])[0] === "a");
  ok("rerank: sem modelo a sugestão fica como o dicionário deixou", JSON.stringify(RK.rerankSuggestions("x", 0, 1, ["a", "b"])) === JSON.stringify(["a", "b"]));
}
{
  // evidenciaDeContexto com um modelo de mentira (mesmo formato do LangModel)
  const modelo = {
    idOf: new Map([
      ["o", 3],
      ["casa", 4],
      ["caza", 5],
      ["própria", 6],
    ]),
    data: { n: [0, 0, 0, 100, 500, 10, 200] },
    total: 1000,
    bigram: (id) => (id === 3 ? { succ: [{ id: 4, count: 40 }, { id: 5, count: 2 }], total: 100 } : id === 4 ? { succ: [{ id: 6, count: 30 }], total: 100 } : { succ: [], total: 0 }),
    trigram: () => ({ succ: [], total: 0 }),
  };
  const ev = (palavra, prev, next = null) => RK.evidenciaDeContexto(modelo, prev, next, palavra);
  ok("evidência: o bigrama da anterior sustenta (0,45 do P)", Math.abs(ev("casa", ["o"]) - 0.45 * 0.4) < 1e-9, String(ev("casa", ["o"])));
  ok("evidência: a candidata rara fica atrás", ev("caza", ["o"]) < ev("casa", ["o"]), `${ev("caza", ["o"])} vs ${ev("casa", ["o"])}`);
  ok("evidência: o lado DIREITO também conta (0,25 do seguinte)", Math.abs(ev("casa", ["o"], "própria") - (0.18 + 0.25 * 0.3)) < 1e-9, String(ev("casa", ["o"], "própria")));
  ok("evidência: sem dado não é zero nem culpa", ev("casa", ["x"]) === 0 && ev("casa", []) === 0);
  ok("evidência: palavra fora do vocabulário não pontua", ev("cazaa", ["o"]) === 0);
}

// ---------------------------------------------------------------- trecho longo: dividir e encurtar
const E = await empacotar("src/broker/encurtar.ts", "encurtar.mjs");

{
  // O aviso do perfil ("Frase de N palavras") só liga com um perfil pronto — semeia um aqui.
  // `checkStyle` e o perfil precisam ser o MESMO módulo: vão num bundle só.
  const { writeFileSync } = await import("node:fs");
  const caminho = (p) => join(raiz, p).replace(/\\/g, "/");
  const juntoTs = join(tmp, "estilo-junto.ts");
  writeFileSync(
    juntoTs,
    `export { checkStyle } from "${caminho("src/broker/style/index.ts")}";\n` +
      `export { learnDocument } from "${caminho("src/broker/personal/profile.ts")}";\n`
  );
  await build({ entryPoints: [juntoTs], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "estilo-junto.mjs"), logLevel: "error", plugins: [pluginRaw] });
  const SJ = await import(pathToFileURL(join(tmp, "estilo-junto.mjs")).href);

  const amostra = Array.from({ length: 30 }, (_, i) => `A equipe revisou o plano numero ${i} hoje e ajustou o cronograma do projeto naquela semana.`).join(" ");
  SJ.learnDocument("teste", amostra);

  // 1) o aviso do trecho longo marca o TRECHO INTEIRO e ganha o que fazer
  const T1 = "o time inteiro trabalhou durante toda a semana para entregar o projeto novo no prazo e o cliente vai revisar tudo se o prazo permitir";
  const a1 = SJ.checkStyle(T1).find((i) => i.classe === "trecho-longo");
  ok("trecho longo: o aviso existe", !!a1);
  ok("trecho longo: a marca cobre o trecho inteiro (não 60 caracteres)", !!a1 && T1.slice(a1.from, a1.to).split(/\s+/).length >= 25, a1 ? String(a1.to - a1.from) : "-");
  ok("trecho longo: sem quebra pronta, o aviso é escolha (sem fix)", !!a1 && a1.fix === undefined);
  ok("trecho longo: divisores incluem a vírgula antes de “se”", !!a1?.divisores?.some((d) => d.insert === ", se"));
  ok("trecho longo: cada divisor tem o próprio trecho", !!a1?.divisores?.every((d) => d.to > d.from && T1.slice(d.from, d.to).trim().length > 0));
  ok(
    "política: o divisor sugerido no trecho longo nunca entra sozinho",
    !A.planejarVarredura(T1, { pos: T1.length, from: 0, to: T1.length, parFrom: 0, parTo: T1.length, parConcluido: true }).some((c) => c.insert === ", se")
  );

  // 2) quando há pronome seguro, a quebra pronta continua — e continua fora da varredura
  const T2 = "o time trabalhou durante toda a semana para entregar o projeto no prazo e na sexta eu revisei tudo com calma antes de enviar para o cliente";
  const a2 = SJ.checkStyle(T2).find((i) => i.classe === "trecho-longo");
  ok("trecho longo: com pronome seguro, a quebra pronta continua", !!a2 && a2.fix === ". Eu", a2?.fix ?? "-");
  ok(
    "política: a quebra por pronome nunca entra sozinha",
    !A.planejarVarredura(T2, { pos: T2.length, from: 0, to: T2.length, parFrom: 0, parTo: T2.length, parConcluido: true }).some((c) => c.insert.startsWith(". "))
  );

  // 3) os dois avisos sobre a MESMA frase viram um só, com a marca da frase inteira
  const T3 =
    "Com o tempo, era para que o aplicativo corrigisse palavras automaticamente sem eu precisar revisar um algoritmo muito melhor capaz de ter essa capacidade crítica para ser capaz de pegar qualquer um documento detalhado e oira verifica se ele segue as regras abnt";
  const longos = SJ.checkStyle(T3).filter((i) => i.classe === "frase-longa" || i.classe === "trecho-longo");
  ok("frase longa: os avisos sobrepostos viram um só", longos.length === 1, `${longos.length}: ${longos.map((i) => i.classe).join(",")}`);
  const fl = longos[0];
  ok("frase longa: a marca cobre a frase inteira", !!fl && fl.classe === "frase-longa" && fl.from === 0 && fl.to === T3.length, fl ? `${fl.from}-${fl.to}` : "-");
  ok("frase longa: divisores aproveitam a quebra que outra regra já achou", !!fl?.divisores?.some((d) => d.insert === ". E"));
  ok("frase longa: divisores têm o “se” do trecho (vírgula antes)", !!fl?.divisores?.some((d) => d.insert === ", se"));
  ok("frase longa: encurtar sugere “ser capaz de” → “poder”", !!fl?.trocas?.some((t) => t.para === "poder" && t.rotulo.includes("ser capaz de")));
  ok("frase longa: no máximo 3 trocas", (fl?.trocas?.length ?? 0) <= 3);

  // 4) o motor de encurtar: ganho de tamanho, caixa preservada e guardas
  const t4 = "Posteriormente o time vai fazer uso de novas ferramentas para levar em conta o custo";
  const trocas4 = E.encurtarTrecho(t4, 0, t4.length, 3);
  ok("encurtar: “Posteriormente” → “Depois” (com a caixa)", trocas4.some((t) => t.rotulo === "“Posteriormente” → “Depois”"));
  ok("encurtar: “fazer uso de” → “usar”", trocas4.some((t) => t.para === "usar"));
  ok("encurtar: “levar em conta” → “considerar”", trocas4.some((t) => t.para === "considerar"));
  const curto = "o time revisou tudo com calma";
  ok("encurtar: nada quando o ganho é pequeno", E.encurtarTrecho(curto, 0, curto.length, 3).length === 0);
  const capaz = "ele é capaz de tudo nessa vida";
  ok("encurtar: “é capaz de tudo” fica (complemento não verbal)", !E.encurtarTrecho(capaz, 0, capaz.length, 3).some((t) => t.para === "pode"));
}

// ---------------------------------------------------------------- F4: auto-cura de conhecimento
const TM = await empacotar("src/broker/personal/termos.ts", "termos.mjs");
const ME = await empacotar("src/broker/personal/metricas.ts", "metricas.mjs");
const AR = await empacotar("src/broker/personal/aprendizadoArquivo.ts", "aprendizado-arquivo.mjs");
{
  armazem.clear();
  TM.limparTermos();
  const promovidos = [];
  TM.aoPromoverTermo((p) => promovidos.push(p));
  ok("termos: começa vazio", TM.termosInsistentes().length === 0 && TM.termosAprendidos().length === 0);
  ok("termos: um sinal não promove", TM.sinalizarTermo("imcopa") === false && TM.forcaDoTermo("imcopa") === 1);
  TM.sinalizarTermo("imcopa");
  ok("termos: dois sinais viram candidata, sem promover", TM.termosInsistentes().some((t) => t.palavra === "imcopa") && TM.termosAprendidos().length === 0);
  ok("termos: o terceiro sinal promove", TM.sinalizarTermo("imcopa") === true && promovidos.includes("imcopa") && TM.termosAprendidos().some((t) => t.palavra === "imcopa"));
  ok("termos: promovido não infla nem promove de novo", TM.sinalizarTermo("imcopa") === false && TM.forcaDoTermo("imcopa") === 3);
  ok("termos: promovido sai das candidatas", !TM.termosInsistentes().some((t) => t.palavra === "imcopa"));

  // decaimento: um sinal de 30 dias atrás (uma meia-vida) vale metade
  TM.limparTermos();
  TM.sinalizarTermo("sicoob");
  const d1 = TM.dadosTermos();
  d1.itens["sicoob"].t = Date.now() - 30 * 24 * 60 * 60 * 1000;
  TM.restaurarTermos(d1);
  const f = TM.forcaDoTermo("sicoob");
  ok("termos: decaimento pela meia-vida", f > 0.45 && f < 0.55, String(f));
  TM.sinalizarTermo("sicoob");
  TM.sinalizarTermo("sicoob");
  ok("termos: sinal antigo + dois novos ainda não promove", TM.termosAprendidos().length === 0 && TM.forcaDoTermo("sicoob") > 2.4);
  ok("termos: um sinal a mais promove", TM.sinalizarTermo("sicoob") === true);

  // à mão: entra no dicionário na hora e sai das candidatas
  TM.limparTermos();
  TM.sinalizarTermo("lgpd");
  TM.marcarPromovidoManual("lgpd");
  ok("termos: adicionar à mão marca como aprendido", TM.termosInsistentes().length === 0 && TM.termosAprendidos().some((t) => t.palavra === "lgpd"));
  TM.esquecerTermo("lgpd");
  ok("termos: esquecer tira das listas", TM.termosAprendidos().length === 0);

  // compactação: um sinal de 4 meias-vidas atrás fica fraco e sai sozinho
  TM.limparTermos();
  TM.sinalizarTermo("xpto");
  const d2 = TM.dadosTermos();
  d2.itens["xpto"].t = Date.now() - 120 * 24 * 60 * 60 * 1000;
  TM.restaurarTermos(d2);
  ok("termos: compactação esquece o que ficou fraco", TM.termosInsistentes().length === 0 && TM.forcaDoTermo("xpto") === 0);

  ok("termos: sinal estranho é ignorado", TM.sinalizarTermo("!!") === false && TM.sinalizarTermo("a") === false);
}
{
  ME.limparMetricas();
  ME.contarVarredura(500, 5);
  ME.contarVarredura(500, 0);
  const m = ME.metricasCorretor();
  ok("métricas: avisos por 1.000 palavras", m.palavras === 1000 && m.marcadas === 5 && m.porMil === 5 && m.varreduras === 2, JSON.stringify(m));
  ME.contarVarredura(0, 3);
  ok("métricas: varredura sem palavras não conta", ME.metricasCorretor().varreduras === 2);
}
{
  // exportar/importar: o arquivo leva pares, termos, métricas e o dicionário pessoal
  L.limparAprendizado();
  TM.limparTermos();
  ME.limparMetricas();
  L.registrarCorrecao("estenso", "extenso");
  L.registrarCorrecao("estenso", "extenso");
  TM.sinalizarTermo("imcopa");
  TM.sinalizarTermo("imcopa");
  TM.sinalizarTermo("imcopa");
  ME.contarVarredura(200, 4);
  armazem.set("mdc.ignore-words", JSON.stringify(["imcopa"]));
  const arquivo = AR.exportarAprendizado();
  L.limparAprendizado();
  TM.limparTermos();
  ME.limparMetricas();
  armazem.delete("mdc.ignore-words");
  const r = AR.importarAprendizado(arquivo);
  const pares = JSON.parse(armazem.get("mdc.corretor.aprendido") ?? "[]");
  const termos = JSON.parse(armazem.get("mdc.corretor.termos") ?? "{}");
  const metricas = JSON.parse(armazem.get("mdc.corretor.metricas") ?? "{}");
  const dicionario = JSON.parse(armazem.get("mdc.ignore-words") ?? "[]");
  ok(
    "arquivo: importa e repõe pares, termos, métricas e dicionário",
    r.ok && pares.some((p) => p.errado === "estenso") && termos.itens?.imcopa?.prom === true && metricas.palavras === 200 && dicionario.includes("imcopa"),
    JSON.stringify(r)
  );
  const ruim = AR.importarAprendizado('{"app":"outro"}');
  ok("arquivo: recusa arquivo de outro app", !ruim.ok && /mdOffice/.test(ruim.erro ?? ""));
  const versao = AR.importarAprendizado('{"app":"mdoffice","tipo":"aprendizado-do-corretor","versao":99}');
  ok("arquivo: recusa versão diferente", !versao.ok && /versão/.test(versao.erro ?? ""));
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
