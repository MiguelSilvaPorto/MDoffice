// Teste das regras de layout que já quebraram: quando o Início abre, ele precisa ocupar
// TODO o espaço, e não dividir a tela com o painel do documento ativo (Excel, Word ou
// PowerPoint). O Word já tinha a regra; faltavam Excel e PowerPoint.
//
// Roda com: npm run test:layout
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
let falhas = 0;
const checa = (nome: string, ok: boolean, falta = "") => {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${nome}${!ok && falta ? ` — ${falta}` : ""}`);
  if (!ok) falhas++;
};

const ler = (rel: string) => readFileSync(join(raiz, rel), "utf8");

console.log("layout do Início");

// 1. O Início é uma página inteira: some com o editor e a pré-visualização do Markdown.
const home = ler("src/styles/home.css");
checa("home.css esconde o editor", /body\.home-open #editor-wrap/.test(home));
checa("home.css esconde a divisória", /body\.home-open #splitter/.test(home));
checa("home.css esconde a pré-visualização", /body\.home-open #preview-wrap/.test(home));
checa("home.css esconde as configurações", /body\.home-open #settings-page/.test(home));
checa("home.css mostra o Início", /body\.home-open #home-page\s*\{[^}]*display:\s*flex/.test(home));

// 2. Os painéis dos motores (Word, PowerPoint, Excel) também precisam sair de cena —
//    senão eles ficam lado a lado com o Início, cada um com metade da tela.
const motores: [string, string, string][] = [
  ["src/styles/word.css", "word", "word-pane"],
  ["src/styles/powerpoint.css", "ppt", "powerpoint-pane"],
  ["src/styles/excel.css", "xlsx", "excel-pane"],
];
for (const [arquivo, classe, painel] of motores) {
  const css = ler(arquivo);
  // `[^{]*` cobre seletores combinados por vírgula (ex.: settings-open + home-open no
  // mesmo bloco), que é como os arquivos estão escritos
  const mostra = new RegExp(`body\\.${classe}-open #${painel}[^{]*\\{[^}]*display:\\s*flex`).test(css);
  const esconde = new RegExp(`body\\.home-open #${painel}[^{]*\\{[^}]*display:\\s*none`).test(css);
  const escondeSettings = new RegExp(`body\\.settings-open #${painel}[^{]*\\{[^}]*display:\\s*none`).test(css);
  checa(`${arquivo}: mostra o painel quando a aba do motor está ativa`, mostra, "regra body.*-open ausente");
  checa(`${arquivo}: esconde o painel quando o Início abre`, esconde, "regra body.home-open ausente");
  checa(`${arquivo}: esconde o painel quando as Configurações abrem`, escondeSettings, "regra body.settings-open ausente");
  // a regra do home precisa valer de verdade: no mesmo arquivo, depois da que mostra o
  // painel (mesma especificidade — a última vence)
  const posMostra = css.search(new RegExp(`body\\.${classe}-open #${painel}`));
  const posEsconde = css.search(new RegExp(`body\\.home-open #${painel}`));
  checa(`${arquivo}: a regra do Início vem depois da que mostra o painel`, posEsconde > posMostra, "ordem no arquivo inverteria o resultado");
}

// 3. Fita do PowerPoint: trocar de aba não pode mexer no tamanho da faixa.
//    Os painéis dividem a mesma célula (a altura vira a do mais alto) e o painel
//    inativo continua no lugar, invisível; o rótulo da aba reserva a largura do negrito.
console.log("fita do PowerPoint: tamanho estável entre abas");

const pp = ler("src/styles/powerpoint-edicao.css");
checa("os painéis dividem a mesma célula (altura constante)", /\.ppr-paineis\s*\{[^}]*display:\s*grid/.test(pp), "regra .ppr-paineis { display: grid } ausente");
checa("cada painel fica na célula 1/1", /\.ppr-painel\s*\{[^}]*grid-area:\s*1\s*\/\s*1/.test(pp), "grid-area ausente em .ppr-painel");
checa("o painel inativo não some do layout", /\.ppr-painel\[hidden\]\s*\{[^}]*display:\s*flex/.test(pp), "display: flex ausente em .ppr-painel[hidden]");
checa("o painel inativo fica invisível (clique/foco/leitura)", /\.ppr-painel\[hidden\]\s*\{[^}]*visibility:\s*hidden/.test(pp), "visibility ausente em .ppr-painel[hidden]");
checa("o rótulo da aba reserva a largura do negrito", /\.ppr-aba-rot::after\s*\{[^}]*font-weight:\s*600/.test(pp) && /\.ppr-aba-rot::after\s*\{[^}]*visibility:\s*hidden/.test(pp), "regra .ppr-aba-rot::after ausente");
checa("o preview da Formas segue o tamanho do ícone grande", /button\.ppr\.big \.ppr-gal-ic svg\s*\{[^}]*width:\s*var\(--pe-icone-g\)/.test(pp), "regra button.ppr.big .ppr-gal-ic svg ausente");
checa("na fita compacta o preview usa o ícone normal", /fita-compacta button\.ppr\.big \.ppr-gal-ic svg\s*\{[^}]*width:\s*var\(--pe-icone\)/.test(pp), "regra .fita-compacta .ppr-gal-ic svg ausente");
checa("o preview da forma fica centrado no próprio ícone", /viewBox="-2 -2 26 26"/.test(ler("src/powerpoint/ui/galeria.ts")), "viewBox assimétrico no iconeDeForma");
const sl = ler("src/styles/slides.css");
checa("a apresentação não deixa o contorno de edição aparecer", /\.slides-overlay \.pp-shape[\s\S]{0,140}pointer-events:\s*none\s*!important/.test(sl) && /\.slides-overlay \.pp-shape\.pp-rica:hover[\s\S]{0,140}outline:\s*none/.test(sl), "regras de isolamento do deck ausentes");

// 4. Barra lateral: recolher animado (largura), pílula deslizante no seletor de painéis e
//    troca de painel sem o "pop" com escala.
console.log("barra lateral: movimento");

const html = ler("index.html");
const sb = ler("src/styles/sidebar.css");
const ws = ler("src/styles/workspace.css");
const mov = ler("src/styles/movimento.css");
checa("index.html tem a pílula dentro do seletor de painéis", /class="sb-tabs"[^>]*>\s*<span class="sb-pill"/.test(html), "span.sb-pill ausente em .sb-tabs");
checa(
  "a barra lateral recolhe pela largura (não some de uma vez)",
  /body\.no-sidebar #sidebar\s*\{[^}]*width:\s*0/.test(sb) && !/body\.no-sidebar #sidebar\s*\{[^}]*display:\s*none/.test(sb),
  "regra width: 0 ausente (ou ainda com display: none)"
);
checa("a barra lateral tem transição de largura", /#sidebar\s*\{[^}]*transition:[^}]*width/.test(mov), "transition de width ausente em #sidebar");
checa("a pílula desliza (transição de transform)", /\.sb-pill\s*\{[^}]*transition:[^}]*transform/.test(mov), "transition de transform ausente em .sb-pill");
checa("a pílula fica ancorada no seletor", /\.sb-tabs\s*\{[^}]*position:\s*relative/.test(ws) && /\.sb-pill\s*\{[^}]*position:\s*absolute/.test(ws));
checa("o botão ativo do seletor deixa o fundo para a pílula", /\.sb-tab\.active\s*\{[^}]*background:\s*transparent/.test(ws));
checa("o Início destaca a aba só pela cor (sem pintar o fundo)", !/\.sb-tab\[data-side="home"\]\.active[^{]*\{[^}]*background/.test(home));
checa("a troca de painel usa o passo curto (mdc-painel), sem escala", /\.sb-panel:not\(\[hidden\]\)[^{]*\{[^}]*mdc-painel/.test(mov));

// 4.2 Troca de abas: a nova ativa dá um pop e o documento desliza do lado da aba.
console.log("troca de abas: movimento");

checa("a nova aba ativa entra com um pop", /\.tab\.ativando\s*\{[^}]*mdc-aba-ativa/.test(mov), "regra .tab.ativando ausente no movimento");
checa("o documento desliza conforme o lado da aba", /\.troca-conteudo-dir[\s\S]{0,220}mdc-conteudo-dir/.test(mov) && /\.troca-conteudo-esq[\s\S]{0,220}mdc-conteudo-esq/.test(mov), "troca do conteúdo ausente no movimento");
checa("o nível discreto desliga a troca de abas", /anim-discreta[^{]*:where\([\s\S]{0,1500}\.troca-conteudo-dir/.test(mov), "troca fora da lista do nível discreto");
checa("a troca de abas está ligada no app", /troca-conteudo-\$\{dir\}/.test(ler("src/app/tabs.ts")), "sem a chamada em src/app/tabs.ts");
checa("a barra lembra a aba ativa anterior", /ativando/.test(ler("src/tabs.ts")), "sem o ativando em src/tabs.ts");

// 4.1 Barra superior: o "Apresentar" só aparece com uma apresentação (PowerPoint) ativa.
console.log("barra superior: Apresentar com apresentação");

const tb = ler("src/styles/topbar.css");
checa("o Apresentar da barra só aparece com apresentação ativa", /#tb-present\s*\{[^}]*display:\s*none/.test(tb) && /body\.ppt-open #tb-present\s*\{[^}]*display:\s*inline-flex/.test(tb), "regra de visibilidade do #tb-present ausente");
checa("o botão existe no index.html com a ação de apresentar", /id="tb-present"[^>]*data-act="present"/.test(html), "button#tb-present ausente no index.html");

// 5. Configurações ▸ Aparência: tema, nível de animação (3 cartões) e cantos (2 cartões),
//    todos em cartões clicáveis lado a lado, com prévia.
console.log("configurações: aparência em cartões (tema, animação e cantos)");

const cfg = ler("src/settingsPage.ts");
const set = ler("src/styles/settings.css");
const cts = ler("src/styles/cantos.css");
const boot = ler("index.html");
checa(
  "os cartões ficam lado a lado (grade de 2 e de 3)",
  /\.st-opcoes\s*\{[^}]*grid-template-columns:\s*1fr\s+1fr/.test(set) && /\.st-opcoes\.tres\s*\{[^}]*repeat\(3,\s*1fr\)/.test(set),
  "grade de 2 ou de 3 colunas ausente"
);
checa("o cartão escolhido fica marcado", /\.st-opcao:has\(input:checked\)\s*\{/.test(set), "estado :has(input:checked) ausente em .st-opcao");
checa(
  "as prévias têm as cores fixas dos dois temas",
  /\.st-opcao-previa\[data-tema="claro"\]\s*\{[^}]*background:\s*#ffffff/.test(set) && /\.st-opcao-previa\[data-tema="escuro"\]\s*\{[^}]*background:\s*#0e1014/.test(set),
  "prévia do claro/escuro ausente"
);
checa("o interruptor antigo do tema saiu da página", !/data-k="dark"/.test(cfg), 'ainda existe data-k="dark"');
checa(
  "os cartões gravam tema, animação e cantos",
  /input\[name="tema"\]/.test(cfg) &&
    /ctx\.setDark\(/.test(cfg) &&
    /input\[name="animacao"\]/.test(cfg) &&
    /ctx\.setAnimacao\(/.test(cfg) &&
    /input\[name="cantos"\]/.test(cfg) &&
    /ctx\.setCantos\(/.test(cfg),
  "ligação de um dos grupos ausente em settingsPage.ts"
);
checa(
  "os três níveis de animação têm tempo próprio",
  /html\.anim-discreta\s*\{[^}]*--mov-2:\s*100ms/.test(mov) && /html\.anim-completa\s*\{[^}]*--mov-2:\s*300ms[^}]*--mov-3:\s*460ms/.test(mov),
  "durações de discreta/completa ausentes em movimento.css"
);
checa("o nível discreto tira entradas e elevação", /html\.anim-discreta[^{]*\{[^}]*animation:\s*none\s*!important/.test(mov), "regra animation: none ausente");
checa("o nível completo dá mais relevo", /html\.anim-completa[^{]*\{[^}]*translateY\(-3px\)\s*!important/.test(mov), "regra translateY(-3px) ausente");
checa(
  "o completo tem entrada PRÓPRIA (mola, viagem maior e escadinha), não só mais tempo",
  /--curva-mola:/.test(mov) &&
    /@keyframes mdc-surgir-mais/.test(mov) &&
    /@keyframes mdc-menu-mais/.test(mov) &&
    /@keyframes mdc-item-mais/.test(mov) &&
    /html\.anim-completa \.modal-backdrop > :not\(style\):not\(script\)\s*\{[^}]*mdc-surgir-mais[^}]*var\(--curva-mola\)/.test(mov) &&
    /html\.anim-completa \.palette-item:nth-child\(3\)\s*\{[^}]*animation-delay:\s*52ms/.test(mov),
  "o nível completo voltaria a ser só 30 ms mais lento que o padrão"
);
checa(
  "as prévias dos cartões mostram ritmos diferentes",
  (() => {
    const previas = ler("src/styles/settings.css");
    return (
      /@keyframes prev-completa/.test(previas) &&
      /data-anim="completa"[^}]*prev-completa/.test(previas) &&
      /data-anim="padrao"[^}]*prev-anim/.test(previas) &&
      /prev-discreta/.test(previas) &&
      /data-anim="completa"/.test(cfg) &&
      /data-anim="padrao"/.test(cfg)
    );
  })(),
  "a prévia do completo ainda usa o mesmo passo do padrão"
);
checa(
  "a rede de segurança da saída cobre o tempo do completo",
  (() => {
    const limite = Number(/const LIMITE = (\d+)/.exec(ler("src/movimento.ts"))?.[1] ?? 0);
    const maior = Math.max(...[...mov.matchAll(/--mov-\d:\s*(\d+)ms/g)].map((m) => Number(m[1])));
    return limite >= maior;
  })(),
  "o modal sairia antes de a animação do completo acabar"
);
checa(
  "o quadrado aperta de verdade (2 px nos controles, 3 px nas caixas)",
  /html\.cantos-quadrados[^{]*\{[^}]*border-radius:\s*2px\s*!important/.test(cts) && /html\.cantos-quadrados[^{]*\{[^}]*border-radius:\s*3px\s*!important/.test(cts),
  "raios do quadrado ausentes em cantos.css"
);
checa("o redondo não sobrescreve nada (é o desenho original)", !/cantos-redondos/.test(cts), "ainda existe regra de cantos-redondos em cantos.css");
checa(
  "o redondo também não deixa classe no <html>",
  /classList\.remove\("cantos-redondos"\)/.test(ler("src/app/layout.ts")),
  "applyCantos deveria remover a classe dos redondos"
);
checa(
  "as abas do topo seguem os cantos",
  /html\.cantos-quadrados \.tab\s*\{[^}]*2px 2px 0 0/.test(cts),
  "regra direcional das abas ausente"
);
checa("o boot aplica animação e cantos antes da primeira pintura", /mdc\.animacao/.test(boot) && /mdc\.cantos/.test(boot), "index.html não lê as duas chaves");

// ---------- puxar a pré-visualização de volta pela borda direita ----------

console.log("\npuxar a pré-visualização de volta");

const cssDaAlca = ler("src/styles/editor.css");
const htmlDaAlca = ler("index.html");
const layoutDaAlca = ler("src/app/layout.ts");

// A alça só existe com a prévia fechada. Com a prévia aberta ela cairia nos últimos
// pixels do editor — exatamente onde fica a barra de rolagem.
checa(
  "a alça existe no HTML, como último item do #body",
  /<div id="preview-puxa"[^>]*><\/div>\s*<\/div>\s*<footer id="statusbar"/.test(htmlDaAlca),
  "div #preview-puxa ausente antes do fechamento do #body"
);
checa("a alça nasce escondida", /#preview-puxa\s*\{[^}]*display:\s*none/.test(cssDaAlca), "falta display:none");
checa(
  "só aparece com a prévia fechada",
  /body\.no-preview #preview-puxa\s*\{[^}]*display:\s*block/.test(cssDaAlca),
  "falta a regra body.no-preview"
);
checa("ela reserva a faixa na direita (8px)", /#preview-puxa\s*\{[^}]*width:\s*8px/.test(cssDaAlca), "falta a largura");
checa("o cursor é o de redimensionar", /#preview-puxa\s*\{[^}]*cursor:\s*col-resize/.test(cssDaAlca), "falta o cursor");
checa(
  "acende a linha no hover, como o divisor",
  /#preview-puxa:hover::after/.test(cssDaAlca) && /var\(--accent\)/.test(cssDaAlca),
  "falta a linha do hover"
);

// Os painéis que já escondem o divisor precisam esconder a alça também: com a prévia
// fechada e uma planilha aberta, ela apareceria numa tela onde não há prévia.
const paineis: [string, string][] = [
  ["src/styles/home.css", "home-open"],
  ["src/styles/word.css", "word-open"],
  ["src/styles/powerpoint.css", "ppt-open"],
  ["src/styles/excel.css", "xlsx-open"],
  ["src/styles/settings.css", "settings-open"],
  ["src/styles/palette.css", "focus-mode"],
];
for (const [arquivo, classe] of paineis) {
  checa(
    `${arquivo}: esconde a alça`,
    new RegExp(`body\\.${classe} #preview-puxa`).test(ler(arquivo)),
    "a alça apareceria neste painel"
  );
}

// O gesto: clicar traz de volta no tamanho anterior; arrastar acompanha o dedo.
checa(
  "o clique reabre a prévia (tira o no-preview)",
  /pointerdown[\s\S]{0,900}?contains\("no-preview"\)\) this\.toggle\("no-preview"\)/.test(layoutDaAlca),
  "o pointerdown não reabre a prévia"
);
checa(
  "o arrasto é medido pelo deslocamento do dedo (não pela posição)",
  /puxaInicioRatio \+ \(e\.clientX - puxaInicioX\) \/ bounds\.free/.test(layoutDaAlca),
  "o arrasto não usa o deslocamento"
);
checa(
  "quem escuta o movimento é a janela (a alça sai da tela ao reabrir)",
  /window\.addEventListener\("pointermove", aoMoverPuxa\)/.test(layoutDaAlca),
  "faltam os ouvintes na janela"
);

// ---------- seletor do app: o controle cabe na linha e acompanha o contexto ----------

console.log("\nseletor do app (no lugar do <select> nativo)");

const sel = ler("src/seletor.ts");
checa("o rótulo vazio fica em branco (sem o '—' de antes)", /rot\.textContent = rotuloDe\(select\);/.test(sel));
checa("a lista aberta fecha antes de redesenhar um painel", /export function fecharSeletor\(/.test(sel));
checa("a setinha acompanha o tamanho do contexto (1em)", /\.sel-face \.ic\s*\{[^}]*width:\s*1em/.test(ler("src/styles/base.css")));
checa(
  "a lista longa não cobre a tela (altura presa, rolagem dentro)",
  /\.dropdown\.sel-menu\s*\{[^}]*max-height:\s*min\(72vh,\s*430px\)[^}]*overflow-y:\s*auto/s.test(ler("src/styles/editor.css")),
  "a lista do tamanho da fonte abre na altura natural e cobre a janela"
);
checa(
  "a lista abre já no item marcado",
  /const marcado = marca\?\.closest<HTMLElement>\("\.dd-item"\)/.test(sel) && /menu\.scrollTop \+=/.test(sel)
);

// nas fitas, o seletor tem a altura dos botões da mesma linha (senão fica torto)
checa("Word: .rb-select tem a altura do .rb (28px)", /\.rb-select\s*\{[^}]*height:\s*28px/.test(ler("src/styles/word.css")));
checa("PowerPoint: .ppr-sel usa a altura dos botões", /\.ppr-sel\s*\{[^}]*height:\s*var\(--pe-altura\)/.test(ler("src/styles/powerpoint-edicao.css")));
checa("Excel: .xl-select tem a altura do .xl (26px)", /\.xl-select\s*\{[^}]*height:\s*26px/.test(ler("src/styles/excel.css")));

// a setinha do menu dos botões de cor fica dentro do botão (antes estourava a linha)
checa("PowerPoint: a setinha do botão de cor fica no canto", /button\.ppr\.cor\s*\{[^}]*position:\s*relative/.test(ler("src/styles/powerpoint-edicao.css")));

// "A maior/A menor": a seta de baixo é subscrita (a de cima continua sobrescrita)
checa("PowerPoint: diminuir fonte com a seta embaixo", /A<sub>▼<\/sub>/.test(ler("src/powerpoint/ui/fita.ts")));
checa("Word: diminuir fonte com a seta embaixo", /A<sub>▼<\/sub>/.test(ler("src/word/ribbon.ts")));

// o painel do PowerPoint se redesenha sozinho: não pode matar a lista aberta
checa("PowerPoint: o painel espera a lista fechar antes de redesenhar", /fecharSeletor\(this\.el\)/.test(ler("src/powerpoint/ui/painel.ts")));

// o grupo de escolha do painel (preenchimento: Do tema/Sólido/Gradiente/Imagem) desenha o
// próprio círculo e destaca o escolhido — o controle nativo ficava pequeno e a seleção, fraca
const peCss = ler("src/styles/powerpoint-edicao.css");
checa(
  "PowerPoint: o círculo da escolha é do app (nativo escondido)",
  /\.pf-radios input\[type="radio"\]\s*\{[^}]*appearance:\s*none/s.test(peCss)
);
checa(
  "PowerPoint: o escolhido fica destacado (fundo do tema no rótulo inteiro)",
  /\.pf-radios label:has\(input:checked\)\s*\{[^}]*background:\s*var\(--accent-soft\)[^}]*border-color:\s*var\(--accent\)/s.test(peCss)
);
checa(
  "PowerPoint: o círculo escolhido tem o ponto da cor de destaque",
  /\.pf-radios input\[type="radio"\]:checked\s*\{[^}]*radial-gradient\(circle closest-side, var\(--accent\)/s.test(peCss)
);

// ---------------------------------------------------------------- prancheta: zoom até 800%

console.log("\nprancheta: zoom até 800% (janela visível)");

const quadroDesenho = ler("src/md/draw/board.ts");
const quadroLetras = ler("src/md/textdraw/board.ts");

checa("desenho: o zoom vai até 800%", /clamp\(Math\.round\(zoom \* 100\) \/ 100, 0\.5, 8\)/.test(quadroDesenho), "o teto continua 300%");
checa("letras: o zoom vai até 800%", /clamp\(Math\.round\(zoom \* 100\) \/ 100, 0\.5, 8\)/.test(quadroLetras), "o teto continua 300%");

// O canvas pinta só a JANELA visível: o quadro inteiro a 800% seriam ~100 milhões de pixels.
checa("desenho: o buffer é a janela × densidade (com teto de memória)", /escala = Math\.min\(dpr, Math\.sqrt\(8_000_000/.test(quadroDesenho));
checa("letras: o buffer é a janela × densidade (com teto de memória)", /escala = Math\.min\(dpr, Math\.sqrt\(8_000_000/.test(quadroLetras));
checa("desenho: a pintura usa a janela visível", /const j = this\.janela\(\);/.test(ler("src/md/draw/boardRender.ts")));

const cssModais = ler("src/styles/modals.css");
checa("css: a folha do quadro existe (é ela que dá a rolagem)", /\.dr-sheet\s*\{/.test(cssModais));
checa("css: o canvas fica preso à área à vista (sticky)", /\.dr-canvas\s*\{[^}]*position:\s*sticky/s.test(cssModais), "o canvas não acompanharia a rolagem");
checa("css: o quadro embutido rola em vez de cortar", /\.draw-inline \.draw-canvas-wrap\s*\{[^}]*overflow:\s*auto/s.test(ler("src/styles/welcome.css")));

const editorQuadro = ler("src/md/draw/editor.ts");
checa("editor: os passos crescem no zoom alto (800% sem vinte cliques)", /passoZoom = \(z: number\) => \(z < 2 \? 0\.25 : z < 4 \? 0\.5 : 1\)/.test(editorQuadro));
checa(
  "editor: a roda do mouse ancora no ponteiro",
  /setZoom\(z \+ \(e\.deltaY < 0 \? passoZoom\(z\) : -passoZoom\(z\)\), \{ x: e\.clientX, y: e\.clientY \}\)/.test(editorQuadro),
  "o zoom não ancora no ponteiro"
);

// ---------------------------------------------------------------- PowerPoint: zoom até 800%

console.log("\nPowerPoint: zoom até 800% (palco rola de verdade)");

const palcoPpt = ler("src/powerpoint/stage.ts");
const ppt = ler("src/powerpoint/powerpoint.ts");

checa("o teto do zoom é 800%", /const ZOOM_MAX = 800;/.test(palcoPpt), "o teto continua 400%");
checa(
  "o passo cresce no zoom alto (800% sem setenta cliques)",
  /export function passoZoom\(atual: number\): number \{/.test(palcoPpt) &&
    /if \(atual < 150\) return 10;/.test(palcoPpt) &&
    /if \(atual < 250\) return 25;/.test(palcoPpt) &&
    /if \(atual < 500\) return 50;/.test(palcoPpt),
  "o passo continua fixo"
);
checa(
  "o clique no + / − usa o passo adaptativo",
  /this\.setZoom\(this\.stage\.zoomAtual \+ passoZoom\(this\.stage\.zoomAtual\)\)/.test(ppt) &&
    /this\.setZoom\(this\.stage\.zoomAtual - passoZoom\(this\.stage\.zoomAtual\)\)/.test(ppt)
);
checa(
  "a roda (Ctrl) usa o passo adaptativo e ancora no ponteiro",
  /setZoom\(this\.stage\.zoomAtual \+ \(e\.deltaY < 0 \? passoZoom\(this\.stage\.zoomAtual\) : -passoZoom\(this\.stage\.zoomAtual\)\), ponto\)/.test(ppt),
  "a roda não ancora no ponteiro ou não usa o passo"
);
checa(
  "botão direito + arrastar move a tela (panorama)",
  /if \(e\.button === 2\)/.test(palcoPpt) &&
    /t: "panorama"/.test(palcoPpt) &&
    /modo\.caixa\.scrollLeft = modo\.esquerda - dx;/.test(palcoPpt) &&
    /modo\.caixa\.scrollTop = modo\.topo - dy;/.test(palcoPpt),
  "sem o arrasto do botão direito, navegar no zoom alto é só pela barra"
);
checa(
  "clique direito parado continua abrindo o menu (o arrasto é consumido antes)",
  /consumirPanorama\(\): boolean/.test(palcoPpt) && /if \(this\.stage\.consumirPanorama\(\)\) return;/.test(ppt),
  "o menu abriria depois de arrastar (ou sumiria no clique parado)"
);
checa(
  "o cursor vira 'agarrando' durante o arrasto",
  /\.pp-frame\.pp-panorama[\s\S]{0,120}cursor: grabbing/.test(ler("src/styles/powerpoint.css"))
);

// 6. Boas-vindas: o logo é o ÍCONE DO APP (o mesmo da janela), não o "M↓" num quadradinho.
console.log("\npasta padrão dos documentos (Documentos/mdOffice com as quatro subpastas)");
{
  const pastas = await import("../src/pastas.ts");
  checa(
    "cada tipo tem a sua subpasta",
    pastas.PASTA_DO_TIPO.md === "Markdown" &&
      pastas.PASTA_DO_TIPO.word === "Word" &&
      pastas.PASTA_DO_TIPO.excel === "Excel" &&
      pastas.PASTA_DO_TIPO.ppt === "PowerPoint",
    JSON.stringify(pastas.PASTA_DO_TIPO)
  );
  checa(
    "cada tipo nasce com a extensão certa",
    pastas.EXTENSAO_DO_TIPO.md === "md" && pastas.EXTENSAO_DO_TIPO.word === "docx" && pastas.EXTENSAO_DO_TIPO.excel === "xlsx" && pastas.EXTENSAO_DO_TIPO.ppt === "pptx"
  );
  checa(
    "o caminho usa o separador do sistema e não duplica a barra",
    pastas.comRaizPadrao("C:\\Users\\ana\\Documents\\mdOffice", "md") === "C:\\Users\\ana\\Documents\\mdOffice\\Markdown" &&
      pastas.juntarPasta("/home/ana/mdOffice/", "Word") === "/home/ana/mdOffice/Word",
    pastas.comRaizPadrao("C:\\Users\\ana\\Documents\\mdOffice", "md")
  );
  checa(
    "o nome novo não colide com o que existe",
    pastas.nomeLivre([], "md") === "Documento.md" &&
      pastas.nomeLivre(["Documento.md"], "md") === "Documento-2.md" &&
      pastas.nomeLivre(["documento.md", "Documento-2.md"], "md") === "Documento-3.md",
    pastas.nomeLivre(["Documento.md"], "md")
  );

  // o documento novo nasce pela pasta padrão: os quatro fluxos chamam nascerNoPadrao
  const fluxos = [
    ["src/app/tabs.ts", "md"],
    ["src/app/wordDocs.ts", "word"],
    ["src/app/excelDocs.ts", "excel"],
    ["src/app/powerpointDocs.ts", "ppt"],
  ] as [string, string][];
  for (const [arquivo, tipo] of fluxos) {
    checa(`${arquivo}: o documento novo nasce na pasta padrão`, new RegExp(`nascerNoPadrao\\("${tipo}"\\)`).test(ler(arquivo)), "sem isso o documento novo continua rascunho");
  }
  checa("a ponte cria a pasta no disco", /create_folder/.test(ler("src/files.ts")));
  checa("a árvore de projetos lista os quatro tipos", /\.xlsx/.test(ler("src-tauri/src/commands/projects.rs")) && /\.pptx/.test(ler("src-tauri/src/commands/projects.rs")));
}

console.log("\nboas-vindas: o logo é o ícone do app");{
  const preview = ler("src/md/preview.ts");
  const css = ler("src/styles/preview.css");
  checa("o cartão usa a imagem do ícone do app", /class="welcome-logo" src="\/icones\/mdoffice-\$\{icone\}\.png"/.test(preview), "o cartão voltaria ao logo antigo");
  checa("a escolha claro/escuro acompanha o tema e as Configurações", /dataset\.theme === "dark" \? "escuro" : "claro"/.test(preview) && /loadJSON<string>\("mdc\.appicon", tema\)/.test(preview));
  checa("os dois ícones existem em public/icones", existsSync(join(raiz, "public/icones/mdoffice-claro.png")) && existsSync(join(raiz, "public/icones/mdoffice-escuro.png")));
  checa("o quadradinho roxo antigo não pinta mais o logo", !/gradient\(135deg, #4f46e5, #7c3aed\)/.test(css), "o gradiente antigo continua no CSS");
  checa("o logo continua com 48 px", /\.welcome-logo\s*\{[^}]*width:\s*48px/.test(css));
}

// 7. Ícones de tipo (abas, listas, menus): o estilo adotado é o CONTORNO na cor do formato.
console.log("\nícones de tipo em contorno (o estilo adotado)");
{
  const fi = ler("src/fileIcons.ts");
  const fiCss = ler("src/styles/fileicons.css");
  checa(
    "a folha é contorno (interior vazio, traço na cor do tipo)",
    /\.fi-sheet,\s*\.fi-mark\s*\{[^}]*fill:\s*none[^}]*stroke:\s*var\(--fi\)/s.test(fiCss),
    "a folha voltou a ser preenchida"
  );
  checa(
    "a paleta é a do conjunto adotado (md roxo, word azul, excel verde, ppt laranja)",
    /--fi-md:\s*#7c3aed/.test(fiCss) && /--fi-word:\s*#2b6ce4/.test(fiCss) && /--fi-excel:\s*#16a34a/.test(fiCss) && /--fi-ppt:\s*#ea580c/.test(fiCss)
  );
  checa(
    "cada tipo tem a sua marca (md com #, word com linhas, excel com grade, ppt com barras)",
    /md: `<path class="fi-mark" d="M10\.8 10\.1/.test(fi) &&
      /word: `<path class="fi-mark" d="M7\.4 10\.2h9\.2/.test(fi) &&
      /fi-thin" d="M11\.5 12\.3v5\.1/.test(fi) &&
      /fi-bar" d="M9\.9 14\.2v-1\.6/.test(fi)
  );
  checa("o desenho antigo (folha preenchida) saiu", !/fi-tile|fi-solid/.test(fi) && !/\.fi-tile|\.fi-solid/.test(fiCss));
}

// ---------------------------------------------------------------- PowerPoint: galeria de layouts

console.log("\nPowerPoint: galeria de layouts (Nova lâmina / Layout)");

const miniLayout = ler("src/powerpoint/ui/layoutPreview.ts");
checa("a galeria desenha os 6 layouts da ordem oficial", /ORDEM_LAYOUTS\.map/.test(miniLayout));
checa("a miniatura sai dos MESMOS espaços do layout", /caixasDoLayout\(/.test(miniLayout));
checa("a miniatura acompanha a proporção do deck", /stageRatio\(setup\)/.test(miniLayout));

const fitaPpt = ler("src/powerpoint/ui/fita.ts");
checa(
  "Nova lâmina abre a galeria (não a lista de texto)",
  /case "slide-novo"[\s\S]{0,400}galeriaDeLayouts\(est\.setup\)/.test(fitaPpt),
  "o menu ainda é a lista de texto"
);
checa(
  "Layout abre a mesma galeria com o atual destacado",
  /case "layout"[\s\S]{0,400}galeriaDeLayouts\(est\.setup, est\.layout\)/.test(fitaPpt),
  "o menu de Layout não destaca o atual"
);
checa(
  "a lâmina nova entra no FIM (e não depois da atual)",
  /lista\.push\(nova\)/.test(ppt) &&
    /this\.indice = lista\.length - 1/.test(ppt) &&
    !/lista\.splice\(this\.indice \+ 1, 0, nova\)/.test(ppt),
  "a lâmina voltaria a entrar no meio (depois da atual)"
);
checa(
  "as dicas dizem que a lâmina nova vai para o fim",
  /Nova lâmina no fim/.test(fitaPpt) && /Nova lâmina no fim/.test(ppt) && !/depois da atual/.test(fitaPpt + ppt)
);

const cssPpt = ler("src/styles/powerpoint-edicao.css");
checa("css: a grade da galeria existe", /\.pp-lays\s*\{[^}]*grid-template-columns/s.test(cssPpt));
checa("css: o item da galeria existe", /\.pp-lay\s*\{/.test(cssPpt));
checa("css: o layout atual fica destacado", /\.pp-lay\.on\s*\{/.test(cssPpt));

// ---------------------------------------------------------------- fonte e tamanho livres

console.log("\nfonte e tamanho livres nas fitas");

checa("o seletor tem o modo editável (campo + setinha)", /data-editavel/.test(sel) && /\.sel-campo/.test(sel), "modo editável ausente em src/seletor.ts");
checa("o valor digitado vira opção do select", /select\.append\(op\)/.test(sel), "o valor digitado não entra como opção");
checa("número aceita vírgula e respeita min/max", /data-min/.test(sel) && /includes\(","\)/.test(sel), "normalização de número ausente");
checa("a escolha na lista não é aplicada duas vezes", /if \(mudou\) \{\s*select\.value = op\.value/.test(sel), "ordem do face.focus() no item da lista");
checa("o campo do modo editável tem estilo próprio", /\.sel-editavel > \.sel-campo\s*\{/.test(ler("src/styles/base.css")), "regra .sel-editavel > .sel-campo ausente");

const fitaPptLivre = ler("src/powerpoint/ui/fita.ts");
checa("fita do PowerPoint: fonte e tamanho editáveis", /data-sel="font" data-editavel/.test(fitaPptLivre) && /data-sel="size" data-editavel data-num/.test(fitaPptLivre), "data-editavel ausente nos seletores");
const fitaWordLivre = ler("src/word/ribbon.ts");
checa("fita do Word: fonte e tamanho editáveis", /data-sel="font" data-editavel/.test(fitaWordLivre) && /data-sel="size" data-editavel data-num/.test(fitaWordLivre), "data-editavel ausente nos seletores");
checa("o Word acrescenta o valor que a lista não tem", /valor que a lista não conhece/.test(fitaWordLivre), "sel() não cria opção para o valor do documento");

const listaFontes = ler("src/fontes.ts");
checa(
  "a lista de fontes do app é compartilhada (PowerPoint e Word)",
  /export const FONTES_COMUNS/.test(listaFontes) && /FONTES_COMUNS/.test(ler("src/powerpoint/ui/estado.ts")) && /FONTES_COMUNS/.test(ler("src/word/schema.ts")),
  "FONTES_COMUNS não é a fonte única"
);
checa("o diálogo do PowerPoint usa a lista do app", /FONTES_COMUNS\.map/.test(ler("src/app/powerpointDocs.ts")), "lista fixa voltou ao diálogo");

// ---------------------------------------------------------------- tela de carregamento

console.log("\ntela de carregamento");

const indexHtml = ler("index.html");
checa(
  "a página já nasce travada (sem rolagem antes do CSS do app)",
  /html,\s*body\s*\{[^}]*overflow:\s*hidden/s.test(indexHtml),
  "sem isto dá para rolar por baixo da tela de carregamento"
);
checa(
  "a trava usa os MESMOS valores do app (position fixed + inset 0)",
  /html,\s*body\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/s.test(indexHtml),
  "os valores precisam bater com o base.css"
);

// ---------------------------------------------------------------- roda do mouse troca de lâmina

console.log("\nroda do mouse: sobe/desce lâmina");

const rodaLaminas = ler("src/powerpoint/roda-laminas.ts");
checa("a decisão da roda é separada e testável", /export function criarRodaDeLaminas/.test(rodaLaminas));
checa("a roda ignora Ctrl (o zoom continua sendo dele)", /if \(e\.ctrlKey \|\| e\.metaKey\) return;/.test(rodaLaminas));
checa("a inércia do gesto não passa várias lâminas", /ESPERA_DA_TROCA/.test(rodaLaminas) && /t - ultimaTroca < ESPERA_DA_TROCA/.test(rodaLaminas));
checa("a roda lateral não troca de lâmina", /Math\.abs\(e\.deltaX\) > Math\.abs\(e\.deltaY\)/.test(rodaLaminas));
checa("com a lâmina ampliada a roda rola o quadro primeiro", /temRolagem &&/.test(rodaLaminas) && /scrollTop \+ canvas\.clientHeight < canvas\.scrollHeight/.test(rodaLaminas));
checa("o editor liga a roda do palco à troca de lâmina", /ligarRodaDeLaminas\(this\.canvas, \(direcao\) => this\.irPara\(this\.indice \+ direcao\)\)/.test(ppt));

// ---------------------------------------------------------------- apresentação (F5) redesenhada

console.log("\nPowerPoint: modo apresentação (F5)");

const apresen = ler("src/powerpoint/presenter.ts");
const cssSlides = ler("src/styles/slides.css");
checa("a lâmina é full-bleed (a camada não tem recuo)", /\.slides-camada \{[^}]*padding: 0/s.test(cssSlides), "a lâmina não cobre a tela");
checa("o HUD tem progresso e as ferramentas novas", /data-prog/.test(apresen) && /data-tool="grade"/.test(apresen) && /data-tool="tempo"/.test(apresen));
checa("a barra se esconde sozinha e o cursor vai junto", /classList\.add\("ocioso"\)/.test(apresen) && /\.slides-overlay\.ocioso \{[^}]*cursor: none/s.test(cssSlides));
checa("a grade desenha o conteúdo real de cada lâmina", /slides-cel-conteudo/.test(apresen) && /conteudoDa\(deck\.slides\[idx\], pos\)/.test(apresen));
checa("teclas novas: G grade, T tempo, ? ajuda e L laser", /tecla === "g"/.test(apresen) && /tecla === "t"/.test(apresen) && /tecla === "\?"/.test(apresen) && /ligarLaser\(true\)/.test(apresen));
checa("Esc fecha a grade/ajuda antes de sair", /gradeAberta\) fecharGrade\(\)/.test(apresen) && /!ajuda\.hidden\) alternarAjuda\(\)/.test(apresen));
checa("o tempo conta desde a abertura da apresentação", /inicioEm = Date\.now\(\)/.test(apresen) && /setInterval\(atualizarRelogio, 1000\)/.test(apresen));
checa("a lâmina sem fundo próprio usa o fundo do tema", /THEME_COLORS\[setup\.theme\]/.test(apresen));

// zoom e tinta (caneta/marca-texto) da apresentação
checa(
  "o zoom é da lâmina, com origem no ponto (o mouse manda)",
  /sec\.style\.transform = `scale\(\$\{zoomK\}\)`/.test(apresen) && /transformOrigin = `\$\{zoomX\}% \$\{zoomY\}%`/.test(apresen)
);
checa(
  "teclas: +/− dão zoom, Z volta a 100%, Ctrl+roda dá zoom no ponto",
  /e\.key === "\+" \|\| e\.key === "="/.test(apresen) && /tecla === "z"/.test(apresen) && /if \(e\.ctrlKey \|\| e\.metaKey\) \{[\s\S]{0,120}mudarZoom/.test(apresen)
);
checa(
  "com zoom, arrastar move a tela (e o arrasto não vira 'avança')",
  /pan = \{ x: e\.clientX/.test(apresen) && /engolirClique = pan\.moveu/.test(apresen) && /if \(engolirClique\)/.test(apresen)
);
checa(
  "caneta (P), marca-texto (H) e borracha (E) desenham por cima da lâmina",
  /tecla === "p"/.test(apresen) &&
    /tecla === "h"/.test(apresen) &&
    /tecla === "e"/.test(apresen) &&
    /ESTILO_TINTA/.test(apresen) &&
    /canvas\.slides-tinta/.test(apresen)
);
checa("Shift+E limpa a marcação da lâmina", /if \(e\.shiftKey\) \{\s*\n\s*tintas\.delete\(ordem\[atual\]\)/.test(apresen));
checa(
  "o canvas da tinta fica na lâmina (sobrevive ao zoom) e só recebe o ponteiro com ferramenta",
  /\.slides-tinta \{[^}]*pointer-events: none/s.test(cssSlides) && /\.slides-overlay\.com-tinta \.slides-tinta \{[^}]*pointer-events: auto/s.test(cssSlides)
);
checa("o chip do zoom mostra a % e volta a 100% no clique", /data-tool="zoom"/.test(apresen) && /botao\('\[data-tool="zoom"\]', \(\) => mudarZoom\(1, 50, 50\)\)/.test(apresen));
checa("Esc sai da ferramenta e do zoom antes de encerrar", /ferramenta\) definirFerramenta\(null\)/.test(apresen) && /zoomK > 1\.001\) mudarZoom\(1, 50, 50\)/.test(apresen));

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);