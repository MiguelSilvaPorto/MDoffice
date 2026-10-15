// Testa o ENCAIXE da fita: a função pura que decide o que a faixa mostra na largura que tem
// (largura disponível × largura dos grupos) e a fiação que aplica o plano nas três fitas.
//
//   1) os quatro degraus, um por um (cheio, compacto, grupos em menu e faixa única);
//   2) a conferência nas larguras 1400/1100/900/700 px com a escala em 0,7/1/1,5;
//   3) a fiação e o CSS que fazem o plano valer (o botão do grupo, o menu e o "nada de rolagem").
//
// Uso: node scripts/testar-fita-encaixe.mjs
import { build } from "esbuild";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-encaixe-"));
const empacotar = async (entrada, saida) => {
  await build({ entryPoints: [join(raiz, entrada)], bundle: true, platform: "node", format: "esm", outfile: join(tmp, saida), logLevel: "error" });
  return import(pathToFileURL(join(tmp, saida)).href);
};

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};
const ler = (rel) => readFileSync(join(raiz, rel), "utf8");

const E = await empacotar("src/fitaEncaixe.ts", "encaixe.mjs");
const { encaixarFita, AJUSTE_MIN, LARGURA_BOTAO } = E;

/** A aba Início do PowerPoint na escala 1: o painel pedia 1647 px numa janela de 1338 px (medida
 *  registrada quando a fita passou a se ajustar). A divisão por grupo é um retrato do conteúdo de
 *  cada um (Colar + 2 colunas de 3 botões; os três blocos de texto; o botão dividido de Lâminas +
 *  as duas colunas; a galeria de Formas + as colunas de desenho). O teste prende a REGRA do
 *  encaixe — o total é o número real, a divisão é a aproximação. */
const INICIO = { nome: "PowerPoint · Início", grupos: [300, 320, 330, 390, 307] };
const soma = INICIO.grupos.reduce((a, b) => a + b, 0);

// ---------------------------------------------------------------- 1) os quatro degraus

console.log("os quatro degraus do encaixe");
ok("a tabela de grupos fecha com a medida registrada (1647 px)", soma === 1647, `${soma} px`);

{
  const cheio = encaixarFita(1900, INICIO.grupos);
  ok(
    "1º degrau — cabe inteira: tudo aberto e métricas em 1",
    cheio.degrau === "cheio" && cheio.ajuste === 1 && cheio.abertos.length === INICIO.grupos.length && cheio.noMenu.length === 0,
    JSON.stringify(cheio)
  );
  ok("e sobra espaço de verdade", cheio.sobra === 1900 - soma, `${cheio.sobra} px`);

  const compacto = encaixarFita(1500, INICIO.grupos);
  ok(
    "2º degrau — compacto: encolhe as métricas (com piso) e NINGUÉM vai para o menu",
    compacto.degrau === "compacto" && compacto.ajuste >= AJUSTE_MIN && compacto.ajuste < 1 && compacto.noMenu.length === 0,
    `ajuste ${compacto.ajuste}`
  );
  ok("e a fita passa a caber (sobra ≥ 0)", compacto.sobra >= -0.001, `${compacto.sobra.toFixed(1)} px`);

  const menu = encaixarFita(1100, INICIO.grupos);
  ok(
    "3º degrau — grupos em menu: as métricas param no piso",
    menu.degrau === "menu" && menu.ajuste === AJUSTE_MIN,
    `ajuste ${menu.ajuste}`
  );
  ok(
    "e colapsa do ÚLTIMO para o primeiro (os abertos são sempre o começo da fita)",
    menu.noMenu.join(",") === "4" && menu.abertos.join(",") === "0,1,2,3",
    `abertos [${menu.abertos}] · menu [${menu.noMenu}]`
  );
  ok("e o último grupo virou botão (a sobra conta a largura do botão)", menu.sobra >= -0.001, `${menu.sobra.toFixed(1)} px`);

  const unica = encaixarFita(1100, INICIO.grupos, { faixaUnica: true });
  ok(
    "4º degrau — faixa única (recolhida): TODOS os grupos em botão, numa linha",
    unica.degrau === "faixa-unica" && unica.abertos.length === 0 && unica.noMenu.length === INICIO.grupos.length,
    JSON.stringify(unica)
  );
  ok("e a faixa única não depende da largura (é o modo, não o aperto)", unica.degrau === encaixarFita(4000, INICIO.grupos, { faixaUnica: true }).degrau);
  ok(
    "e a linha dos botões cabe até numa janela estreita",
    unica.sobra >= -0.001 && encaixarFita(700, INICIO.grupos, { faixaUnica: true }).sobra >= -0.001
  );
}

// ---------------------------------------------------------------- 2) a conferência pedida

console.log("\nconferência: 1400/1100/900/700 px com a escala em 0,7/1/1,5");
{
  const larguras = [1400, 1100, 900, 700];
  const escalas = [0.7, 1, 1.5];
  const planos = [];
  for (const escala of escalas) {
    const linha = [];
    for (const largura of larguras) {
      const p = encaixarFita(largura, INICIO.grupos, { escala });
      planos.push({ largura, escala, ...p });
      linha.push(`${largura}px:${p.degrau}(${p.abertos.length}abertos${p.noMenu.length ? `,${p.noMenu.length}menu` : ""})`);
    }
    console.log(`      escala ${escala}  ${linha.join("  ")}`);
  }

  ok(
    "em TODAS as combinações a fita cabe (sobra ≥ 0 — é o que dispensa a barra de rolagem)",
    planos.every((p) => p.sobra >= -0.001),
    planos
      .filter((p) => p.sobra < -0.001)
      .map((p) => `${p.largura}@${p.escala}`)
      .join(",")
  );
  ok(
    "nenhum plano deixa grupo de fora (abertos + menu = todos, sem repetir)",
    planos.every((p) => p.abertos.length + p.noMenu.length === INICIO.grupos.length),
    ""
  );
  ok(
    "os abertos são sempre o começo da fila (o colapso é do último para o primeiro)",
    planos.every((p) => p.abertos.every((v, i) => v === i)),
    ""
  );
  ok(
    "janela mais estreita nunca abre MAIS grupos (o aperto é monotônico)",
    escalas.every((e) => {
      const doCaso = planos.filter((p) => p.escala === e);
      return doCaso.every((p, i) => i === 0 || p.abertos.length <= doCaso[i - 1].abertos.length);
    })
  );
  ok(
    "escala maior nunca abre MAIS grupos (a 1,5× a fita é a mais apertada)",
    larguras.every((l) => {
      const doCaso = planos.filter((p) => p.largura === l);
      return doCaso.every((p, i) => i === 0 || p.abertos.length <= doCaso[i - 1].abertos.length);
    })
  );
  ok(
    "a 1400 px e escala 1 a aba ainda abre inteira (o aperto começa mais embaixo)",
    planos.find((p) => p.largura === 1400 && p.escala === 1).degrau === "compacto"
  );
  ok(
    "na pior combinação (700 px, 1,5×) o encaixe ainda cobre a fita",
    (() => {
      const p = planos.find((x) => x.largura === 700 && x.escala === 1.5);
      return p.sobra >= -0.001 && p.abertos.length + p.noMenu.length === INICIO.grupos.length;
    })()
  );
}

console.log("\nos casos de borda da função");
{
  const vazio = encaixarFita(800, []);
  ok("sem grupos, a fita está cheia (nada a decidir)", vazio.degrau === "cheio" && vazio.abertos.length === 0);

  const apertado = encaixarFita(1, INICIO.grupos);
  ok(
    "numa largura impossível, todos vão para o menu e a sobra fica negativa (o limite é dito, não escondido)",
    apertado.degrau === "menu" && apertado.noMenu.length === INICIO.grupos.length && apertado.sobra < 0,
    `${apertado.sobra.toFixed(1)} px`
  );

  const comGap = encaixarFita(700, INICIO.grupos, { gap: 8 });
  ok(
    "o espaço entre os grupos entra na conta (aperta o plano)",
    comGap.sobra >= -0.001 && comGap.sobra < encaixarFita(700, INICIO.grupos).sobra,
    `${comGap.sobra.toFixed(1)} px contra ${encaixarFita(700, INICIO.grupos).sobra.toFixed(1)} px`
  );

  const botaoGrande = encaixarFita(1100, INICIO.grupos, { larguraBotao: LARGURA_BOTAO * 2 });
  ok("um botão mais largo colapsa mais cedo (o custo do menu está na conta)", botaoGrande.noMenu.length >= encaixarFita(1100, INICIO.grupos).noMenu.length);
}

// ---------------------------------------------------------------- 3) a fiação e o CSS

console.log("\na fiação nas três fitas");
{
  const fita = ler("src/fita.ts");
  ok(
    "o fita.ts usa a função do encaixe (nada de degraus soltos por aqui)",
    /import \{ (AJUSTE_MIN, )?encaixarFita \} from "\.\/fitaEncaixe"/.test(fita) && /encaixarFita\(interno, larguras, \{/.test(fita),
    "o plano volta para dentro do fita.ts"
  );
  // o plano é uma ESTIMATIVA (supõe que todo grupo encolhe com as métricas): o que sobra de rolagem
  // no DOM é conferido depois de aplicar — encolhe mais as métricas e, por fim, colapsa mais um grupo
  ok(
    "o encaixe confere o DOM depois do plano (sobrou rolagem: encolhe mais e colapsa mais um grupo)",
    /painel\.scrollWidth > painel\.clientWidth \+ 1/.test(fita) && /aj >= AJUSTE_MIN/.test(fita) && /abertos\[i\]\.classList\.add\("fita-grupo-recolhido"\)/.test(fita),
    "sem isso a aba Animações (galeria de largura própria) estourava a largura com o plano dizendo que cabia"
  );
  const cssPpt = ler("src/styles/powerpoint-edicao.css");
  ok(
    "a galeria de animações acompanha as métricas da fita (não tem mais 72px fixos)",
    /\.ppr-anim \{[^}]*repeat\(7, calc\(72px \* var\(--fita-e\)\)\)/.test(cssPpt) && /\.ppr-anim-item \{[^}]*width: calc\(72px \* var\(--fita-e\)\)/.test(cssPpt)
  );
  ok(
    "e o ligarEncaixeFita recebe os seletores de cada fita",
    /export function ligarEncaixeFita\(o: OpcoesEncaixeFita\)/.test(fita) &&
      /painel: string;/.test(fita) &&
      /corpo: string;/.test(fita) &&
      /grupo: string;/.test(fita) &&
      /rotulo: string;/.test(fita)
  );
  ok(
    "mede com tudo aberto e o ajuste em 1 (a largura do grupo é a natural)",
    /classList\.remove\("fita-grupo-recolhido"\)/.test(fita) && /setProperty\("--fita-ajuste", "1"\)/.test(fita),
    "medir com o ajuste do plano anterior daria a largura errada"
  );
  ok(
    "o plano vira classe e atributo (o degrau fica legível para quem inspeciona)",
    /classList\.toggle\("fita-modo-unico", plano\.degrau === "faixa-unica"\)/.test(fita) && /dataset\.fitaDegrau = plano\.degrau/.test(fita)
  );
  ok(
    "o menu vive DENTRO da faixa (é o que mantém o despacho dos comandos valendo)",
    /o\.el\.append\(pop\)/.test(fita) && /pop\.className = "fita-grupo-pop"/.test(fita),
    "no body (como os outros popups), os controles do grupo ficariam mudos"
  );
  ok(
    "o corpo do grupo é MOVIDO para o menu e devolvido ao fechar (nada de cópia)",
    /pop\.append\(corpo\)/.test(fita) && /grupo\.insertBefore\(corpo, rotulo \?\? null\)/.test(fita)
  );
  ok(
    "fechar o menu não fecha a faixa recolhida (mexer no grupo é mexer na faixa)",
    /\.fita-grupo-btn, \.fita-grupo-pop/.test(fita)
  );

  // as três fitas
  const ppt = ler("src/powerpoint/powerpoint.ts");
  const word = ler("src/word/ribbon.ts");
  const excel = ler("src/excel/ribbon.ts");
  ok(
    "o PowerPoint liga o encaixe nos grupos .ppr-grupo",
    /ligarEncaixeFita\(\{ el: this\.fita\.el, painel: "\.ppr-painel", grupo: "\.ppr-grupo", corpo: "\.ppr-corpo", rotulo: "\.ppr-rotulo" \}\)/.test(ppt)
  );
  ok("o Word liga o encaixe nos grupos .rb-group", /ligarEncaixeFita\(\{ el: host, painel: "\.wd-rpanel", grupo: "\.rb-group", corpo: "\.rb-body", rotulo: "\.rb-glabel" \}\)/.test(word));
  ok("o Excel liga o encaixe nos grupos .xl-group", /ligarEncaixeFita\(\{ el: host, painel: "\.xl-panel", grupo: "\.xl-group", corpo: "\.xl-body", rotulo: "\.xl-glabel" \}\)/.test(excel));
  ok(
    "as três fitas ligam a ALTURA e depois o ENCAIXE (a altura manda na escala das métricas)",
    /ligarAjusteAlturaFita\(\{ el: this\.fita\.el, modo: "metricas" \}\)/.test(ppt) &&
      /ligarAjusteAlturaFita\(\{ el: host, modo: "metricas" \}\)/.test(word) &&
      /ligarAjusteAlturaFita\(\{ el: host, modo: "metricas" \}\)/.test(excel),
    "o Excel também é métricas (o modo zoom encolhia a fonte junto)"
  );
  ok(
    "os botões de rolagem do Word saíram (o encaixe tomou o lugar)",
    !/wd-ribbon-nav/.test(word) && !/wd-ribbon-nav/.test(ler("src/styles/word.css")) && !/updateNavButtons/.test(word)
  );
  ok(
    "a roda do mouse não rola mais os painéis da fita (só o que é galeria)",
    !/ligarRodaHorizontal\)/.test(excel) && /querySelectorAll<HTMLElement>\("\.ppr-abas"\)\.forEach\(ligarRodaHorizontal\)/.test(ppt) && /"\.rb-styles"\)\.forEach\(ligarRodaHorizontal\)/.test(word)
  );
}

console.log("\no teto da alça de altura");
{
  const fita = ler("src/fita.ts");
  ok(
    "o teto é o menor entre 1,5× e um terço da janela",
    /window\.innerHeight \/ 3 \/ alturaNaEscala1\(\)/.test(fita) && /Math\.min\(ESCALA_MAX, porJanela\)/.test(fita),
    "sem o teto, a faixa de 1,5× comeria a tela numa janela baixa"
  );
  ok("o arrasto e as setas param no teto", /Math\.min\(s, teto\(\)\)/.test(fita) && /Math\.min\(teto\(\), escala \+ passo\)/.test(fita));
  ok(
    "a altura À VISTA é limitada; o valor guardado é a preferência",
    /const efetiva = Math\.min\(escala, teto\(\)\)/.test(fita) && /gravarEscala\(escala\)/.test(fita),
    "guardar o valor limitado apagaria a preferência de quem usa a janela maximizada"
  );
  ok("a janela mudou de altura: o teto é recalculado", /window\.addEventListener\("resize", aplicar\)/.test(fita));
}

console.log("\no CSS do encaixe");
{
  const css = ler("src/styles/fita.css");
  ok(
    "o grupo colapsado vira botão (e o corpo/rótulo saem de cena)",
    /\.fita-grupo-recolhido > \.fita-grupo-btn\s*\{[^}]*display:\s*inline-flex/.test(css) &&
      /\.fita-grupo-recolhido > \.ppr-corpo/.test(css) &&
      /\.fita-grupo-recolhido > \.rb-body/.test(css) &&
      /\.fita-grupo-recolhido > \.xl-body/.test(css)
  );
  ok("o menu do grupo é posicionado pela faixa (position: absolute dentro dela)", /\.fita-grupo-pop\s*\{[^}]*position:\s*absolute/.test(css) && /\.pp-ribbon\.ppr\s*\{[^}]*position:\s*relative/.test(css));
  ok("na faixa única o botão encolhe com elipse (a linha nunca passa da largura)", /\.fita-modo-unico \.fita-grupo-nome\s*\{[^}]*text-overflow:\s*ellipsis/.test(css));
  ok(
    "o modo recolhido não esconde mais os painéis (a faixa única mostra os grupos da aba ativa)",
    !/\.fita-recolhida \.wd-ribbon-panels[^{]*\{[^}]*display:\s*none/.test(css) && /\.pp-ribbon\.fita-recolhida \.ppr-paineis\s*\{[^}]*min-height:\s*0/.test(css)
  );

  const pptCss = ler("src/styles/powerpoint-edicao.css");
  const wdCss = ler("src/styles/word.css");
  const xlCss = ler("src/styles/excel.css");
  ok("a fita do PowerPoint metrifica pela escala × ajuste", /--fita-e:\s*calc\(var\(--fita-escala/.test(pptCss));
  ok("a fita do Word metrifica pela escala × ajuste", /--fita-e:\s*calc\(var\(--fita-escala/.test(wdCss) && /\.rb-body\s*\{[^}]*var\(--fita-e/.test(wdCss));
  ok("a fita do Excel metrifica pela escala × ajuste", /--fita-e:\s*calc\(var\(--fita-escala/.test(xlCss) && /\.xl-body\s*\{[^}]*var\(--fita-e/.test(xlCss));
  ok(
    "os três painéis pararam de rolar na horizontal (nada de barra de rolagem)",
    /\.ppr-painel\s*\{[^}]*overflow:\s*hidden/.test(pptCss) && /\.wd-rpanel\s*\{[^}]*overflow:\s*hidden/.test(wdCss) && /\.xl-panel\s*\{[^}]*overflow:\s*hidden/.test(xlCss)
  );
  ok(
    "o Word ganhou pisos de fonte no rótulo do grupo (a escala não come o texto)",
    /\.rb-glabel\s*\{[^}]*font-size:\s*max\(/.test(wdCss) && /\.xl-glabel\s*\{[^}]*font-size:\s*max\(/.test(xlCss)
  );
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
