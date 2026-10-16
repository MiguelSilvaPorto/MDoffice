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
// Os botões grandes da fita baixa ficam AGRUPADOS: com o padding de --pe-6 e o vão de --pe-4
// sobrava ~10 px de ar entre um e outro (o "muito espalhado" do grupo Canetas). Aqui a fita baixa
// é a fita de trabalho — o par de valores (--pe-3/--pe-2) é o que mantém os itens juntos.
checa(
  "os botões grandes da fita baixa ficam agrupados (sem o ar de ~10 px)",
  /fita-compacta button\.ppr\.big\s*\{[^}]*padding:\s*0 var\(--pe-3\)/.test(pp) &&
    /fita-compacta \.ppr-corpo\s*\{[^}]*gap:\s*var\(--pe-2\)/.test(pp),
  "botões espalhados no grupo Canetas (padding/vão da fita compacta)"
);
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
  /\.dropdown\.sel-menu\s*\{[^}]*max-height:\s*min\(42vh,\s*240px\)[^}]*overflow-y:\s*auto/s.test(ler("src/styles/editor.css")),
  "a lista do tamanho da fonte abre na altura natural e cobre a janela"
);
checa(
  "a lista abre já no item marcado",
  /const marcado = st\.menu\.querySelector\("\.dd-check"\)\?\.closest<HTMLElement>\("\.dd-item"\);/.test(sel) && /st\.menu\.scrollTop \+=/.test(sel)
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

// Botão direito na prancheta de letras: arrastar move a TELA (panorama); o clique parado continua
// apagando — o menu de contexto pergunta (`consumirPanorama`) e o arrasto é consumido antes.
checa(
  "letras: botão direito + arrastar move a tela (panorama)",
  /if \(e\.button === 2\) \{[\s\S]{0,300}this\.pano = \{/.test(quadroLetras) &&
    /this\.host\.scrollLeft = this\.pano\.esquerda - dx/.test(quadroLetras) &&
    /this\.host\.scrollTop = this\.pano\.topo - dy/.test(quadroLetras),
  "o botão direito não inicia o panorama"
);
checa(
  "letras: o clique parado continua apagando",
  /if \(this\.consumirPanorama\(\)\) return;[\s\S]{0,200}this\.eraseRunAt\(cell\)/.test(quadroLetras),
  "o arrasto apagaria a linha/rótulo ao soltar"
);
checa(
  "letras: a dica do rodapé explica o botão direito (clique apaga, arrasto move)",
  /botão direito: clique apaga linha\/rótulo, arraste move a tela/.test(ler("src/md/textdraw/editor.ts")),
  "a interface diria o comportamento antigo"
);
checa(
  "css: o cursor agarra durante o panorama",
  /\.text-draw \.draw-canvas-wrap\.txt-pano[^{]*\{[^}]*cursor:\s*grabbing/s.test(ler("src/styles/textdraw.css")),
  "sem o cursor, o arrasto parece que não pegou"
);

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

// ---------------------------------------------------------------- PowerPoint: alças por forma na múltipla seleção

console.log("\nPowerPoint: cada forma da múltipla seleção tem as próprias 4 alças");

const cssPptSel = ler("src/styles/powerpoint-edicao.css");
checa(
  "a múltipla seleção dá alças a cada forma, com o dono marcado",
  /for \(const s of sel\) caixa\(s\.box, s\.rot, "item", !s\.bloqueada, "", s\.bloqueada \? undefined : s\.id\);/.test(palcoPpt),
  "sem o dono, cada forma da seleção volta a ficar sem as suas alças (só o quadro do grupo)"
);
checa(
  "as alças do dono são só as 4 de canto (o quadro do grupo continua com as 8)",
  /const pontos = dono \? \["nw", "ne", "se", "sw"\] : \["nw", "n", "ne", "e", "se", "s", "sw", "w"\];/.test(palcoPpt) &&
    /const data = dono \? ` data-dono="\$\{dono\}"` : "";/.test(palcoPpt),
  "as alças por forma virariam 8, iguais às do grupo (ou perderiam o dono)"
);
checa(
  "arrastar a alça de uma forma redimensiona só ela",
  /const dono = alca\?\.dataset\.dono;/.test(palcoPpt) &&
    /const sel = ctx\.shapes\.filter\(\(s\) => \(dono \? s\.id === dono : ctx\.selecao\.includes\(s\.id\)\) && !s\.bloqueada\);/.test(palcoPpt),
  "o dono seria ignorado e o arrasto mexeria na seleção inteira"
);
checa(
  "quem manda no canto repetido é a alça da forma (o quadro do grupo fica atrás)",
  /\.pp-sel\.item\s*\{[^}]*z-index:\s*51/.test(cssPptSel),
  "as alças da forma ficariam escondidas embaixo das do grupo"
);
checa(
  "as alças da forma são menores que as do grupo",
  /\.pp-sel\.item \.pp-alca\s*\{[^}]*width:\s*7px[^}]*height:\s*7px/.test(cssPptSel),
  "do mesmo tamanho, não se distingue o que redimensiona uma forma do que redimensiona todas"
);
checa(
  "a rotação continua sendo uma só, do conjunto",
  /const gira = alcas && !dono \?/.test(palcoPpt),
  "cada forma ganharia haste de girar e a tela ficaria poluída"
);
// "Selecionar tudo neste ponto": com as formas empilhadas, o clique só pega a de cima; o item do
// menu de contexto pega a pilha inteira (e cada forma vem com o grupo dela).
const hostPptSel = ler("src/powerpoint/powerpoint.ts");
checa(
  "o palco expõe a pilha de um ponto (o mesmo critério do clique, sem as decorações fixas)",
  /formasNoPonto\(clientX: number, clientY: number\): string\[\]/.test(palcoPpt) &&
    /document\s*\.elementsFromPoint\(clientX, clientY\)/.test(palcoPpt) &&
    /!s\.fixa \|\| ctx\.fixasSelecionaveis/.test(palcoPpt),
  "o menu ficaria sem a pilha (ou pegaria as decorações do layout sem o modo próprio)"
);
checa(
  "o menu da forma tem 'Selecionar tudo neste ponto' e ele seleciona a pilha com os grupos",
  /\["sel-ponto",/.test(hostPptSel) &&
    /Selecionar tudo neste ponto/.test(hostPptSel) &&
    /pilha\.length > 1/.test(hostPptSel) &&
    /const pilha = comGrupos\(this\.atual\(\), this\.stage\.formasNoPonto\(e\.clientX, e\.clientY\)\)/.test(hostPptSel) &&
    /c === "sel-ponto"\) this\.selecionar\(pilha\)/.test(hostPptSel),
  "o item não chegaria ao comando (ou não traria o grupo de cada forma da pilha)"
);

// ---------------------------------------------------------------- PowerPoint: a barrinha do pincel por cima

console.log("\nPowerPoint: a barrinha do pincel fica por cima da faixa e do palco");

checa(
  "a barrinha do pincel tem z-index (sem ele, miniaturas e lâmina pintam por cima)",
  /\.pp-pincel\s*\{[^}]*z-index:\s*60/.test(cssPptSel),
  "a barrinha voltaria a ficar atrás das miniaturas — só o '8' aparecendo por trás"
);
checa(
  "a barrinha fica abaixo do Estúdio (61) e dos popups (300)",
  /\.pp-estudio\s*\{[^}]*z-index:\s*61/.test(cssPptSel) && /\.pp-popup\s*\{[^}]*z-index:\s*300/.test(cssPptSel),
  "a barrinha taparia o Estúdio ou um popup aberto"
);

// ---------------------------------------------------------------- PowerPoint: o arrasto vivo

console.log("\nPowerPoint: o arrasto vivo mexe só no que mudou (sem refazer a lâmina)");

const pptTs = ler("src/powerpoint/powerpoint.ts");
const painelTs = ler("src/powerpoint/ui/painel.ts");
const corpoArrasto = pptTs.slice(pptTs.indexOf("private pintarArrasto("), pptTs.indexOf("private duplicarParaArrastar("));
checa(
  "o quadro do arrasto (meio) vai pelo caminho vivo, não pelo redesenho da lâmina",
  /if \(fase === "meio"\) this\.pintarArrasto\(patches, antes\);/.test(pptTs) &&
    corpoArrasto.length > 200 &&
    !/pintarSlide\(/.test(corpoArrasto),
  "o arrasto voltaria a refazer o innerHTML da lâmina a cada movimento (medido: ~14 ms por quadro)"
);
checa(
  "mover/girar vão no estilo do elemento e o resto refaz só aquela forma",
  /el\.style\.left = `\$\{pct\(p\.box\.x\)\}%`/.test(corpoArrasto) &&
    /novo\.innerHTML = htmlFormaRica\(s, ctx\);/.test(corpoArrasto) &&
    /el\.replaceWith\(elNovo\)/.test(corpoArrasto),
  "mover pelo estilo é o gesto barato; o tamanho refaz só a forma arrastada"
);
checa(
  "o que é derivado (ligação/capa/Estúdio) cai no caminho completo",
  /if \(this\.estudio \|\| slide\.shapes\.some\(\(s\) => s\.liga \|\| s\.capa\)\) return this\.pintarRapido\(\);/.test(corpoArrasto),
  "a ligação/capa/máscara ficariam paradas enquanto a forma anda"
);
checa(
  "no arrasto o painel só troca os números (sem refazer o painel)",
  /vivo\(\): void \{/.test(painelTs) && /\["pos-w", ptParaCm/.test(painelTs) && /\["rot", f\.rot\]/.test(painelTs),
  "o painel inteiro (innerHTML + selects) a cada quadro era o que fazia o arrasto pesar"
);

// ---------------------------------------------------------------- PowerPoint: texto x mover

console.log("\nPowerPoint: o texto da forma escolhida é do texto (e o mover fica na beirada)");
{
  const textoCss = ler("src/styles/powerpoint.css");
  checa(
    "clicar no texto de uma forma escolhida entra na edição (o arrasto seleciona)",
    /if \(!e\.shiftKey && !e\.ctrlKey && !e\.metaKey && this\.gestoDoTexto\(forma, ctx, e\) && alvo\.closest\("\.pp-shape-text"\)\) \{\s*this\.hooks\.aoEditarTexto\(forma\.id, \{ x: e\.clientX, y: e\.clientY \}\);\s*return;\s*\}/.test(palcoPpt) &&
      /private gestoDoTexto\(forma: Shape, ctx: ContextoPalco, e: \{ clientX: number; clientY: number \}\): boolean/.test(palcoPpt),
    "sem isso o arrasto por cima do texto volta a mover a forma (o relato)"
  );
  checa(
    "o vazio ao lado/embaixo do texto não larga a escolha (o texto pode passar do quadro)",
    /const um = ctx\.selecao\.length === 1 \? ctx\.shapes\.find\(\(s\) => s\.id === ctx\.selecao\[0\]\) : undefined;\s*if \(um && this\.gestoDoTexto\(um, ctx, e\) && this\.noTextoPintado\(um\.id, e\)\)/.test(palcoPpt) &&
      /private noTextoPintado\(id: string, e: \{ clientX: number; clientY: number \}\): boolean/.test(palcoPpt),
    "com o texto transbordando o quadro, o clique no vazio deselecionaria a caixa (o relato)"
  );
  checa(
    "a regra é a do gesto: nada de preventDefault (o navegador segue com a seleção)",
    !/aoEditarTexto\(forma\.id, \{ x: e\.clientX, y: e\.clientY \}\);\s*e\.preventDefault/.test(palcoPpt),
    "com preventDefault a seleção nativa do texto não começaria"
  );
  checa(
    "o mover fica na beirada da forma (a faixa de BANDA_BEIRADA_PX)",
    /pertoDaBorda\(paraPt\(forma\.box, ctx\.dim\), this\.pontoEmPt\(e, ctx\.dim\), this\.pxEmPt\(ctx\.dim, BANDA_BEIRADA_PX\)\)/.test(palcoPpt) &&
      /const BANDA_BEIRADA_PX = 6;/.test(palcoPpt) &&
      /export function pertoDaBorda\(/.test(ler("src/powerpoint/edicao/geometria.ts"))
  );
  checa(
    "o caret vai onde o ponteiro clicou (e sem ponto, para o fim, como antes)",
    /aoEditarTexto: \(id, ponto\) => this\.entrarEdicao\(id, undefined, ponto\)/.test(ppt) &&
      /document\.caretPositionFromPoint\(ponto\.x, ponto\.y\)/.test(ppt) &&
      /faixa\.selectNodeContents\(rt\);\s*faixa\.collapse\(false\);/.test(ppt),
    "o caret cairia sempre no fim do texto"
  );
  checa(
    "duplo clique dentro da edição não redesenha (a palavra escolhida fica)",
    /if \(ctx\.editando === id\) return;/.test(palcoPpt),
    "o redesenho apagaria a seleção que o navegador acabou de fazer"
  );
  checa(
    "o cursor diz quem manda em cada estado",
    /\.pp-shape-text\.pp-rt \{[\s\S]*?cursor: move;/.test(textoCss) &&
      /\.pp-slide\.pp-texto-um \.pp-shape\.selected \.pp-shape-text\.pp-rt \{\s*cursor: text;\s*\}/.test(textoCss) &&
      /classList\.toggle\("pp-texto-um", sel\.length === 1 && temTexto\(sel\[0\]\.paras\) && !sel\[0\]\.bloqueada\);/.test(palcoPpt),
    "sem escolha (ou com várias) pegar a forma é mover; com uma e com texto, o texto é do texto"
  );
}

// ---------------------------------------------------------------- fita métrica (medida do arrasto)

console.log("\nPowerPoint: a fita métrica mostra a medida enquanto arrasta");
{
  const medida = ler("src/powerpoint/edicao/medida.ts");
  const cssMedida = ler("src/styles/powerpoint-edicao.css");
  checa(
    "a medida é pura, em cm, com a vírgula do painel — um texto por linha",
    /export function textoX\(box: ShapeBox, d: Dim\): string/.test(medida) &&
      /export function textoY\(box: ShapeBox, d: Dim\): string/.test(medida) &&
      /export function textoLargura\(box: ShapeBox, d: Dim\): string/.test(medida) &&
      /export function textoAltura\(box: ShapeBox, d: Dim\): string/.test(medida) &&
      /toLocaleString\("pt-BR", \{ maximumFractionDigits: 1 \}\)/.test(medida) &&
      / cm`;/.test(medida),
    "sem módulo puro o teste do Node não alcança a conta; sem o cm o número não bate com o painel"
  );
  checa(
    "a medida aparece nos três gestos (mover, redimensionar e desenhar)",
    /const gesto = this\.modo\?\.t;/.test(palcoPpt) &&
      /if \(gesto === "mover" \|\| gesto === "redim" \|\| gesto === "criar"\)/.test(palcoPpt) &&
      /gesto === "criar" \? this\.rect : sel\.length === 1 \? sel\[0\]\.box : sel\.length > 1 \? envolventeDe\(sel, ctx\.dim\) : null/.test(palcoPpt),
    "com várias formas escolhidas a medida é a da moldura do grupo (não uma forma só)"
  );
  checa(
    "mover mostra o x na linha em pé e o y na deitada; redimensionar/desenhar, a largura na de baixo e a altura na da direita",
    /textoX\(alvo, ctx\.dim\)/.test(palcoPpt) &&
      /textoY\(alvo, ctx\.dim\)/.test(palcoPpt) &&
      /textoLargura\(alvo, ctx\.dim\)/.test(palcoPpt) &&
      /textoAltura\(alvo, ctx\.dim\)/.test(palcoPpt)
  );
  checa(
    "as linhas do gesto são desenhadas (o rótulo mora nelas)",
    /class="pp-guia v" style="left:\$\{r2\(alvo\.x\)\}%"/.test(palcoPpt) &&
      /class="pp-guia h" style="top:\$\{r2\(alvo\.y\)\}%"/.test(palcoPpt) &&
      /class="pp-guia v" style="left:\$\{r2\(xDir\)\}%"/.test(palcoPpt) &&
      /class="pp-guia h" style="top:\$\{r2\(yBaixo\)\}%"/.test(palcoPpt),
    "sem a linha o rótulo voltaria a flutuar acima da forma"
  );
  checa(
    "o rótulo vira para o outro lado perto das bordas da lâmina (acima/abaixo, esquerda/direita)",
    /alvo\.y < 8 \? "abaixo" : "acima"/.test(palcoPpt) &&
      /alvo\.x < 12 \? "direita" : "esquerda"/.test(palcoPpt) &&
      /yBaixo > 92 \? "acima" : "abaixo"/.test(palcoPpt) &&
      /xDir > 88 \? "esquerda" : "direita"/.test(palcoPpt) &&
      /\.pp-medida\.acima\s*\{[^}]*translate\(-50%, -100%\)/s.test(cssMedida) &&
      /\.pp-medida\.abaixo\s*\{[^}]*translate\(-50%, 0\)/s.test(cssMedida) &&
      /\.pp-medida\.esquerda\s*\{[^}]*translate\(-100%, -50%\)/s.test(cssMedida) &&
      /\.pp-medida\.direita\s*\{[^}]*translate\(0, -50%\)/s.test(cssMedida),
    "sem a virada o rótulo sairia da lâmina em quem está na borda"
  );
  checa(
    "o rótulo não rouba o arrasto nem some no tema escuro",
    /\.pp-medida\s*\{[^}]*pointer-events:\s*none/s.test(cssMedida) &&
      /\.pp-medida\s*\{[^}]*background:\s*var\(--panel\)/s.test(cssMedida) &&
      /\.pp-medida\s*\{[^}]*color:\s*var\(--fg\)/s.test(cssMedida),
    "com pointer-events o rótulo bloquearia o gesto; com cor fixa ficaria ilegível no escuro"
  );
  checa(
    "todo elemento do overlay entra na limpeza (senão empilha a cada quadro)",
    (() => {
      const i = palcoPpt.indexOf("desenharSelecao(): void {");
      const f = palcoPpt.indexOf("\n  private ", i);
      const trecho = i >= 0 && f > i ? palcoPpt.slice(i, f) : "";
      const limpeza = /const SELETOR_DO_OVERLAY = "([^"]+)"/.exec(palcoPpt)?.[1] ?? "";
      // Fora da conta: as que vivem DENTRO de outra (somem com o pai), a que divide a tag de uma que
      // já está na lista e a `pp-texto-um` (classe do próprio div da lâmina, não um elemento).
      const fora = new Set([
        "pp-alca",
        "pp-gira",
        "pp-gira-haste",
        "pp-canto",
        "pp-canto-dica",
        "pp-canto-nome",
        "pp-canto-hud",
        "pp-mover",
        "pp-curva-preview",
        "pp-texto-um",
      ]);
      const achadas = [...new Set([...trecho.matchAll(/pp-[a-z-]+/g)].map((m) => m[0]))].filter((c) => !fora.has(c));
      return trecho.length > 0 && limpeza.length > 0 && achadas.every((c) => limpeza.includes(c));
    })(),
    "um elemento desenhado pelo palco não seria apagado no próximo redesenho — foi assim que o leque da curva (e o balão da medida) apareceram"
  );
}

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
// A tela Início virou grade de cartões com a PRÉVIA do documento: o texto sai do comando
// preview_file (o Rust lê o começo do arquivo; o zip dos formatos do Office abre só o XML).
const homeCss = ler("src/styles/home.css");
const homePageTs = ler("src/homePage.ts");
const filesTs = ler("src/files.ts");
const libRs = ler("src-tauri/src/lib.rs");
checa(
  "Início: os recentes são uma grade de cartões com a versão do documento",
  /\.home-file-grid\s*\{[\s\S]{0,160}display:\s*grid/.test(homeCss) &&
    /class: `home-file-card card-\$\{fmt\}`/.test(homePageTs) &&
    /previaEmHtml\(estruturarPrevia\(p\.tipo, p\.texto\)\)/.test(homePageTs) &&
    /export function estruturarPrevia/.test(ler("src/homePrevia.ts")),
  "a lista por linhas não virou grade de cartões (ou a prévia não é por tipo)"
);
checa(
  "Início: o texto da prévia entra escapado e o markdown passa pelo saneamento",
  /escapeHtml\(e\.titulo\)/.test(homePageTs) && /escapeHtml\(l\)/.test(homePageTs) && /DOMPurify\.sanitize/.test(homePageTs) && /escapeHtml\(item\.name\)/.test(homePageTs) && /<img\\b/.test(homePageTs),
  "o texto do arquivo poderia virar marcação"
);
checa(
  "Início: cada tipo tem a sua forma (página, lâmina, grade) e o papel do tema",
  /\.home-prev-pagina\s*\{/.test(homeCss) &&
    /\.home-prev-lamina\s*\{/.test(homeCss) &&
    /\.home-prev-grade\s*\{/.test(homeCss) &&
    /\[data-theme="dark"\] \.home-file-preview\s*\{[\s\S]{0,220}--hp-papel:\s*#15181e/.test(homeCss) &&
    !/home-file-papel/.test(homeCss + homePageTs),
  "os três desenhos voltariam a ser o mesmo papel branco"
);
checa(
  "Início: a prévia vem do comando preview_file (com a grade da planilha no Rust)",
  /invoke<PreviaDoc>\("preview_file"/.test(filesTs) &&
    /commands::files::preview_file/.test(libRs) &&
    /pub fn preview_file/.test(ler("src-tauri/src/commands/files.rs")) &&
    /fn valores_da_planilha/.test(ler("src-tauri/src/commands/files.rs")) &&
    /fn limpar_grade/.test(ler("src-tauri/src/commands/files.rs")),
  "o comando da prévia não está ligado (ou a planilha perdeu as linhas)"
);
checa(
  "o card da faixa abre a galeria de layouts (e a fita não tem mais o 'Nova lâmina')",
  /abrirGaleriaDeLayouts\(e\.currentTarget as HTMLElement, this\.setup, \(l\) => this\.run\("slide-new", l\)\)/.test(ppt) && !/slide-novo/.test(fitaPpt),
  "o card ficaria sem a galeria (ou o botão da fita voltaria)"
);
checa(
  "Layout abre a mesma galeria com o atual destacado",
  /case "layout":[\s\S]{0,300}abrirGaleriaDeLayouts\(ancora, est\.setup, \(l\) => run\("layout", l\), est\.layout\)/.test(fitaPpt),
  "o menu de Layout não destaca o atual"
);
checa(
  "a galeria é um helper só (fita e card da faixa usam o mesmo)",
  /export function abrirGaleriaDeLayouts\(ancora: HTMLElement, setup: DeckSetup, aoEscolher/.test(ler("src/powerpoint/ui/layoutPreview.ts")),
  "a fita e o card teriam duas implementações do mesmo popup"
);
// O chevron de recolher saiu a pedido e o duplo clique numa aba TAMBÉM saiu (recolhia a faixa
// sem querer ao trocar de aba ou ao abrir e fechar um popup pelo botão): o recolher vive no Ctrl+F1.
// E a faixa não se recolhe sozinha: abrir (clicar numa aba) é um pedido e a escolha fica — o
// "por enquanto" (fechar ao clicar na lâmina, num comando ou depois de um popup) saiu.
const fitaTs = ler("src/fita.ts");
checa(
  "recolher a faixa: só o Ctrl+F1 (nem botão, nem duplo clique)",
  !/fita-recolher/.test(fitaTs) &&
    !/\.fita-recolher/.test(ler("src/styles/fita.css")) &&
    !/addEventListener\("dblclick"/.test(fitaTs) &&
    /combina\("fita", e\)[\s\S]{0,300}fixar\(!recolhida\)/.test(fitaTs),
  "o duplo clique (na aba ou num botão) voltaria a recolher a faixa sem querer"
);
checa(
  "a faixa não se esconde sozinha (o 'por enquanto' saiu)",
  /o\.abas\.addEventListener\("click", \(\) => \{\s*if \(recolhida\) fixar\(false\);/.test(fitaTs) &&
    !/temporaria/.test(fitaTs) &&
    !/t\.closest\("\.fita-resize/.test(fitaTs) &&
    !/addEventListener\("change"/.test(fitaTs) &&
    !/setTimeout/.test(fitaTs),
  "sobrou um caminho que recolhe a faixa sem o usuário mandar"
);
// A aba Design segue os quatro blocos do Office (Temas · Variantes · Personalizar · Designer) e o
// "Tamanho" (16:9/4:3) voltou a ter UI — ele ficou sem lugar quando o Configurar apresentação saiu.
// (O último bloco se chama **Composição** desde a fusão das Ideias com os Arranjos.)
checa(
  "aba Design: Temas, Variantes, Personalizar e Composição",
  /private design\(\)[\s\S]*?grupo\("Temas"[\s\S]*?grupo\("Variantes"[\s\S]*?grupo\(\s*"Personalizar"[\s\S]*?grupo\("Composição"[\s\S]*?private exibir/.test(fitaPpt),
  "os grupos da aba Design mudaram de ordem ou sumiram"
);
checa(
  "aba Design: o Tamanho da lâmina tem botão e menu (16:9/4:3)",
  /grande\("tamanho-lamina"[\s\S]{0,200}true\)/.test(fitaPpt) && /case "tamanho-lamina"[\s\S]{0,700}data-aspecto[\s\S]{0,400}run\("tamanho-lamina", b\.dataset\.aspecto\)/.test(fitaPpt),
  "o menu de Tamanho não chega ao comando"
);
checa(
  "aba Design: a Composição mora só nela (saiu da Página Inicial)",
  (fitaPpt.match(/grupo\("Composição"/g) ?? []).length === 1 && !/grupo\("Composição"/.test(fitaPpt.slice(0, fitaPpt.indexOf("private design(): string {"))),
  "o grupo aparece mais de uma vez (ou fora da aba Design)"
);
// "Nova lâmina" saiu da fita a pedido: quem cria é o card do fim da faixa, com os DOIS alvos —
// a prévia cria com o último layout e o rótulo "+ Nova lâmina" abre a galeria. O botão dividido
// (e o helper) não existem mais.
checa(
  "a fita não tem mais o 'Nova lâmina' (nem o botão dividido)",
  !/grandeDividido/.test(fitaPpt) && !/data-cmd="slide-new"|slide-new/.test(fitaPpt) && !/grupo\("Lâminas"[\s\S]{0,120}i-plus/.test(fitaPpt),
  "o botão dividido (ou o helper morto) voltaria"
);
checa(
  "o título do card diz qual layout o clique vai criar",
  /const rotuloUltimo = ROTULOS_LAYOUT\[this\.ultimoLayout\]/.test(ppt) && /const titulo = `Nova lâmina no fim \(\$\{rotuloUltimo\}\)`/.test(ppt),
  "o tooltip não acompanharia o último layout"
);
checa(
  "o host cria com o último layout escolhido (e nunca mais com \"conteudo\" fixo)",
  /const layout = \(value as SlideLayout\) \|\| this\.ultimoLayout;/.test(ppt) &&
    /private ultimoLayout: SlideLayout = layoutSalvo\(\)/.test(ppt) &&
    !/\(sl\.shapes\.length \? "conteudo" : "conteudo"\)/.test(ppt),
  "o clique direto voltaria ao layout fixo"
);
checa(
  "o último layout nasce Capa e é persistido (e o Layout também o atualiza)",
  /lerTexto\(CHAVE_ULTIMO_LAYOUT, "titulo"\)/.test(ppt) &&
    /ORDEM_LAYOUTS as string\[\]\)\.includes\(v\)/.test(ppt) &&
    /gravarTexto\(CHAVE_ULTIMO_LAYOUT, l\)/.test(ppt) &&
    /case "layout":[\s\S]{0,300}this\.definirUltimoLayout\(novo\)/.test(ppt),
  "a preferência não sobreviveria ao recarregar (ou o Layout não a atualizaria)"
);
checa(
  "o card da faixa: a prévia cria e o rótulo \"+ Nova lâmina\" abre a galeria (o \"+\" do canto saiu)",
  /miniaturaDeLayout\(this\.ultimoLayout, this\.setup\)/.test(ppt) &&
    /pp-thumb-add-corpo/.test(ppt) &&
    /pp-thumb-add-rot/.test(ppt) &&
    !/pp-thumb-add-mais/.test(ppt) &&
    /querySelector<HTMLButtonElement>\("\.pp-thumb-add-corpo"\)!\.addEventListener\("click", \(\) => this\.run\("slide-new"\)\)/.test(ppt) &&
    /querySelector<HTMLButtonElement>\("\.pp-thumb-add-rot"\)!\.addEventListener\("click", \(e\) => \{[\s\S]{0,200}ancoraDoPopup\(\) === e\.currentTarget[\s\S]{0,400}abrirGaleriaDeLayouts\(e\.currentTarget/.test(ppt),
  "o card perderia a prévia, o rótulo deixaria de abrir a galeria (ou o \"+\" voltaria ao canto)"
);
checa(
  "css: a prévia do card tem estilo próprio (e o botão dividido saiu do CSS)",
  /\.pp-thumb-add \.pp-thumb-add-corpo\s*\{[^}]*width:\s*calc\(100% - 14px\)/s.test(ler("src/styles/powerpoint.css")) &&
    !/pp-thumb-add-(previa|mais)/.test(ler("src/styles/powerpoint.css")) &&
    !/ppr-dividido/.test(ler("src/styles/powerpoint-edicao.css")),
  "a prévia ficaria sem estilo (ou o CSS do botão dividido ficaria morto)"
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
  /Nova lâmina no fim/.test(ppt) && !/depois da atual/.test(fitaPpt + ppt)
);

const cssPpt = ler("src/styles/powerpoint-edicao.css");
checa("css: a grade da galeria existe", /\.pp-lays\s*\{[^}]*grid-template-columns/s.test(cssPpt));
checa("css: o item da galeria existe", /\.pp-lay\s*\{/.test(cssPpt));
checa("css: o layout atual fica destacado", /\.pp-lay\.on\s*\{/.test(cssPpt));

// Ideias de design: a lâmina atual desenhada em cada modelo (a ideia do Design Ideas do DeckCraft)
console.log("\nídeias de design (a lâmina atual em cada modelo)");
{
  const mod = ler("src/powerpoint/edicao/modelos.ts");
  checa(
    "o catálogo ganhou os designs do DeckCraft (8 temas + 5 esquemas de cor)",
    /id: "deckcraft"/.test(mod) && /id: "harbor"/.test(mod) && /id: "slate"/.test(mod) && /id: "grayscale"/.test(mod) && /id: "berry"/.test(mod)
  );
  checa(
    "cada design traz as próprias cores (fundo, texto, acento e secundária) e a fonte",
    /id: "harbor"[^}]*cores: \{ fg: "FFFFFF", accent: "1B7FA6", muted: "36B3A8" \}/.test(mod) && /id: "slate"[^}]*fonte: "Roboto"/.test(mod)
  );
  checa(
    "o painel tem a aba e o corpo da Composição",
    /data-lateral="composicao">Composição</.test(ppt) && /data-composicao-corpo/.test(ppt) && /data-composicao>/.test(ppt)
  );
  checa(
    "cada cartão desenha A LÂMINA ATUAL com o design e o acabamento aplicados (não um desenho à parte)",
    /aplicarModeloALamina\(atual, de, m, t, ratio\)/.test(ppt) && /htmlFormaRica\(f, ctx\)/.test(ppt) && /pp-ideia-slide/.test(ppt)
  );
  checa(
    "a prévia é a lâmina de verdade reduzida por transform (com a largura do painel)",
    /previa\.style\.transform = `scale\(\$\{w \/ largura\}\)`/.test(ppt) && /largura = 960/.test(ppt)
  );
  checa(
    "clicar aplica o design com o acabamento do cartão (comando ideia com id|tratamento)",
    /this\.run\("ideia", `\$\{m\.id\}\|\$\{t\}`\)/.test(ppt) && /case "ideia":[\s\S]{0,560}this\.aplicarVisualDaComposicao\(m, t as TratamentoIdeia\)/.test(ppt)
  );
  checa(
    "o botão Gerar mais avança o lote (fornadas de combinações novas)",
    /data-composicao-mais/.test(ppt) && /this\.loteComposicao\+\+/.test(ppt) && /this\.loteComposicao \* (doCatalogo|criadasPorLote)/.test(ppt)
  );
  checa(
    "cada fornada mistura design e acabamento (recolorir, cantos arredondados, contorno)",
    /tratamentos: TratamentoIdeia\[\] = \[\.\.\.ACABAMENTOS\]/.test(ppt) && /ROTULO_TRATAMENTO\[t\]/.test(ppt)
  );
  checa(
    "o tratamento alcança as cores próprias das formas (o verde do organograma vira o acento)",
    /papelDaCor\(c, tb\)/.test(mod) && /contrasteCom\(papelDoTexto\(c, tb\), sobre, tb\)/.test(mod) && /tratamento === "cantos"/.test(mod) && /tratamento === "contorno"/.test(mod) && /geom = "roundRect"/.test(mod)
  );
  checa(
    "o painel acompanha a lâmina atual (redesenha junto com o palco)",
    /if \(this\.lateral === "composicao"\) this\.pintarComposicao\(\)/.test(ppt)
  );
  checa("css: a moldura recorta a prévia e a lâmina entra em tamanho cheio", /\.pp-ideia-moldura\s*\{[^}]*overflow:\s*hidden/s.test(cssPpt) && /\.pp-ideia-slide\s*\{[^}]*transform-origin:\s*0 0/s.test(cssPpt));
  // o botão vive na Página Inicial (o atalho do dia a dia); a aba Design não o repete
  const inicioFita = fitaPpt.slice(fitaPpt.indexOf("private inicio(): string {"), fitaPpt.indexOf("private inserir(): string {"));
  const designFita = fitaPpt.slice(fitaPpt.indexOf("private design(): string {"), fitaPpt.indexOf("private exibir(): string {"));
  checa(
    "o botão da fita abre o painel na Composição (aba Design ▸ grupo Composição)",
    /grupo\("Composição", `\$\{grande\("composicao", ic\("i-spark"\)/.test(designFita) &&
      !/grupo\("Composição"/.test(inicioFita) &&
      /case "composicao":[\s\S]{0,200}mostrarLateral\("composicao"\)/.test(ppt),
    "o botão da fita ficaria sem efeito (ou o painel não trocaria de aba)"
  );
  checa(
    "o grupo Designer e as duas abas separadas saíram da interface",
    !/grupo\("Designer"/.test(fitaPpt) && !/data-lateral="(ideias|arranjos)"/.test(ppt) && !/data-ideias>|data-arranjos>/.test(ppt),
    "a interface ainda mostraria os dois sistemas (ou o nome da Microsoft)"
  );
  const geradorMod = ler("src/powerpoint/edicao/gerador.ts");
  checa(
    "o gerador de designs existe (paleta harmônica, esquema, nome e fonte)",
    /export function gerarDesign/.test(geradorMod) && /export function esquemaDe/.test(geradorMod) && /export function nomeDoDesign/.test(geradorMod) && /function hsl\(/.test(geradorMod)
  );
  checa(
    "a fornada das Ideias mistura designs criados na hora (o cartão diz Novo)",
    /gerarDesign\(semente\)/.test(ppt) && /na hora\b/.test(ppt) && /Novo · \$\{rotulo\}/.test(ppt)
  );
  checa(
    "clicar num design criado na hora aplica o mesmo design (a semente volta do id)",
    /id\.startsWith\("gerado-"\) \? gerarDesign\(Number\(id\.slice\("gerado-"\.length\)\)\)/.test(ppt)
  );
}

// Arranjos: reorganizar a lâmina em fórmulas padrão (grade, lista, destaque, faixa)
console.log("\narranjos (a lâmina reorganizada em fórmulas padrão)");
{
  const mod = ler("src/powerpoint/edicao/arranjos.ts");
  checa(
    "o motor de arranjo existe com as quatro fórmulas",
    /export type Arranjo = "grade" \| "lista" \| "destaque" \| "faixa"/.test(mod) && /id: "grade"/.test(mod) && /id: "faixa"/.test(mod) && /export function aplicarArranjo/.test(mod)
  );
  checa(
    "a unidade é o cartão com o que está dentro dele (contenção, não agrupamento)",
    /export function unidadesDa/.test(mod) && /dentro\(c, s\)/.test(mod) && /caixaDe\(/.test(mod)
  );
  checa(
    "os cartões ficam do mesmo tamanho e o conteúdo escala junto (texto com mínimo de 8pt)",
    /const cartao = \{/.test(mod) && /escalaDoTexto\(s, escala\.get\(s\.id\) \?\? 1\)/.test(mod) && /Math\.max\(8,/.test(mod)
  );
  checa(
    "as formas fixas do modelo não se movem e as linhas de ligação saem",
    /!s\.liga && !ehLinhaSolta/.test(mod) && /function ehLinhaSolta/.test(mod) && /s\.fixa/.test(mod)
  );
  checa(
    "a arrumação é um modo da Composição (o filtro chega no pintor dos Arranjos)",
    /this\.filtroComposicao === "arrumacao"\) return this\.pintarArranjos\(host\)/.test(ppt)
  );
  checa(
    "o cartão mostra a lâmina de verdade reorganizada (a mesma prévia das Ideias)",
    /aplicarArranjo\(atual, id, variante, ratio\)/.test(ppt) && /pp-ideia-slide/.test(ppt) && /htmlFormaRica\(f, ctx\)/.test(ppt)
  );
  checa(
    "clicar aplica a fórmula na lâmina atual (a mesma que a prévia mostra)",
    /this\.run\("arranjo", `\$\{id\}\|\$\{variante\}`\)/.test(ppt) &&
      /case "arranjo":[\s\S]{0,420}substituirSlide\(aplicarArranjo\(sl, arranjo\.id, Number\(v\) \|\| 0, ratio\)\)/.test(ppt)
  );
  checa(
    "a dica do painel explica as duas metades (o Visual não move caixas; a Arrumação reposiciona; tudo só nesta lâmina)",
    /o <b>Visual<\/b> muda cores, fonte e o formato das caixas <b>sem mover nenhuma<\/b>/.test(ppt) && /Clicar aplica só nesta lâmina/.test(ppt)
  );
  checa(
    "o modo Arrumação também acompanha a lâmina atual (pelo mesmo gancho)",
    /if \(this\.lateral === "composicao"\) this\.pintarComposicao\(\)/.test(ppt) && /pintarArranjos\(host\)/.test(ppt)
  );
}

// Composição: as Ideias de design e os Arranjos num sistema só (cartões mistos + filtro)
console.log("\ncomposição (a arrumação e o visual na mesma sugestão)");
{
  const sug = ler("src/powerpoint/edicao/sugestoes.ts");
  checa(
    "o motor da fornada mista existe (arrumação × visual, determinístico pelo lote)",
    /export function sugestoesDe\(op: OpcoesSugestoes\): SugestaoPPT\[\]/.test(sug) &&
      /export function arrumacoesDe\(unidades: number\): Arrumacao\[\]/.test(sug) &&
      /arrumacoes\[\(lote \+ k\) % arrumacoes\.length\]/.test(sug)
  );
  checa(
    "a fornada encolhe em vez de repetir a mesma arrumação num cartão ao lado",
    /Math\.min\(op\.quantas \?\? QUANTAS_PADRAO, arrumacoes\.length\)/.test(sug),
    "duas arrumações iguais seguidas fariam o olho achar que os cartões são iguais"
  );
  checa(
    "o visual anda por passos (a fornada espalha designs em vez de vizinhos do catálogo)",
    /const passo = catalogo\.length \? Math\.max\(1, Math\.floor\(catalogo\.length \/ doCatalogo\)\) : 1;/.test(sug) &&
      /catalogo\[\(lote \* doCatalogo \+ k \* passo\) % catalogo\.length\]/.test(sug)
  );
  checa(
    "os últimos cartões são designs criados na hora (a semente avança a cada lote)",
    /gerarDesign\(semente\)/.test(sug) && /lote \* Math\.max\(1, criadas\) \+ \(k - doCatalogo\)/.test(sug)
  );
  checa(
    "os acabamentos são os da Composição (cores novas, cartão, sombra, cantos, contorno)",
    /export const ACABAMENTOS: TratamentoIdeia\[\] = \["recolorir", "cartao", "sombra", "cantos", "contorno"\]/.test(sug) && /acabamentos/.test(sug + ppt)
  );
  checa(
    "o filtro tem os quatro modos e começa no Designer (arte + capa recomposta; nenhuma caixa de conteúdo se move)",
    /data-composicao-filtro/.test(ppt) &&
      /class="on" data-filtro="designer"[^>]*>Designer</.test(ppt) &&
      /data-filtro="visual">Visual</.test(ppt) &&
      /data-filtro="arrumacao">Arrumação</.test(ppt) &&
      /data-filtro="tudo">Tudo</.test(ppt) &&
      /private filtroComposicao: "designer" \| "tudo" \| "arrumacao" \| "visual" = "designer"/.test(ppt)
  );
  checa(
    "o filtro troca o pintor (Designer, misto, Arranjos, Visuais) e invalida a prévia guardada",
    /this\.filtroComposicao = \(b\.dataset\.filtro as "designer" \| "tudo" \| "arrumacao" \| "visual"\) \?\? "designer"/.test(ppt) &&
      /if \(this\.filtroComposicao === "designer"\) return this\.pintarDesigner\(host\)/.test(ppt) &&
      /this\.previasVista = null;/.test(ppt) &&
      /if \(this\.filtroComposicao === "arrumacao"\) return this\.pintarArranjos\(host\)/.test(ppt) &&
      /if \(this\.filtroComposicao === "visual"\) return this\.pintarVisuais\(host\)/.test(ppt) &&
      /return this\.pintarMistas\(host\)/.test(ppt)
  );
  checa(
    "o cartão misto mostra as duas metades (arrumação · visual) e diz quando o design é Novo",
    /nome\.textContent = \[s\.modelo\.gerado \? "Novo" : "", nomeArrumacao, nomeVisual\]\.filter\(Boolean\)\.join\(" · "\)/.test(ppt) &&
      /const nomeArrumacao = s\.arranjo \? rotuloDoArranjo\(s\.arranjo, s\.variante, quantas\) : ""/.test(ppt)
  );
  checa(
    "a prévia do cartão misto é a lâmina de verdade: modelo + fórmula, com o ratio do deck",
    /aplicarModeloALamina\(atual, de, s\.modelo, s\.tratamento, ratio\)/.test(ppt) &&
      /const comTudo = s\.arranjo \? aplicarArranjo\(comModelo, s\.arranjo, s\.variante, ratio\) : comModelo/.test(ppt) &&
      /if \(s\.arranjo && !arranjoLegivel\(comModelo, comTudo\)\)/.test(ppt)
  );
  checa(
    "a prévia do modo Visual também usa o ratio do deck (antes era 16/9 fixo)",
    /aplicarModeloALamina\(atual, de, m, t, ratio\)/.test(ppt),
    "num deck 4:3 a prévia diria uma coisa e o clique faria outra"
  );
  checa(
    "clicar no cartão misto manda as duas metades (composicao-aplicar com os quatro valores)",
    /this\.run\("composicao-aplicar", `\$\{s\.arranjo \?\? "-"\}\|\$\{s\.variante\}\|\$\{s\.modelo\.id\}\|\$\{s\.tratamento\}`\)/.test(ppt) &&
      /case "composicao-aplicar": \{/.test(ppt)
  );
  checa(
    "as duas metades cabem num passo de desfazer só (um registrar; o miolo sem histórico)",
    /case "composicao-aplicar": \{[\s\S]{0,900}this\.registrar\(\);[\s\S]{0,160}this\.aplicarVisualDaComposicao\(m, t as TratamentoIdeia\);/.test(ppt) &&
      /private aplicarVisualDaComposicao\(modelo: ModeloPPT, tratamento\?: TratamentoIdeia\): void \{\s*\r?\n\s*if \(this\.composicaoTodas\) return this\.aplicarModeloDeck/.test(ppt) &&
      /private aplicarModeloDeck\(modelo: ModeloPPT, tratamento\?: TratamentoIdeia\): void \{/.test(ppt) &&
      /private usarModelo\(modelo: ModeloPPT, tratamento\?: TratamentoIdeia\): void \{\s*\r?\n\s*this\.registrar\(\);/.test(ppt),
    "com dois registros, um Ctrl+Z desfaria só metade da sugestão"
  );
  checa(
    "a arrumação lê a lâmina JÁ com o modelo novo (o deck troca de referência no meio)",
    /this\.aplicarVisualDaComposicao\(m, t as TratamentoIdeia\);[\s\S]{0,220}if \(arranjo\) this\.substituirSlide\(aplicarArranjo\(this\.atual\(\)/.test(ppt)
  );
  checa(
    "a lâmina que não é arrumável sai só de visual (o cartão não promete fórmula à toa)",
    /const podeArrumar = legiveis\.length > 0;/.test(ppt) &&
      /arrumavel\(atual\)\s*\?\s*ARRANJOS\.flatMap/.test(ppt) &&
      /sugestoesDe\(\{ unidades: quantas, arrumavel: podeArrumar, arrumacoes: podeArrumar \? legiveis : undefined/.test(ppt) &&
      /const arranjo = id === "-" \? null : ARRANJOS\.find\(\(a\) => a\.id === id\)/.test(ppt) &&
      /export function arrumavel\(slide: Slide\): boolean \{/.test(ler("src/powerpoint/edicao/arranjos.ts")) &&
      /return cards\.length >= 2 \|\| unidadesCom\(slide, cards, paineis\)\.length >= 3;/.test(ler("src/powerpoint/edicao/arranjos.ts"))
  );
  checa(
    "quando nada cabe, o painel explica em vez de ficar vazio",
    /Nenhuma composição cabe nesta lâmina sem deixar o conteúdo ilegível/.test(ppt) &&
      /Esta lâmina não tem conteúdo para arrumar/.test(ppt)
  );
  checa(
    "css: o filtro segmentado existe e o modo aceso é o do painel",
    /\.pp-seg\s*\{[^}]*display:\s*flex[^}]*flex:\s*none/s.test(cssPpt) && /\.pp-seg button\.on\s*\{/.test(cssPpt),
    "o corpo do painel é uma coluna flex: sem o flex: none o filtro encolhe até sumir"
  );
}

// ---------------------------------------------------------------- fonte e tamanho livres

console.log("\nfonte e tamanho livres nas fitas");

checa("o seletor tem o modo editável (campo + setinha)", /data-editavel/.test(sel) && /\.sel-campo/.test(sel), "modo editável ausente em src/seletor.ts");
checa("o valor digitado vira opção do select", /select\.append\(op\)/.test(sel), "o valor digitado não entra como opção");
checa("número aceita vírgula e respeita min/max", /data-min/.test(sel) && /includes\(","\)/.test(sel), "normalização de número ausente");
checa(
  "a escolha na lista não é aplicada duas vezes",
  /if \(campo\) campo\.value = rotulo;[\s\S]{0,200}if \(mudou\) \{\s*select\.value = valor;[\s\S]{0,200}face\.focus\(\)/.test(sel),
  "ordem do face.focus() no item da lista"
);
checa("o campo do modo editável tem estilo próprio", /\.sel-editavel > \.sel-campo\s*\{/.test(ler("src/styles/base.css")), "regra .sel-editavel > .sel-campo ausente");
// o menu do seletor é compacto: abraça o rótulo (com o campo como mínimo), linhas baixas e
// altura presa — um seletor de números não pode abrir uma janela de 250px (print do usuário)
const cssEditorSel = ler("src/styles/editor.css");
checa(
  "a lista do seletor abraça o conteúdo (sem os 250px dos menus ⋯)",
  /\.dropdown\.sel-menu\s*\{[^}]*width:\s*max-content/s.test(cssEditorSel) &&
    /\.dropdown\.sel-menu\s*\{[^}]*min-width:\s*0/s.test(cssEditorSel) &&
    /\.dropdown\.sel-menu\s*\{[^}]*max-width:\s*min\(320px/s.test(cssEditorSel) &&
    /\.dropdown\.sel-menu\s*\{[^}]*max-height:\s*min\(42vh, 240px\)/s.test(cssEditorSel),
  "o sel-menu voltaria à largura dos menus ⋯ (250px) ou à altura antiga (430px)"
);
checa(
  "as linhas da lista são enxutas (2px de padding, 11,5px de fonte) e cortam com reticências",
  /\.sel-menu \.dd-item\s*\{[^}]*padding:\s*2px 7px/s.test(cssEditorSel) && /\.sel-menu \.dd-item\s*\{[^}]*font-size:\s*11\.5px/s.test(cssEditorSel) && /\.sel-menu \.dd-item > span:first-child\s*\{[^}]*text-overflow:\s*ellipsis/s.test(cssEditorSel),
  "o item continuaria com o padding alto dos menus ⋯"
);
checa(
  "o menu do seletor nasce com a largura do campo como mínimo",
  /menu\.style\.minWidth = `\$\{Math\.ceil\(r\.width\)\}px`/.test(sel),
  "o menu não teria o campo como largura mínima (lista nativa faz isso)"
);

const fitaPptLivre = ler("src/powerpoint/ui/fita.ts");
checa(
  "Página Inicial: Fonte e Parágrafo vêm à frente das Lâminas",
  (() => {
    const de = fitaPptLivre.indexOf("private inicio(): string {");
    const ate = fitaPptLivre.indexOf("private inserir(): string {");
    const trecho = de >= 0 && ate > de ? fitaPptLivre.slice(de, ate) : "";
    const pos = (rotulo: string) => trecho.indexOf(`        "${rotulo}",`);
    return pos("Fonte") > 0 && pos("Parágrafo") > pos("Fonte") && pos("Lâminas") > pos("Parágrafo");
  })(),
  "a ordem pedida (Fonte e Parágrafo no lugar das Lâminas) se perdeu"
);
checa("fita do PowerPoint: fonte e tamanho editáveis", /data-sel="font" data-editavel/.test(fitaPptLivre) && /data-sel="size" data-editavel data-num/.test(fitaPptLivre), "data-editavel ausente nos seletores");
// A espessura do contorno tem CAMPO livre (pedido do usuário, com print: só havia os presets):
// o valor vive num input do popup e o `cores.ts` o aplica no Enter e ao sair do campo
checa(
  "menu do contorno: a espessura tem campo que aceita qualquer número",
  /data-extra-campo="espessura"/.test(fitaPptLivre) && /\.pp-esp input\s*\{/.test(ler("src/styles/powerpoint-edicao.css")),
  "a espessura do contorno voltaria a ter só os presets"
);
checa(
  "menu do contorno: o campo de espessura aplica no Enter e ao sair",
  /\[data-extra-campo\]/.test(ler("src/powerpoint/ui/cores.ts")) && /campo\.addEventListener\("change", aplicar\)/.test(ler("src/powerpoint/ui/cores.ts")),
  "o valor digitado não chegaria ao contorno"
);
checa(
  "o comando espessura aceita vírgula (o campo manda como a pessoa escreveu)",
  /case "espessura":[^;]*replace\(",", "\."\)/.test(ler("src/powerpoint/powerpoint.ts")),
  "o valor com vírgula viraria NaN"
);
const fitaWordLivre = ler("src/word/ribbon.ts");
checa("fita do Word: fonte e tamanho editáveis", /data-sel="font" data-editavel/.test(fitaWordLivre) && /data-sel="size" data-editavel data-num/.test(fitaWordLivre), "data-editavel ausente nos seletores");
checa("o Word acrescenta o valor que a lista não tem", /valor que a lista não conhece/.test(fitaWordLivre), "sel() não cria opção para o valor do documento");

// ---------------------------------------------------------------- campo de fonte: sugestões

console.log("\ncampo de fonte: a lista sugere enquanto se digita");

{
  const sel = ler("src/seletor.ts");
  const cssEditor = ler("src/styles/editor.css");
  checa(
    "digitar abre a lista filtrada pelo texto (sem ligar para acentos)",
    /campo\.addEventListener\("input", \(\) => \{/.test(sel) && /abrirLista\(select, face, wrap, campo\.value, 0\)/.test(sel) && /function semAcento\(/.test(sel) && /normalize\("NFD"\)/.test(sel),
    "o relato: digitar 'time' não sugeria 'Times New Roman'"
  );
  checa(
    "os campos de número não sugerem (o valor é livre)",
    /if \(select\.hasAttribute\("data-num"\)\) return;/.test(sel),
    "no tamanho a lista é atalho: filtrar por número não faz sentido"
  );
  checa(
    "a lista aberta NÃO se recria a cada tecla (nada de piscar)",
    /if \(aberto\?\.select === select\) \{\s*preencherMenu\(filtro, destacar\);\s*return;\s*\}/.test(sel) && /function preencherMenu\(/.test(sel),
    "recriar o menu re-dispara a animação de entrada do .dropdown a cada letra"
  );
  checa(
    "clicar dentro do controle não fecha a lista",
    /!aberto\.menu\.contains\(alvo\) && !aberto\.wrap\.contains\(alvo\)/.test(sel),
    "o relato: a lista aberta fechava no clique do campo"
  );
  checa(
    "as setas andam pelos itens e o Enter aplica o destacado",
    /destacarItem\(base \+ passo\)/.test(sel) && /if \(dele && dele\.destaque >= 0\) aplicarItem\(dele\.destaque\);/.test(sel) && /destacarItem\(destacar\);/.test(sel),
    "sem destaque o Enter volta a ser só o texto digitado"
  );
  checa(
    "com a lista aberta, o Esc devolve o texto (sem sair do campo)",
    /if \(campo && document\.activeElement === campo\) \{\s*campo\.value = rotuloDe\(select\);/.test(sel),
    "o Esc fechava a lista e jogava o foco na setinha, aplicando o texto digitado no blur"
  );
  checa(
    "a lista não fica pendurada quando o foco sai do controle",
    /wrap\.addEventListener\("focusout"/.test(sel) && /wrap\.contains\(proximo\) \|\| aberto\.menu\.contains\(proximo\)/.test(sel),
    "sair de Tab deixava a lista aberta sobre a lâmina"
  );
  checa(
    "o item destacado e a nota de 'nada corresponde' têm estilo próprio",
    /\.sel-menu \.dd-item\.destacado/.test(cssEditor) && /\.sel-nota\s*\{/.test(cssEditor),
    "sem o realce o Enter aplica algo que não se vê"
  );
}

// ---------------------------------------------------------------- fita: o mesmo botão recolhe o popup

console.log("\nfita: o mesmo botão recolhe o que ele abriu");
{
  const popupPpt = ler("src/powerpoint/ui/popup.ts");
  checa(
    "PowerPoint: o popup guarda a âncora que o abriu",
    /let aberto: \{ el: HTMLElement; ancora: HTMLElement; fechar: \(\) => void \} \| null = null;/.test(popupPpt) &&
      /return aberto\?\.ancora \?\? null;/.test(popupPpt) &&
      /aberto = \{\s*el,\s*ancora,\s*fechar:/.test(popupPpt),
    "sem a âncora não dá para saber qual botão abriu o popup"
  );
  checa(
    "PowerPoint: clicar de novo no mesmo botão recolhe em vez de reabrir",
    /if \(ancoraDoPopup\(\) === b\) \{\s*fecharPopup\(\);\s*return;\s*\}/.test(fitaPptLivre),
    "o clique no próprio botão é ignorado pelo 'fecha ao clicar fora' e o comando roda de novo"
  );
  checa(
    "Word: o popup guarda a âncora ao abrir e esquece ao fechar",
    /private ancoraDoPop: HTMLElement \| null = null;/.test(fitaWordLivre) &&
      /this\.ancoraDoPop = anchor;/.test(fitaWordLivre) &&
      /this\.ancoraDoPop = null;/.test(fitaWordLivre),
    "sem isso o Word não sabe que foi o mesmo botão"
  );
  checa(
    "Word: clicar de novo no mesmo botão recolhe em vez de reabrir",
    /if \(this\.pop && this\.ancoraDoPop === anchor\) \{\s*this\.closePop\(\);\s*return;\s*\}/.test(fitaWordLivre),
    "o comando rodaria de novo e o popup reabriria"
  );
}

// ---------------------------------------------------------------- fita x popups

console.log("\nfita: escolher num popup não mexe na faixa");
{
  // A regra do "clicou fora" saiu com o "por enquanto": a faixa não se recolhe sozinha, então não
  // há mais o que blindar contra o clique no popup — a marca `app-popup` (e a decisão por tique)
  // saíram junto. O que fica preso é isso: a marca não volta sem a regra (nem a regra sem a marca).
  const fitaTs = ler("src/fita.ts");
  checa(
    "os popups do app não carregam mais a marca `app-popup` (nem a faixa a lê)",
    !/app-popup/.test(fitaTs) &&
      !/app-popup/.test(ler("src/powerpoint/ui/popup.ts")) &&
      !/app-popup/.test(ler("src/word/ribbon.ts")) &&
      !/app-popup/.test(ler("src/seletor.ts")) &&
      !/app-popup/.test(ler("src/excel/host.ts")),
    "a marca ficaria sem quem a leia (ou a regra antiga voltaria pela metade)"
  );
}

// ---------------------------------------------------------------- start x sessão

console.log("\nstart: sem sessão o app fica no Início (o Hub)");
{
  const tabs = ler("src/app/tabs.ts");
  checa(
    "a sessão vazia vai para o Início (o start não abre rascunho sozinho)",
    /if \(restored\) \{[\s\S]*?return;\s*\}[\s\S]*?this\.showHome\(\);\s*\},/.test(tabs),
    "sem isso o start cai na recuperação legada e abre o último rascunho sozinho"
  );
  checa(
    "a recuperação legada (rascunho/fallback) saiu do start — e os rascunhos seguem no menu",
    !/restoreLegacyDraft/.test(tabs) && !/loadDraftFallback/.test(tabs) && /Rascunhos guardados no app/.test(tabs),
    "ou o rascunho volta a abrir sozinho, ou a lista de rascunhos some do menu de Recentes"
  );
}

// ---------------------------------------------------------------- fita: o encaixe e o modo

console.log("\nfita: o encaixe re-planeja quando o modo da faixa muda");
{
  const fitaModo = ler("src/fita.ts");
  checa(
    "avisa quando o modo muda DE VERDADE (evento próprio, sem laço com o da preferência)",
    /const EVENTO_MODO = "mdc:fita-modo";/.test(fitaModo) &&
      /const antes = o\.el\.classList\.contains\("fita-recolhida"\);/.test(fitaModo) &&
      /if \(antes !== escondida\) document\.dispatchEvent\(new CustomEvent\(EVENTO_MODO\)\);/.test(fitaModo),
    "sem o aviso, clicar numa aba com a faixa recolhida deixa o plano da faixa única preso (o relato)"
  );
  checa(
    "o encaixe dos quatro degraus escuta o aviso (e re-planeja)",
    /document\.addEventListener\(EVENTO_MODO, agendar\);/.test(fitaModo),
    "o plano não seria refeito ao voltar para a aba"
  );
}

const listaFontes = ler("src/fontes.ts");

checa(
  "a lista de fontes do app é compartilhada (PowerPoint e Word)",
  /export const FONTES_COMUNS/.test(listaFontes) && /FONTES_COMUNS/.test(ler("src/powerpoint/ui/estado.ts")) && /FONTES_COMUNS/.test(ler("src/word/schema.ts")),
  "FONTES_COMUNS não é a fonte única"
);

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

// mídia e tela cheia (a barra de controle do HUD e o pedido de tela cheia)
console.log("\nPowerPoint: mídia e tela cheia na apresentação");
checa("a barra da mídia vive no HUD e é remontada a cada lâmina", /data-midia-bar/.test(apresen) && /tocarMidias\(\);\s*\n\s*montarBarraMidia\(\)/.test(apresen));
checa(
  "o que toca é o player DENTRO da caixa (o data-midia-id fica no invólucro)",
  /const elementoDaCaixa = \(caixa: Element\): HTMLMediaElement \| null/.test(apresen) &&
    /for \(const caixa of caixasDeMidia\(\)\) \{/.test(apresen) &&
    !/midiasNoBolso\.values\(\)\) el\.pause\(\)/.test(apresen),
  "pausar/tocar o invólucro (um div) quebrava a mídia da apresentação"
);
checa(
  "a barra traz reproduzir, tempo, busca, volume, mudo, tela cheia e reiniciar",
  ["midiaPlay", "midiaTempo", "midiaBusca", "midiaVol", "midiaMudo", "midiaTela", "midiaReiniciar"].every((d) => new RegExp(`dataset\\.${d} = id`).test(apresen))
);
checa("teclas da mídia: K reproduz/pausa, M mudo, , e . voltam/avançam 5s", /tecla === "k"/.test(apresen) && /tecla === "m"/.test(apresen) && /e\.key === "," \|\| e\.key === "\."/.test(apresen) && /pularMidia\(e\.key === "\." \? 5 : -5\)/.test(apresen));
checa(
  "a apresentação abre em tela cheia e o F alterna (o botão do HUD acompanha)",
  /requestFullscreen/.test(apresen) &&
    /definirTelaCheia\(true\)/.test(apresen) &&
    /document\.addEventListener\("fullscreenchange", atualizarBotaoCheia\)/.test(apresen) &&
    /tecla === "f"/.test(apresen) &&
    /data-tool="cheia"/.test(apresen),
  "o modo apresentação só cobria a janela do app"
);
checa("encerrar a apresentação devolve a janela e solta o ouvinte da tela cheia", /document\.removeEventListener\("fullscreenchange", atualizarBotaoCheia\)/.test(apresen) && /if \(document\.fullscreenElement\) void document\.exitFullscreen/.test(apresen));
checa(
  "a mídia tocando segura o HUD (a barra não some por baixo do vídeo)",
  /const descansar = \(\): void => \{/.test(apresen) && /midiasDoPalco\(\)\.some\(tocando\)/.test(apresen)
);
checa(
  "com o foco num controle da barra as setas são do controle, não da lâmina",
  /focado\.tagName === "INPUT"/.test(apresen) && /e\.key !== "Escape" && focado/.test(apresen)
);
checa("os eventos do player são ligados uma vez por elemento (a mídia que continua entre lâminas não acumula ouvintes)", /const observados = new WeakSet<HTMLMediaElement>\(\)/.test(apresen) && /if \(observados\.has\(el\)\) return;/.test(apresen));
checa(
  "a barra do HUD tem CSS próprio e não some com o `hidden` do atributo",
  /\.slides-midia \{/.test(cssSlides) && /\.slides-midia\[hidden\] \{[^}]*display: none/s.test(cssSlides),
  "sem `.slides-midia[hidden] { display: none }` o display: flex vence o hidden"
);
checa(
  "a mídia que PEDE controles recebe o ponteiro (o isolamento da lâmina o desligava)",
  /\.slides-overlay \.pp-shape\.pp-midia-controles[\s\S]{0,120}pointer-events: auto !important/.test(cssSlides) && /pp-midia-controles/.test(ler("src/powerpoint/render/midia.ts"))
);

console.log("\npopup do Template: cabe na janela e rola");
{
  const css = ler("src/styles/powerpoint-edicao.css");
  checa(
    "o popup de modelos tem teto próprio (não encosta na janela)",
    /\.pp-pop-modelos\s*\{[^}]*max-height:\s*min\(64vh, 560px\)/.test(css),
    "sem teto próprio, o popup chega à borda e corta a última linha"
  );
  checa("a lista rola dentro do popup", /\.pp-popup\s*\{[^}]*overflow:\s*auto/.test(css), "o popup precisa ser o contêiner de rolagem");
  checa(
    "o título fica visível ao rolar",
    /\.pp-pop-modelos\s*>\s*\.pp-pop-t\s*\{[^}]*position:\s*sticky/.test(css),
    "sem o título fixo, ao rolar o usuário perde a referência"
  );
}

console.log("\ngaleria do Template: criar quantos modelos quiser e apagar os próprios");
{
  const ui = ler("src/powerpoint/ui/modelos.ts");
  const css = ler("src/styles/powerpoint-edicao.css");
  const host = ler("src/powerpoint/powerpoint.ts");
  // a ordem do que é montado em `desenhar()`: o cartão de criar primeiro, o catálogo por último
  const corpo = ui.slice(ui.indexOf("const desenhar"), ui.indexOf("const realcar"));
  const posCriar = corpo.indexOf("CARTAO_CRIAR");
  const posUsuario = corpo.indexOf("usuario.map(");
  const posCatalogo = corpo.indexOf("MODELOS.map(");
  checa(
    "o cartão de criar vem antes do catálogo (fica à vista sem rolar)",
    posCriar >= 0 && posCriar < posUsuario && posUsuario < posCatalogo,
    "no fim de uma grade de 22 presets o '+' e os modelos do usuário saem da tela e parece que só dá para criar um"
  );
  checa(
    "os modelos da pessoa vêm antes do catálogo",
    posUsuario >= 0 && posUsuario < posCatalogo,
    "quem cria um modelo precisa achar o cartão novo sem rolar até o fim"
  );
  checa(
    "as duas seções estão separadas por um título na grade",
    /class="pp-pop-t pp-tpls-t">Modelos do app</.test(ui) && /\.pp-tpls-t\s*\{[^}]*grid-column:\s*1 \/ -1/.test(css),
    "sem o título, os cartões do app e os do usuário ficam misturados"
  );
  checa(
    "o cartão recém-criado fica em destaque e à vista",
    /scrollIntoView\(\{\s*block:\s*"nearest"\s*\}\)/.test(ui) && /classList\.add\("pp-tpl-novo"\)/.test(ui) && /\.pp-tpl-novo\s*\{[^}]*box-shadow/.test(css),
    "sem o realce, o cartão novo nasce fora da vista e parece que a criação não funcionou"
  );
  checa(
    "o × aparece sempre, só nos modelos do usuário",
    /m\.usuario \? `<span class="pp-tpl-x"/.test(ui) && /\.pp-tpl-x\s*\{[^}]*display:\s*flex/.test(css) && !/\.pp-tpl-x\s*\{[^}]*display:\s*none/.test(css),
    "o × só no hover passava despercebido; e o do app não pode ser apagado"
  );
  checa(
    "o × não apaga o modelo errado (o clique no × não aplica o cartão)",
    /const remover = t\.closest<HTMLElement>\("\[data-x\]"\);\s*\n\s*if \(remover\) \{\s*\n\s*e\.stopPropagation\(\)/.test(ui),
    "o clique no × tem que sair antes de aplicar o modelo"
  );
  checa(
    "apagar mantém a rolagem onde a pessoa estava",
    /const rolagem = el\.scrollTop/.test(ui) && /el\.scrollTop = rolagem/.test(ui),
    "redesenhar a grade joga a rolagem para o topo (a cada × a pessoa se perde)"
  );
  checa(
    "a galeria é reencaixada na janela depois de desenhar",
    /r\.right > window\.innerWidth - 8/.test(ui) && /el\.style\.left = /.test(ui),
    "o abrirPopup posiciona o popup vazio (min-width 190px): com a grade de 3 colunas a última coluna fica fora da tela"
  );
  checa(
    "o armazenamento que recusa não passa em branco",
    /export function criarModeloUsuario\([^)]*\): ModeloPPT \| null/.test(ler("src/powerpoint/modelosUsuario.ts")) &&
      /if \(!modelo\) \{/.test(host) &&
      /if \(!removerModeloUsuario\(/.test(host),
    "sem isso o modelo some sem a pessoa saber por quê"
  );
}

console.log("\nfita do Word: o ajuste escala métricas (como as Apresentações)");
{
  const rib = ler("src/word/ribbon.ts");
  const css = ler("src/styles/word.css");
  checa(
    "a fita do Word usa o modo métricas",
    /ligarAjusteAlturaFita\(\{ el: host, modo: "metricas" \}\)/.test(rib),
    "sem isso o arrasto aplica zoom e encolhe a fonte junto (fica ilegível e não vale a pena encolher)"
  );
  // a escala métrica da fita é `--fita-e` = `--fita-escala` (alça de altura) × `--fita-ajuste` (o
  // encaixe à largura): as métricas da fita do Word acompanham as duas
  const escaladas = (css.match(/var\(--fita-e/g) ?? []).length;
  checa("as métricas acompanham a escala", escaladas >= 12, `${escaladas} valores`);
  checa("a fonte tem piso (nada de texto ilegível)", /font-size: max\(11\.5px, calc\(13px \* var\(--fita-e/.test(css));
  checa(
    "fita baixa vira compacta (ícone + nome numa linha)",
    /\.fita-compacta \.rb\.big\s*\{[^}]*flex-direction:\s*row/.test(css),
    "sem o modo compacto a fita não perde altura de verdade"
  );
}

// ---------------------------------------------------------------- a folha do Word no tema escuro

console.log("\nWord: a folha escurece junto com o tema (o papel)");
{
  const css = ler("src/styles/word.css");
  checa(
    "o papel e a tinta da folha saem de variáveis",
    /\.wd-sheet \{[\s\S]*?--wd-papel: #ffffff;[\s\S]*?--wd-tinta: #1f2328;[\s\S]*?background: var\(--wd-papel\);[\s\S]*?color: var\(--wd-tinta\);/.test(css),
    "com os tons fixos na folha, o tema escuro não tem onde trocar"
  );
  checa(
    "no tema escuro a folha escurece e a tinta clareia",
    /\[data-theme="dark"\] \.wd-sheet \{[\s\S]*?--wd-papel: #15181e;[\s\S]*?--wd-tinta: #e6e8ee;/.test(css),
    "a folha continuaria branca no tema escuro (o relato)"
  );
  checa(
    "o que a folha pinta sozinha acompanha (texto, código, cabeçalho, link)",
    /\.wd-doc \{[\s\S]*?color: var\(--wd-tinta\);/.test(css) &&
      /\.wd-doc pre \{[\s\S]*?background: var\(--wd-bloco\);/.test(css) &&
      /\.wd-doc code \{[\s\S]*?background: var\(--wd-codigo\);/.test(css) &&
      /\.wd-doc a \{[\s\S]*?color: var\(--wd-link\);/.test(css) &&
      /\.wd-hdr-first,[\s\S]*?color: var\(--wd-fraca\);/.test(css),
    "sobraria branco fixo dentro da folha (texto, código ou cabeçalho)"
  );
  checa(
    "os filetes e o rótulo da quebra de página acompanham",
    /\.wd-doc td,\s*\.wd-doc th \{[\s\S]*?border: 1px solid var\(--wd-filete\);/.test(css) &&
      /\.wd-pagebreak \{[\s\S]*?border-top: 1px dashed var\(--wd-filete\);/.test(css) &&
      /\.wd-pagebreak span \{[\s\S]*?background: var\(--wd-papel\);/.test(css),
    "as bordas e o rótulo ficariam com os tons do papel branco"
  );
  checa(
    "o texto sobre o realce continua escuro (marca-texto é claro)",
    /\[data-theme="dark"\] \.wd-doc mark,[\s\S]*?color: #1f2328;/.test(css),
    "no escuro o marca-texto viraria um borrão claro sobre claro"
  );
  checa(
    'o "preto" do documento vira a tinta do papel no tema escuro',
    /\[data-theme="dark"\] \.wd-doc span\[style\*="color:#000000"\],/.test(css) &&
      /\[data-theme="dark"\] \.wd-doc mark span\[style\*="color:#000000"\]/.test(css),
    "documento importado com preto explícito (é o que o Word grava em \"Automático\") sumiria na folha escura"
  );
  checa(
    "imprimir e exportar PDF saem em papel branco, com o tema que estiver",
    /@media print \{[\s\S]*?body\.word-open \.wd-sheet \{[\s\S]*?--wd-papel: #ffffff;[\s\S]*?--wd-tinta: #1f2328;/.test(css),
    "no tema escuro o PDF sairia com papel escuro"
  );
}

// ---------------------------------------------------------------- dica (tooltip do app)

console.log("\ndicas do app (o balão no lugar do title nativo)");

const { posicaoDaDica } = await import("../src/dica.ts");

// posição: abaixo quando cabe; acima quando não cabe; sempre dentro da janela
{
  const janela = { largura: 1000, altura: 700 };
  const caixa = (topo: number, esquerda = 100, largura = 40, altura = 24) => ({
    left: esquerda,
    top: topo,
    width: largura,
    height: altura,
    bottom: topo + altura,
  });

  const embaixo = posicaoDaDica(caixa(100), { largura: 200, altura: 30 }, janela);
  checa(
    "cabe embaixo: o balão sai abaixo, centrado no controle",
    embaixo.abaixo && embaixo.topo === 132 && embaixo.esquerda === 20,
    JSON.stringify(embaixo)
  );

  const emcima = posicaoDaDica(caixa(660), { largura: 200, altura: 30 }, janela);
  checa(
    "sem espaço embaixo: o balão sobe para cima do controle",
    !emcima.abaixo && emcima.topo === 622,
    JSON.stringify(emcima)
  );

  const esquerda = posicaoDaDica(caixa(100, 2, 20), { largura: 200, altura: 30 }, janela);
  const direita = posicaoDaDica(caixa(100, 980, 20), { largura: 200, altura: 30 }, janela);
  checa(
    "nas pontas da janela o balão não vaza",
    esquerda.esquerda === 8 && direita.esquerda === 792,
    JSON.stringify({ esquerda, direita })
  );
}

// contrato do módulo e da folha
const dica = ler("src/dica.ts");
checa(
  "o title sai no hover e VOLTA ao sair (o nativo nunca aparece)",
  /removeAttribute\("title"\)/.test(dica) && /setAttribute\("title", guardado\)/.test(dica),
  "sem devolver o title, a dica some do elemento para sempre"
);
checa(
  "a dica espera um instante parado sobre o controle",
  /const ESPERA_MS = \d+/.test(dica) && /setTimeout\(mostrar/.test(dica) && /imediato \? 0 : ESPERA_MS/.test(dica),
  "sem espera, a dica pisca ao cruzar a fita"
);
checa("toque (dedo/caneta) não abre dica", /pointerType === "touch"/.test(dica), "a dica apareceria no toque");
checa(
  "o balão vive na raiz do documento (imune ao modo apresentação)",
  /doc\.documentElement\.append\(balao\)/.test(dica),
  "como filho do body, a apresentação o esconderia"
);
checa("o app liga as dicas no start", /ligarDicas\(\)/.test(ler("src/main.ts")), "ninguém chama ligarDicas");
checa(
  "o balão fica acima das janelas e popups do app",
  /\.dica\s*\{[^}]*z-index:\s*1050/.test(ler("src/styles/base.css")),
  "o balão precisa ficar acima dos modais e menus"
);
checa(
  "o balão é superfície do app (painel, borda e sombra) e não recebe o ponteiro",
  /\.dica\s*\{[^}]*background:\s*var\(--panel\)[^}]*border:\s*1px solid var\(--border\)[^}]*pointer-events:\s*none/s.test(
    ler("src/styles/base.css")
  ),
  "sem os tokens do app o balão volta a destoar"
);
checa(
  "o texto da dica quebra dentro do balão (caminho longo não vaza)",
  /\.dica\s*\{[^}]*overflow-wrap:\s*anywhere/.test(ler("src/styles/base.css")),
  "sem a quebra, um caminho sem espaços passa por fora da caixa e cobre o conteúdo"
);
checa("a dica segue a preferência de cantos", /\.dica\b/.test(ler("src/styles/cantos.css")), "fora da lista dos cantos");
checa(
  "a dica não sai na impressão",
  /@media print\s*\{\s*\.dica\s*\{\s*display:\s*none/.test(ler("src/styles/base.css")),
  "um balão preso apareceria no PDF"
);

// ---------------------------------------------------------------- botão de perigo das Configurações

console.log("\nbotão de perigo das Configurações");

const cfgBtnCss = ler("src/styles/settings.css");
checa(
  "o botão de perigo reafirma o fundo (o rótulo não fica vermelho em cima de vermelho)",
  /\.st-btn\.danger\s*\{[^}]*background:\s*var\(--panel-2\)/s.test(cfgBtnCss),
  "falta o background no .st-btn.danger — o .btn.danger do base pinta o fundo e o texto fica invisível"
);
checa(
  "o texto do perigo é a cor de perigo (legível no fundo do botão)",
  /\.st-btn\.danger\s*\{[^}]*color:\s*var\(--danger\)/s.test(cfgBtnCss)
);
checa(
  "o vermelho sólido fica no hover e na confirmação",
  /\.st-btn\.danger:hover\s*\{[^}]*background:\s*var\(--danger\)/s.test(cfgBtnCss) &&
    /\.st-btn\.danger\.confirmando\s*\{[^}]*background:\s*var\(--danger\)/s.test(cfgBtnCss),
  "o hover ou o confirmando perderam o fundo vermelho"
);

// ---------------------------------------------------------------- estilos de cor (R2)

console.log("\nestilos de cor (galeria, painel e o vivo)");

{
  const fitaEst = ler("src/powerpoint/ui/fita.ts");
  const pptEst = ler("src/powerpoint/powerpoint.ts");
  const painelEst = ler("src/powerpoint/ui/painel.ts");
  const motorEst = ler("src/powerpoint/edicao/estilos.ts");
  const cssEst = ler("src/styles/powerpoint-edicao.css");

  checa(
    "o motor expõe as receitas, o ligar/soltar e os guardas das opções",
    /export const FAMILIAS/.test(motorEst) && /export function ligarEstilo/.test(motorEst) && /export function soltarEstilo/.test(motorEst) && /export const ehFamilia/.test(motorEst) && /export function estiloDaFamilia/.test(motorEst),
    "faltou peça do motor que a UI usa"
  );
  checa(
    "o estilo deriva ANTES das ligações (o conector lê a cor da caixa já derivada)",
    /atualizarEstilos\(slide[\s\S]{0,360}atualizarLigacoes\(comEstilo/.test(pptEst),
    "a ordem do recálculo no substituirSlide mudou — o conector pegaria a cor antiga"
  );
  checa(
    "a galeria fica no grupo Estilos de Cor (aba Formato da Forma) e abre pela fita",
    /grupo\(\s*"Estilos de Cor",\s*`\$\{grande\("estilos"/.test(fitaEst) && /case "estilos":\s*this\.menuEstilos\(ancora\)/.test(fitaEst) && /private menuEstilos\(ancora: HTMLElement\)/.test(fitaEst),
    "o botão da fita ficaria sem menu"
  );
  checa(
    "a galeria oferece família, intensidade, brilho, ângulo, cor e desligar",
    /estilo-cor:familia:\$\{id\}/.test(fitaEst) &&
      /estilo-cor:intensidade:(suave|" \+ )?/.test(fitaEst) &&
      /estilo-cor:brilho:/.test(fitaEst) &&
      /estilo-cor:brilho:dobra/.test(fitaEst) &&
      /estilo-cor:angulo:/.test(fitaEst) &&
      /estilo-cor:cor:\$\{c\}/.test(fitaEst) &&
      /estilo-cor:desligar/.test(fitaEst),
    "faltou uma opção na galeria"
  );
  checa(
    "a fita despacha estilo-cor e o host tem o caso",
    /else if \(cmd\.startsWith\("estilo-cor:"\)\) this\.hooks\.run\("estilo-cor", cmd\.slice\(11\)\)/.test(fitaEst) && /case "estilo-cor":\s*this\.estiloCor\(String\(value \?\? ""\)\)/.test(pptEst) && /private estiloCor\(acao: string\)/.test(pptEst),
    "o comando da galeria não chega ao host"
  );
  checa(
    "com estilo, a cor do preenchimento vira a cor-BASE (a rampa se refaz)",
    /case "preench": \{[\s\S]{0,1200}ligarEstilo\(s, estilizadas, \{ base: String\(value\) \}/.test(pptEst) && /const estilizadas = this\.idsComEstilo\(\)/.test(pptEst),
    "escolher cor numa forma estilizada não atualizaria a rampa"
  );
  checa(
    "a orientação do gradiente vira o ângulo do estilo",
    /case "gradiente": \{[\s\S]{0,900}ligarEstilo\(s, estilizadas, \{ angulo: ang\[dir\]/.test(pptEst),
    "o gradiente da fita não acompanharia o estilo"
  );
  checa(
    "pintura manual (contorno/sombra) solta o estilo antes de aplicar",
    /private comPintura\(fn: \(s: Slide\) => Slide/.test(pptEst) && /case "contorno":\s*this\.comPintura\(/.test(pptEst) && /case "sombra-pronta":\s*this\.comPintura\(/.test(pptEst) && /this\.comPintura\(\(s\) => patchFormas\(s, this\.selecao, aplicar\)\)/.test(pptEst),
    "a edição manual seria derrubada pelo recálculo no próximo movimento"
  );
  checa(
    "o painel ganha a seção Estilo no lugar do preenchimento cru",
    /private htmlEstilo\(f: Shape\)/.test(painelEst) && /if \(f\.estilo\) partes\.push\(secao\("estilo", "Estilo", this\.htmlEstilo\(f\)\)\)/.test(painelEst) && /data-click="estilo-cor" data-valor="desligar"/.test(painelEst),
    "a seção do painel ficou de fora"
  );
  checa(
    "o painel assina o estilo (redesenha quando ele muda) e manda os comandos certos",
    /s\.midia, s\.src, s\.estilo\]\)/.test(painelEst) && /\["dobra", "Dobra"\]/.test(painelEst) && /case "est-cor-base":/.test(pptEst) && /case "est-cor-int":/.test(pptEst) && /case "est-cor-bri":/.test(pptEst) && /case "est-cor-angulo":/.test(pptEst),
    "sem a assinatura o painel não acompanharia o estilo"
  );
  checa(
    "css: os cartões da galeria e as famílias do painel têm estilo próprio",
    /\.pp-estilo-cartao\s*\{/.test(cssEst) && /\.pp-estilo-previa\s*\{/.test(cssEst) && /\.pf-estilo-fam\s*\{/.test(cssEst),
    "faltou estilo das prévias"
  );
  checa(
    "o fundo da lâmina também tem estilo (fita, painel e host)",
    /data-extra="fundo-estilo:familia:\$\{id\}"/.test(fitaEst) &&
      /data-extra="fundo-estilo:desligar"/.test(fitaEst) &&
      /private htmlEstiloFundo\(e: EstiloForma\)/.test(painelEst) &&
      /data-click="fundo-estilo" data-valor="desligar"/.test(painelEst) &&
      /case "fundo-estilo":\s*this\.fundoEstilo\(String\(value \?\? ""\)\)/.test(pptEst) &&
      /private fundoEstilo\(acao: string\)/.test(pptEst),
    "o fundo com estilo ficaria sem porta"
  );
  checa(
    "com estilo no fundo, a cor vira a base e a edição manual o solta",
    /case "fundo-cor":[\s\S]{0,400}ligarEstiloFundo\(s, \{ base: String\(value\)\.toUpperCase\(\) \}/.test(pptEst) &&
      /case "fundo-grad": \{[\s\S]{0,400}ligarEstiloFundo\(s, \{ angulo: ang\[dir\]/.test(pptEst) &&
      /case "fundo-todas": \{[\s\S]{0,700}if \(bgEstilo\) n\.bgEstilo = bgEstilo/.test(pptEst) &&
      /bgEstilo: this\.atual\(\)\.bgEstilo/.test(pptEst),
    "o vivo do fundo (cor, ângulo e aplicar a todas) ficaria pela metade"
  );

  // R5: os Modelos carregam o estilo (cartão com a rampa, fundo das lâminas, o vivo acompanha)
  const modelosEd = ler("src/powerpoint/edicao/modelos.ts");
  const modelosUi = ler("src/powerpoint/ui/modelos.ts");
  checa(
    "os modelos podem carregar um Estilo de Cor (os do usuário); o catálogo não traz mais os três de gradiente",
    /estilo\?: \{ familia: FamiliaEstilo; intensidade: IntensidadeEstilo; brilho: BrilhoEstilo \}/.test(modelosEd) && !/\{ id: "(esmeralda|oceano|ameixa)"/.test(modelosEd),
    "o campo estilo sumiu ou os modelos de gradiente voltaram ao catálogo"
  );
  checa(
    "aplicar um modelo com estilo põe a receita no fundo (e o sem estilo devolve ao do modelo)",
    /if \(modelo\.estilo\) return \{ \.\.\.sl, bgEstilo: \{ \.\.\.modelo\.estilo, base: "" \}/.test(modelosEd) && /delete n\.bgEstilo;/.test(modelosEd),
    "o fundo não acompanharia o modelo"
  );
  checa(
    "o estilo vivo re-deriva ao aplicar o modelo (o acento novo chega às formas)",
    /private aplicarModeloDeck\(modelo: ModeloPPT[\s\S]{0,700}atualizarEstilos\(s, d, tema\)/.test(pptEst),
    "as formas de cor do tema ficariam com a rampa antiga até a próxima edição"
  );
  checa(
    "o cartão do modelo mostra a rampa do estilo (e o modelo do usuário guarda o do deck)",
    /pp-tpl-com-estilo/.test(modelosUi) && /rampaDeTons\(rec\.base \|\| accent/.test(modelosUi) && /function estiloDoDeckNasLaminas/.test(modelosEd),
    "a prévia do cartão ficaria sem a rampa"
  );

  // R6: o polimento — a cor do conector vem da cor-base da rampa e o menu avisa sem seleção
  const ligEst = ler("src/powerpoint/edicao/ligacoes.ts");
  checa(
    "polimento: o conector de uma caixa estilizada usa a cor-base (não o tom claro)",
    /const corDoGradiente = /.test(ligEst) && /corDoGradiente\(s\.fillX\.stops \?\? \[\]\)/.test(ligEst),
    "o conector voltaria ao stops[0] (o tom claro da ponta)"
  );
  checa(
    "polimento: o menu de estilos avisa e desabilita sem forma escolhida",
    /pp-pop-dica/.test(fitaEst) && /temForma \? "" : " disabled"/.test(fitaEst) && /\.pp-pop-dica\s*\{/.test(cssEst) && /\.pp-estilo-cartao:disabled/.test(cssEst),
    "o menu ficaria mudo (cartões clicáveis sem efeito)"
  );
}

// ---------------------------------------------------------------- pincel de formatação (copiar formatação)

console.log("\npincel de formatação (copiar formatação)");

{
  const fitaPin = ler("src/powerpoint/ui/fita.ts");
  const pptPin = ler("src/powerpoint/powerpoint.ts");
  const palcoPin = ler("src/powerpoint/stage.ts");
  const motorPin = ler("src/powerpoint/edicao/pincel.ts");
  const cssPin = ler("src/styles/powerpoint-edicao.css");

  checa(
    "o botão fica na Área de Transferência, junto de Recortar/Copiar/Duplicar",
    /grupo\(\s*"Área de Transferência",[\s\S]{0,1000}copiar-formato/.test(fitaPin) && /pequeno\("copiar-formato", ic\("i-brush"\), "Copiar formatação"/.test(fitaPin),
    "o botão do pincel saiu da Área de Transferência"
  );
  checa(
    "o duplo clique arma o modo fixo (como no Pincel de Formatação do Word)",
    /addEventListener\("dblclick"[\s\S]{0,240}copiar-formato[\s\S]{0,120}run\("copiar-formato", "fixo"\)/.test(fitaPin),
    "o duplo clique não chegaria à fita"
  );
  checa(
    "a fita acende o botão com o pincel armado e o desabilita sem forma escolhida",
    /on\("copiar-formato", st\.ferramenta\?\.tipo === "pincel"\)/.test(fitaPin) && /dis\("copiar-formato", !tem\)/.test(fitaPin),
    "o botão ficaria mudo (sem estado e sem guarda)"
  );
  checa(
    "o palco tem a ferramenta pincel, o hook e o clique que entrega a forma",
    /export type Ferramenta = [^\n]*\{ tipo: "pincel" \}/.test(palcoPin) &&
      /aoPincelar: \(id: string \| null\) => void/.test(palcoPin) &&
      /ctx\.ferramenta\?\.tipo === "pincel"[\s\S]{0,400}this\.hooks\.aoPincelar\(/.test(palcoPin) &&
      /el\.classList\.toggle\("pincel-fmt", ctx\.ferramenta\?\.tipo === "pincel"\)/.test(palcoPin),
    "o clique com o pincel não chegaria ao host"
  );
  checa(
    "o pincel não usa a cruz de desenhar — o cursor vira o 'copiar'",
    /tipo !== "pincel"\)/.test(palcoPin) && /\.pp-slide\.pincel-fmt\s*,\s*\n?\.pp-slide\.pincel-fmt \*\s*\{[^}]*cursor:\s*copy/s.test(cssPin),
    "a cruz de criação ficaria no pincel"
  );
  checa(
    "o duplo clique na forma não abre o texto com o pincel armado",
    /aoDuploClique[\s\S]{0,1200}if \(ctx\.ferramenta\?\.tipo === "pincel"\) return;/.test(palcoPin),
    "pintar viraria editar o texto"
  );
  checa(
    "o motor copia a pintura e o formato do texto (sem tocar no que é do alvo)",
    /export function copiarFormato\(f: Shape\): FormatoPincel/.test(motorPin) &&
      /export function aplicarFormato\(alvo: Shape, fmt: FormatoPincel\): Shape/.test(motorPin) &&
      /comPreenchimento\(alvo, copia\(fmt\.fill\)\)/.test(motorPin) &&
      /comOpacidade\(n, fmt\.opacity\)/.test(motorPin) &&
      /paras: alvo\.paras \? textoComFormato\(alvo\.paras, fmt\) : alvo\.paras/.test(motorPin),
    "faltou pintura ou texto na cópia"
  );
  checa(
    "a receita do estilo vivo vai junto (e sem ela o alvo solta o estilo)",
    /estilo: f\.estilo \? copia\(f\.estilo\) : undefined/.test(motorPin) && /if \(fmt\.estilo\) n\.estilo = copia\(fmt\.estilo\)/.test(motorPin) && /delete n\.estilo;/.test(motorPin),
    "o estilo do alvo ficaria pela metade"
  );
  checa(
    "o host arma/desarma o pincel (clique de novo, Esc, recarregar a apresentação)",
    /case "copiar-formato":\s*return this\.alternarPincelFormato\(value === "fixo"\)/.test(pptPin) &&
      /private alternarPincelFormato\(fixo: boolean\)/.test(pptPin) &&
      /this\.ferramenta\?\.tipo === "pincel" && !fixo/.test(pptPin) &&
      /case "ferramenta":[\s\S]{0,700}this\.pincelFmt = null/.test(pptPin) &&
      /load\(data: PowerPointTabData\): void \{[\s\S]{0,900}this\.pincelFmt = null/.test(pptPin),
    "o pincel ficaria armado depois de sair da ferramenta"
  );
  checa(
    "aplicar não gasta o pincel fixo (e o 'uma vez' se desarma depois de pintar)",
    /private aoPincelar\(id: string \| null\)[\s\S]{0,700}if \(!p\.fixo\) this\.run\("ferramenta", ""\)/.test(pptPin) && /if \(!alvo \|\| alvo\.bloqueada\) return;/.test(pptPin),
    "o pincel desarmaria cedo (ou pintaria forma travada)"
  );
  checa(
    "sem receita de estilo na cópia, o alvo solta o estilo antes de vestir a pintura",
    /patchFormas\(fmt\.estilo \? s : soltarEstilo\(s, \[id\]\), \[id\], \(f\) => aplicarFormato\(f, fmt\)\)/.test(pptPin),
    "a pintura seria derrubada pelo recálculo no próximo movimento"
  );
}

// ---------------------------------------------------------------- docs sem marcador de conflito

console.log("\ndocs sem marcador de conflito");

for (const arq of ["CHANGELOG.md", "README.md", "docs/historico-tecnico.md", "docs/powerpoint.md", "docs/funcionalidades.md"]) {
  checa(`${arq} sem marcador de conflito esquecido`, !/^(<{7,}|={7,}|>{7,})/m.test(ler(arq)), "sobrou <<<<<<< / ======= / >>>>>>> de um rebase");
}

// ---------------------------------------------------------------- Configurar apresentação (removido)

console.log("\nPowerPoint: o 'Configurar' saiu (a aba Design cobre)");

{
  const fita = ler("src/powerpoint/ui/fita.ts");
  checa(
    "a barra da fita não tem mais o botão Configurar",
    !/data-cmd="configure"/.test(fita) && !/ppr-cfg/.test(fita),
    "o botão ficou para trás"
  );
  checa(
    "Design ▸ Personalizar tem o fundo, o layout e o Tamanho (16:9/4:3)",
    /grupo\(\s*"Personalizar",[\s\S]{0,200}grande\("fundo"[\s\S]{0,400}grande\("tamanho-lamina"/.test(fita) && !/grande\("configure"/.test(fita),
    "o Tamanho voltou a ter lugar; o diálogo removido não pode voltar"
  );
  const docs = ler("src/app/powerpointDocs.ts");
  checa("o diálogo e o pedido do host saíram do app", !/askPptSetup/.test(docs) && !/configurePpt/.test(docs), "sobrou código do diálogo");
  checa(
    "o host do PowerPoint não tem mais a fiação 'configure'",
    !/onConfigure/.test(ler("src/powerpoint/powerpoint.ts")),
    "a fiação onConfigure ficou no host do PowerPoint"
  );
  checa(
    "o 'Configurar planilha' do Excel continua (só o do PowerPoint saiu)",
    /askExcelConfig/.test(ler("src/app/excelDocs.ts")) && /xl-tab-cfg/.test(ler("src/excel/ribbon.ts")),
    "a remoção não pode levar o diálogo do Excel junto"
  );
}

console.log("\ncache do WebView: teto escolhido na tela e aplicado na janela");
{
  const conf = JSON.parse(ler("src-tauri/tauri.conf.json")) as { app: { windows: unknown[] } };
  const rust = ler("src-tauri/src/lib.rs");
  const storage = ler("src-tauri/src/commands/storage.rs");
  const pagina = ler("src/settingsPage.ts");
  const front = ler("src/storage.ts");

  // A janela saiu do `tauri.conf.json` para o `lib.rs`: é o único jeito de o argumento do
  // cache chegar ANTES de o WebView existir (o conf é compilado junto com o app).
  checa("a janela não é mais criada pelo tauri.conf.json", Array.isArray(conf.app.windows) && conf.app.windows.length === 0, "app.windows do conf precisa ficar vazio");
  checa(
    "a janela é montada no lib.rs com os mesmos valores do arquivo",
    /WebviewWindowBuilder::new\(app, "main", tauri::WebviewUrl::default\(\)\)/.test(rust) &&
      /\.inner_size\(1320\.0, 860\.0\)/.test(rust) &&
      /\.min_inner_size\(940\.0, 620\.0\)/.test(rust) &&
      /\.decorations\(false\)/.test(rust) &&
      /\.shadow\(true\)/.test(rust),
    "título, tamanho, mínimo, decoração e sombra precisam continuar iguais"
  );
  checa("o lib.rs decide o teto antes de montar a janela", /let args_webview = commands::storage::preparar_webview\(\)/.test(rust) && /additional_browser_args\(&args_webview\)/.test(rust));
  checa(
    "os padrões do wry continuam nos argumentos",
    /--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection/.test(storage),
    "passar argumentos substitui os padrões do wry (menu mini e SmartScreen)"
  );
  checa("o teto vira --disk-cache-size em bytes", /--disk-cache-size=\{\}/.test(storage) && /limite_mb \* 1024 \* 1024/.test(storage));
  checa("sem teto escolhido (automático) não vai argumento extra", /if limite_mb > 0/.test(storage));
  checa("a escolha fica em cache.json na pasta de dados", /const CACHE_CFG: &str = "cache\.json"/.test(storage));
  checa("o Rust recusa teto fora das opções", /fn validar_limite/.test(storage) && /fora das opções/.test(storage));
  checa(
    "as opções da tela são as mesmas do Rust",
    /\[0, 512, 1024, 2048, 4096\]/.test(storage) && /\["0", "Automático"\]/.test(pagina) && /\["4096", "4 GB"\]/.test(pagina),
    "seletor e LIMITES_MB precisam concordar"
  );
  checa(
    "a conta do cache separa o cache das preferências",
    /pub\(crate\) fn soma_cache/.test(storage) && /PASTAS_DE_CACHE/.test(storage) && /cache_bytes/.test(front),
    "o painel mostra o cache em si, não só o 'Outros dados'"
  );
  checa(
    "a tela grava o teto pelo comando do Rust e avisa quando só vale depois",
    /storage_set_cache_limit/.test(front) && /definirLimiteDoCache/.test(pagina) && /ligarDd\("cache-limite"/.test(pagina) && /vale na próxima abertura do app/.test(pagina)
  );
  checa(
    "o painel mostra o cache agora e o limite em uso",
    /data-arm-cache/.test(pagina) && /aplicado_mb/.test(storage) && /emUso/.test(pagina)
  );
}

// ---------------------------------------------------------------- prévia das sombras (tema escuro)

console.log("\nPowerPoint: prévia das sombras na galeria de Efeitos");

{
  const fita = ler("src/powerpoint/ui/fita.ts");
  const css = ler("src/styles/powerpoint-edicao.css");
  checa(
    "a prévia desenha a forma sobre uma mesa própria",
    /function previaSombra\(/.test(fita) && /ppr-sombra-forma/.test(fita) && /previaSombra\(s\.sombra\)/.test(fita),
    "a sombra voltou a cair no fundo do menu"
  );
  checa(
    "a mesa é de tom médio (não o fundo do painel)",
    /\.ppr-sombra-previa\s*\{[^}]*background:\s*#[0-9a-f]{6}/i.test(css) && !/\.ppr-sombra-previa\s*\{[^}]*var\(--panel-2\)/s.test(css),
    "com o fundo do painel a sombra preta some no tema escuro"
  );
  checa("a sombra fica recortada na mesa", /\.ppr-sombra-previa\s*\{[^}]*overflow:\s*hidden/.test(css), "sem recorte a sombra escapa do quadradinho");
  checa(
    "a forma da prévia é clara (contrasta com a mesa)",
    /\.ppr-sombra-forma\s*\{[^}]*background:\s*#fff/.test(css),
    "a forma precisa contrastar com a mesa nos dois temas"
  );
}

// ---------------------------------------------------------------- Conectar: alvo das bolinhas

console.log("\nConectar: alvo das bolinhas (sem piscar, caixa certa)");

const palcoConectar = ler("src/powerpoint/stage.ts");
const ligPpt = ler("src/powerpoint/edicao/ligacoes.ts");
checa(
  "o hover das bolinhas é geométrico (não o DOM)",
  /alvoDaConexao\(ctx\.shapes\.filter\(\(s\) => !s\.liga\)/.test(palcoConectar),
  "pelo DOM a fresta da bolinha pertence à caixa de baixo: o alvo pisca e a ligação sai errada"
);
checa("o clique da bolinha também é geométrico (com folga)", /bolinhaDaConexao\(ctx\.shapes\.filter\(\(s\) => !s\.liga\)/.test(palcoConectar), "clicar exatamente na bolinha de 11 px é duro demais");
checa("os conectores ficam fora do alvo", (palcoConectar.match(/!s\.liga/g) ?? []).length >= 2, "a linha da ligação atravessa a lâmina e roubaria o ponteiro");
checa("a histerese existe (a borda não fica piscando)", /margemX/.test(ligPpt) && /margemY/.test(ligPpt), "sem folga o alvo alterna entre a caixa e a de baixo");

// ---------------------------------------------------------------- o clique que só escolhe

console.log("\nPowerPoint: o clique que só escolhe não repinta (a seleção múltipla destravou)");

{
  const ppt = ler("src/powerpoint/powerpoint.ts");
  checa(
    "o fim do arrasto só repinta quando houve mudança",
    /const mudou = !!this\.pendente && this\.pendente\.slides !== this\.slides;/.test(ppt) && /if \(mudou \|\| patches\.size\) this\.pintar\(\);/.test(ppt),
    "o pointerup de um clique que só ESCOLHEU voltaria a pagar o repaint inteiro (~65 ms medidos)"
  );
  checa(
    "a fileira de miniaturas não é refeita quando nada mudou",
    /if \(this\.stripDeck === this\.slides && this\.stripSetup === this\.setup\) \{/.test(ppt) &&
      /private stripDeck: Slide\[\] \| null = null;/.test(ppt) &&
      /private stripSetup: DeckSetup \| null = null;/.test(ppt),
    "as N miniaturas voltariam a ser redesenhadas a cada repaint (~59 ms num deck de 12 lâminas)"
  );
}

// ---------------------------------------------------------------- o seletor de cores

console.log("\nPowerPoint: o seletor de cores abre com os usados recentemente");

{
  const cores = ler("src/powerpoint/ui/cores.ts");
  const iRecentes = cores.indexOf("Usados recentemente");
  const iDoc = cores.indexOf("Cores do documento");
  const iPadrao = cores.indexOf("Cores padrão");
  checa(
    "os usados recentemente vêm antes das cores do documento",
    iRecentes > 0 && iDoc > iRecentes && iPadrao > iDoc,
    "a ordem do popup voltaria ao que era (Cores do documento no topo)"
  );
  checa(
    "a seção aparece mesmo sem cor usada (com a dica)",
    /<div class="pp-pop-t">Usados recentemente<\/div>\r?\n\s*\$\{usadas\.length \?/.test(cores) && /As cores que você usar aparecem aqui\./.test(cores),
    "sem cor usada a seção sumiria e a mudança não apareceria para quem abre o seletor"
  );
  checa(
    "a cor lembrada é normalizada (não duplica por caixa)",
    /const c = cor\.toUpperCase\(\);/.test(cores) && /recentes\(\)\.filter\(\(x\) => x !== c\)/.test(cores),
    "a mesma cor entraria duas vezes (F2F2F2 e f2f2f2)"
  );
}

// ---------------------------------------------------------------- o traço em gradiente (Conectar)

console.log("\nConectar: o traço em gradiente da origem ao destino (uma forma só)");

{
  const lig = ler("src/powerpoint/edicao/ligacoes.ts");
  const desenho = ler("src/powerpoint/render/forma.ts");
  const exp = ler("src/powerpoint/pptxexport/rica.ts");
  const imp = ler("src/powerpoint/pptximport/formas.ts");
  const esquema = ler("src/powerpoint/schema.ts");
  checa(
    "a ligação é UMA forma, com o gradiente da origem ao destino",
    /export function gradienteDaLigacao\(corDe: string, corPara: string, a: Pto, b: Pto\): LineGrad \| undefined/.test(lig) &&
      /stops: \[\r?\n\s*\{ pos: 0, color: corDe, alpha: 1 \},\r?\n\s*\{ pos: 100, color: corPara, alpha: 1 \},/.test(lig) &&
      /return \[formaDa\(cmds, corPara, gradienteDaLigacao\(corDe, corPara, a, b\), ligaDe\(/.test(lig),
    "a ligação voltaria a sair em duas metades de cor (o corte seco)"
  );
  checa(
    "o ângulo do gradiente é a reta entre as bordas (normalizado em 0..360)",
    /Math\.atan2\(b\.y - a\.y, b\.x - a\.x\)/.test(lig) && /\(g \+ 360\) % 360/.test(lig),
    "ângulo negativo não existe no `a:lin` do .pptx"
  );
  checa(
    "cores iguais (ou uma sem cor) = traço sólido, sem gradiente",
    /if \(!corDe \|\| !corPara \|\| corDe\.toUpperCase\(\) === corPara\.toUpperCase\(\)\) return undefined;/.test(lig),
    "o arquivo carregaria um gradiente à toa"
  );
  checa(
    "a seta fica na cor do destino (o `ln.color` é a cor final)",
    /function formaDa\(cmds: \(string \| number\)\[\], cor: string, grad: LineGrad \| undefined/.test(lig) &&
      /color: cor,\r?\n\s*alpha: 1,\r?\n\s*w: TRACO,/.test(lig),
    "um marcador não pinta com o gradiente: a seta precisa de cor própria"
  );
  checa(
    "o modelo ganhou o traço em gradiente (mesma convenção do preenchimento)",
    /export interface LineGrad/.test(esquema) && /grad\?: LineGrad;/.test(esquema) && /parte\?: "a" \| "b";/.test(esquema),
    "sem `Line.grad` a ligação ficaria em cor sólida"
  );
  checa(
    "a tela desenha o gradiente no eixo do `a:lin` (projeção da caixa)",
    /function defsDeTraco\(id: string, ln: Line \| undefined, w: number, h: number\)/.test(desenho) &&
      /gradientUnits="userSpaceOnUse"/.test(desenho) &&
      /const eixo = Math\.abs\(w \* dx\) \+ Math\.abs\(h \* dy\);/.test(desenho) &&
      /atributosDeTraco\(s\.ln, refTraco\)/.test(desenho),
    "no objectBoundingBox o ângulo entorta numa faixa fina e a tela deixa de bater com o .pptx"
  );
  checa(
    "o .pptx exporta o traço em `a:gradFill` dentro do `a:ln`",
    /ln\.grad\?\.stops\?\.length\r?\n\s*\? gradXml\(ln\.grad\.stops, linXml\(ln\.grad\.angle\), ln\.alpha\)/.test(exp) &&
      /function gradXml\(stops: GradStop\[\], dir: string, alfa = 1\)/.test(exp),
    "o traço sairia sólido no arquivo"
  );
  checa(
    "a importação preserva o contorno em gradiente",
    /if \(!g\.radial\) out\.grad = \{ stops: g\.stops, angle: g\.angle \};/.test(imp),
    "o gradiente voltaria achatado na primeira parada"
  );
  checa(
    "as metades antigas se juntam no recálculo (uma forma por `grupo`)",
    /if \(vistas\.has\(s\.liga\.grupo\)\) continue;/.test(lig) && /const vistas = new Set<string>\(\);/.test(lig),
    "documento antigo ficaria com duas formas sobrepostas por ligação"
  );
}

// ---------------------------------------------------------------- duplicar lâmina (fita e miniatura)

console.log("\nPowerPoint: duplicar lâmina na fita e no clique direito da miniatura");

{
  const fita = ler("src/powerpoint/ui/fita.ts");
  const ppt = ler("src/powerpoint/powerpoint.ts");
  checa(
    "a aba Inserir também tem o Duplicar lâmina (e o Nova lâmina saiu das duas abas)",
    /grupo\(\r?\n\s*"Lâminas",\r?\n\s*`\$\{grande\("slide-dup"/.test(fita) && !/slide-new/.test(fita),
    "o Duplicar só existiria na Página Inicial (ou o Nova lâmina voltaria)"
  );
  checa(
    "a miniatura abre menu próprio no clique direito",
    /btn\.addEventListener\("contextmenu", \(e\) => this\.menuDaLamina\(e, i\)\)/.test(ppt),
    "o menu nativo do WebView (Voltar/Atualizar/Inspecionar) volta a aparecer"
  );
  checa("o menu da miniatura oferece Duplicar lâmina", /private menuDaLamina\([\s\S]{0,700}"Duplicar lâmina"/.test(ppt), "sem a ação onde o usuário procura");
  checa(
    "as ações do menu agem na lâmina CLICADA",
    /this\.indice = i;\r?\n\s+if \(c === "dup"\) this\.run\("slide-dup"\)/.test(ppt),
    "agiriam sempre na lâmina atual"
  );
  checa(
    "o menu barra o menu nativo do navegador",
    /menuDaLamina\(e: MouseEvent, i: number\): void \{\r?\n\s+e\.preventDefault\(\)/.test(ppt),
    "o menu do navegador apareceria por cima"
  );
console.log("\nPowerPoint: arrastar a miniatura para reordenar (ponteiro, não HTML5)");
{
  const ppt = ler("src/powerpoint/powerpoint.ts");
  const css = ler("src/styles/powerpoint-edicao.css");
  // O relato: "clico e seguro com o botão esquerdo para arrastar e o app bloqueia". O `draggable`
  // do HTML não começa dentro do app porque o Tauri substitui o manipulador de arrasto do WebView2
  // (é ele que entrega os arquivos soltos na janela) — o arrasto passou a ser por eventos de
  // ponteiro, que funcionam com o manipulador do Tauri ligado.
  checa(
    "a miniatura não usa mais o draggable do HTML",
    !/btn\.draggable = true/.test(ppt) && !/addEventListener\("dragstart"/.test(ppt),
    "o arrasto nativo nunca começa no WebView do Tauri: a miniatura fica presa"
  );
  checa(
    "o arrasto é por eventos de ponteiro, com captura no começo do gesto",
    /this\.ligarArrastoDaFaixa\(\)/.test(ppt) &&
      /this\.strip\.addEventListener\("pointerdown"/.test(ppt) &&
      /a\.ativo = true;[\s\S]{0,900}this\.strip\.setPointerCapture\(a\.ponteiro\)/.test(ppt) &&
      !/this\.strip\.setPointerCapture\(e\.pointerId\)/.test(ppt),
    "capturar no pointerdown redireciona os cliques da faixa: escolher a lâmina, o × e o + Nova lâmina ficariam mudos"
  );
  checa(
    "o clique simples continua escolhendo a lâmina",
    /if \(Math\.abs\(ev\.clientX - a\.x\) < 4 && Math\.abs\(ev\.clientY - a\.y\) < 4\) return;/.test(ppt) &&
      /if \(this\.cliqueAposArrasto\) \{/.test(ppt),
    "sem o mínimo de movimento todo clique viraria arrasto; sem a trava, o clique do fim do gesto escolheria a lâmina errada"
  );
  checa(
    "a linha de inserção segue o ponteiro nas duas faixas (topo e vertical)",
    /const coord = this\.faixaVertical \? y : x;/.test(ppt) &&
      /if \(para < lista\.length\) lista\[para\]\.classList\.add\("alvo-antes"\);/.test(ppt) &&
      /else lista\[lista\.length - 1\]\.classList\.add\("alvo-depois"\);/.test(ppt),
    "a faixa vertical precisa da linha em cima/embaixo; a do topo, à esquerda/direita"
  );
  checa(
    "soltar leva a lâmina para a posição apontada (índice final ajustado)",
    /const para = ativo \? destino\(ev\.clientX, ev\.clientY\) : 0;/.test(ppt) &&
      /if \(a\.de < final\) final--;/.test(ppt) &&
      /this\.moverLaminaPara\(a\.de, final\);/.test(ppt),
    "o índice de inserção não é o final: quem está antes anda uma casa ao sair"
  );
  checa(
    "arrastar até a borda rola a faixa",
    /this\.rolarFaixaNoArrasto\(ev\.clientX, ev\.clientY\)/.test(ppt) && /this\.rolagemDoArrasto = window\.setInterval/.test(ppt),
    "sem isso o destino que está fora da vista fica inalcançável"
  );
  checa("Esc cancela o arrasto em andamento", /if \(ev\.key !== "Escape" \|\| !this\.arrastoFaixa\) return;/.test(ppt));
  checa(
    "o cursor avisa o arrasto e o texto não é selecionado no caminho",
    /\.pp-strip\.pp-arrastando,[\s\S]{0,120}cursor: grabbing;/.test(css) && /user-select: none;/.test(css)
  );
}

console.log("menus da fita: o clique nunca fica mudo");

const fitaSrc = ler("src/powerpoint/ui/fita.ts");
// O menu "Organizar"/"Alinhar e girar": o par dos extremos junto no topo, como no Office (o relato
// veio com print: o "Enviar para trás" só aparecia na quarta linha, depois de "Avançar"/"Recuar").
checa(
  "o menu Organizar põe o par Trazer para a frente / Enviar para trás junto no topo",
  /\["z-topo", "Trazer para a frente"\], \["z-fundo", "Enviar para trás"\], \["z-frente", "Avançar"\], \["z-tras", "Recuar"\]/.test(fitaSrc),
  "os passos de camada voltariam para o meio do par (é o par que se usa junto)"
);
checa(
  "o mesmo par aparece junto na fita e no menu do clique direito",
  /pequeno\("z-topo"[^\n]*\r?\n\s*\$\{pequeno\("z-fundo"/.test(fitaSrc) &&
    /\["z-topo", "Trazer para a frente", true\],\r?\n\s*\["z-fundo", "Enviar para trás", true\]/.test(ler("src/powerpoint/powerpoint.ts")),
  "a fita e o clique direito já mostram o par junto: o menu não pode ser o único fora do padrão"
);

console.log("\ncomandos do PowerPoint: nenhum case repetido no switch");
{
  const ppt = ler("src/powerpoint/powerpoint.ts");
  // Só o `switch` do `run`: o arquivo tem outros switches (o das cores, o do texto) que repetem
  // comandos de propósito, porque são despachados por outro caminho.
  const corpo = ppt.slice(ppt.indexOf("private run(cmd: string, value?: string): void {"));
  const fim = corpo.indexOf("\n  private ");
  const doRun = corpo.slice(0, fim > 0 ? fim : corpo.length);
  const casos = [...doRun.matchAll(/case "([a-z0-9-]+)":/g)].map((m) => m[1]);
  const repetidos = [...new Set(casos.filter((c, i) => casos.indexOf(c) !== i))];
  // O `switch` pega o primeiro `case` que casa: um comando repetido deixa o segundo INALCANÇÁVEL
  // (o Vite avisa no build). Foi assim que `modelo-criar` nasceu duas vezes — o do Template (deste
  // arquivo) e o do Estúdio Modelo — e o botão "Modelo" da fita criava um cartão de Template.
  checa("nenhum comando aparece em dois cases", repetidos.length === 0, `repetidos: ${repetidos.join(", ")}`);
  checa(
    "os dois 'criar modelo' têm nomes próprios (Template × Estúdio Modelo)",
    /case "template-criar"/.test(doRun) && /case "modelo-criar"/.test(doRun) && /criar: \(nome\) => run\("template-criar", nome\)/.test(fitaSrc),
    "com o mesmo nome, o case do Estúdio Modelo fica morto e o botão Modelo cria um cartão de Template"
  );
}
// O Contorno (o relato: "clicado de novo, não abre"): desabilitado sem forma escolhida, o botão
// engolia o clique. Agora ele abre o menu com a dica e os itens desabilitados — o padrão que os
// Estilos de cor já usavam (d32f4db).
checa(
  "Preenchimento/Contorno/Efeitos NÃO entram na lista dos desabilitados sem forma",
  !/\["preench", "contorno", "sombra", "ordem"/.test(fitaSrc) &&
    /for \(const c of \["ordem", "z-topo", "z-fundo", "z-frente", "z-tras"\]\) dis\(c, !tem\);/.test(fitaSrc),
  "o botão voltaria a engolir o clique"
);
checa(
  "o menu do Contorno abre com a dica (e sem seleção)",
  /semSelecao: !tem,\r?\n\s+dica: "Selecione uma forma na lâmina para desenhar o contorno\."/.test(fitaSrc),
  "o menu abriria mudo"
);
checa(
  "o menu do Preenchimento abre com a dica (e sem seleção)",
  /dica: "Selecione uma forma na lâmina para pintar o preenchimento\."/.test(fitaSrc) && /semSelecao: !tem,/.test(fitaSrc),
  "o menu abriria mudo"
);
checa(
  "o menu dos Efeitos abre com a dica e os cartões desabilitados",
  /temForma \? "" : `<p class="pp-pop-dica">Selecione uma forma na lâmina para aplicar o efeito\.<\/p>`/.test(fitaSrc) &&
    /class="pp-pop-item" data-sombra="\$\{i\}"\$\{temForma \? "" : " disabled"\}/.test(fitaSrc),
  "os efeitos abririam mudo"
);

const coresSrc = ler("src/powerpoint/ui/cores.ts");
checa(
  "o seletor de cores aceita a dica e o modo sem seleção",
  /semSelecao\?: boolean;/.test(coresSrc) &&
    /dica\?: string;/.test(coresSrc) &&
    /op\.semSelecao && op\.dica \? `<p class="pp-pop-dica">\$\{op\.dica\}<\/p>`/.test(coresSrc) &&
    /if \(op\.semSelecao\) \{\r?\n\s+for \(const c of el\.querySelectorAll<HTMLButtonElement \| HTMLInputElement>\("button, input"\)\) c\.disabled = true;/.test(coresSrc),
  "sem seleção os controles continuariam clicáveis (nada aconteceria)"
);

const popupSrc = ler("src/powerpoint/ui/popup.ts");
// O menu do Contorno é alto: numa janela baixa ele subia e TAPAVA o próprio botão — o clique
// seguinte caía no menu. Agora ele encolhe (rolagem interna) e nunca cobre a âncora.
checa(
  "o popup nunca cobre a âncora (função pura de posição)",
  /export function posicaoDoPopup\(/.test(popupSrc) &&
    /if \(altura <= abaixo\) return \{ left, top: r\.bottom \+ VAO, maxAltura: null \};/.test(popupSrc) &&
    /return \{ left, top: r\.bottom \+ VAO, maxAltura: Math\.max\(MINIMO, abaixo\) \};/.test(popupSrc) &&
    !/if \(top \+ h > window\.innerHeight - 8\) top = Math\.max\(8, r\.top - h - 4\);/.test(popupSrc),
  "subir por cima do botão voltaria"
);
checa(
  "o abrirPopup aplica a altura máxima (rolagem por dentro)",
  /const p = posicaoDoPopup\(r, el\.offsetWidth, el\.offsetHeight, \{ w: window\.innerWidth, h: window\.innerHeight \}, op\.alinharDireita\);/.test(popupSrc) &&
    /if \(p\.maxAltura !== null\) el\.style\.maxHeight = `\$\{p\.maxAltura\}px`;/.test(popupSrc),
  "o menu passaria da janela em vez de rolar"
);
checa(
  "os controles desabilitados do menu ficam apagados (e sem hover)",
  /\.pp-sw:disabled,\r?\n\.pp-op:disabled,\r?\n\.pp-grad:disabled \{\r?\n\s+opacity: 0\.4;/.test(pp) && /\.pp-op:hover:not\(:disabled\),/.test(pp) && /\.pp-sw:hover:not\(:disabled\) \{/.test(pp),
  "um controle desabilitado ainda pareceria clicável"
);
}

// ---------------------------------------------------------------- roda horizontal nas fitas

console.log("\nroda do mouse anda de lado nas fitas e galerias");

{
  const fita = ler("src/fita.ts");
  const word = ler("src/word/ribbon.ts");
  const excel = ler("src/excel/ribbon.ts");
  const ppt = ler("src/powerpoint/powerpoint.ts");
  checa(
    "a rolagem lateral com a roda é uma função só (compartilhada)",
    /export function ligarRodaHorizontal\(/.test(fita) && /defaultPrevented/.test(fita) && /passive: false/.test(fita),
    "cada fita ficaria com a sua cópia inline"
  );
  checa(
    "a galeria de Estilos do Word recebe a roda",
    /\.rb-styles"\)\.forEach\(ligarRodaHorizontal\)/.test(word),
    "o 'Título 3' volta a ficar sem alcance ao lado"
  );
  checa(
    "as fitas usam a função no que AINDA rola (a galeria e as abas), sem cópia inline",
    !/\.scrollLeft \+= e\.deltaY/.test(excel + ppt) && /ligarRodaHorizontal/.test(word) && /ligarRodaHorizontal/.test(ppt) && !/ligarRodaHorizontal/.test(excel),
    "sobrou cópia inline — ou alguém religou a roda no painel da fita, que agora não rola (o encaixe decide o ajuste)"
  );
  checa(
    "o gesto é do trecho de dentro (mesmo no fim) e Ctrl/Shift ficam de fora",
    /e\.ctrlKey \|\| e\.metaKey \|\| e\.shiftKey/.test(fita) &&
      /if \(max <= 1\) return;[\s\S]{0,240}e\.preventDefault\(\);[\s\S]{0,240}Math\.min\(max, el\.scrollLeft \+ e\.deltaY\)/.test(fita),
    "encadearia para a fita ou roubaria o zoom (Ctrl+roda)"
  );
}

console.log("\narrastar a caixa: forma sem fundo escolhida pega o miolo");
{
  const css = ler("src/styles/powerpoint-edicao.css");
  const forma = ler("src/powerpoint/render/forma.ts");
  const host = ler("src/powerpoint/powerpoint.ts");
  checa(
    "o vazio da forma sem fundo continua clique-através",
    /\.pp-shape\.pp-rica\.pp-sem-fundo\s*\{[^}]*pointer-events:\s*none/.test(css),
    "o clique-atraves e o que deixa escolher o que esta embaixo"
  );
  checa(
    "escolhida, o miolo vira área de arrasto (e o cursor avisa)",
    /\.pp-shape\.pp-rica\.pp-sem-fundo\.pp-pega[^{]*\{[^}]*pointer-events:\s*auto[^}]*cursor:\s*move/.test(css),
    "sem isso só as letras pegam o clique e arrastar a caixa fica quase impossível"
  );
  checa(
    "o render marca a forma escolhida (pp-pega), menos enquanto edita",
    /const pega = semFundo && !ctx\.editando && !!ctx\.selecionadas\?\.includes\(s\.id\)/.test(forma) && /pega \? " pp-pega"/.test(forma)
  );
  checa(
    "a lâmina leva a seleção para o render",
    /this\.ctxRender\(true, this\.selecao\)/.test(host) && /selecionadas, editavel/.test(host),
    "sem a selecao no contexto o pp-pega nunca apareceria"
  );
}

// ---------------------------------------------------------------- aba Animações: o redesign

console.log("\nPowerPoint: aba Animações (o desenho da fita)");

{
  const fita = ler("src/powerpoint/ui/fita.ts");
  const css = ler("src/styles/powerpoint-edicao.css");
  const estado = ler("src/powerpoint/ui/estado.ts");
  const ppt = ler("src/powerpoint/powerpoint.ts");
  // a ordem dos grupos é o que dá a leitura da aba: qual efeito, como começa, quanto tempo,
  // onde está na lâmina e vê-lo tocar
  const corpo = fita.slice(fita.indexOf("private animacoes(): string {"), fita.indexOf("private design(): string {"));
  const ordem = ["Animação", "Início", "Direção", "Tempo", "Texto", "Ordem", "Animar"].map((n) => corpo.indexOf(`"${n}"`));
  checa(
    "os grupos ficam na ordem de uso (e não são mais oito)",
    ordem.every((v, i) => v >= 0 && (i === 0 || v > ordem[i - 1])) && !/grupo\("Duração"/.test(corpo) && !/grupo\("Atraso"/.test(corpo),
    "Duração e Atraso entram no grupo Tempo (uma linha cada, com o próprio rótulo)"
  );
  checa(
    "Duração e Atraso moram na mesma casa, cada um com o próprio rótulo",
    /<span class="ppr-mini">Duração<\/span>/.test(fita) && /<span class="ppr-mini">Atraso<\/span>/.test(fita) && /\.ppr-mini\s*\{/.test(css)
  );
  checa(
    "as escolhas de uma linha são um controle segmentado",
    /class="ppr-seg/.test(fita) && /button\.ppr\.seg\s*\{/.test(css) && /\.ppr-seg > button\.ppr\.seg \+ button\.ppr\.seg\s*\{/.test(css),
    "botões soltos não dizem que são alternativas entre si"
  );
  checa(
    "o cartão cabe o nome inteiro e o popup usa a célula de 84px",
    /\.ppr-anim \{\s*\/\*[\s\S]*?\*\/\s*grid-template-columns:\s*repeat\(7, calc\(72px \* var\(--fita-e\)\)\)/.test(css) &&
      /\.ppr-anim-item \{\s*position:\s*relative;\s*gap:\s*2px;\s*width:\s*calc\(72px \* var\(--fita-e\)\)/.test(css) &&
      /\.ppr-anim-gal \.ppr-anim-item \{\s*width:\s*100%/.test(css),
    "em 54px o 'Desaparecer' saía cortado (61px de texto, medido no harness)"
  );
  checa(
    "a galeria sem forma escolhida aparece apagada (e o Mais não abre)",
    /\.ppr-anim-item:disabled\s*\{[^}]*opacity/.test(css) && /dis\("animacao-mais", !tem\)/.test(fita),
    ".ppr-anim-item não é button.ppr: a regra geral de :disabled não vale para ele"
  );
  checa(
    "o efeito escolhido tem o selo, e o 'Por parágrafo' é um chip que acende",
    /\.ppr-anim-item\.on::after\s*\{[^}]*content:\s*"✓"/.test(css) && /\.ppr-chip:has\(input:checked\)/.test(css) && /class="ppr-chip"/.test(fita),
    "o .on do cartão era só a cor da borda do :hover"
  );
  checa(
    "a posição na ordem aparece ao lado das setas",
    /data-anim-pos/.test(fita) && /badge\.textContent = naOrdem \? `\$\{efPos \+ 1\}\/\$\{totalAnim\}` : "–"/.test(fita),
    "↑↓ sem o número não dizem onde o efeito está na lâmina"
  );
  checa(
    "o valor de duração/atraso só aparece quando não é um dos da lista",
    /!DURACOES_ANIMACAO\.some\(\(d\) => d\.valor === efDur\)/.test(fita) && /!ATRASOS_ANIMACAO\.some\(\(d\) => d\.valor === efAtraso\)/.test(fita),
    "o escolhido aparecia duas vezes na mesma linha"
  );
  checa(
    "o botão Painel abre o painel de animação e segue o estado dele",
    /case "animacao-painel":\s*\r?\n\s*this\.mostrarPainelLateral\(\);\s*\r?\n\s*this\.mostrarLateral\("animacao"\)/.test(ppt) &&
      /lateral\?: "formatar" \| "notas" \| "animacao" \| "composicao"/.test(estado) &&
      /on\("animacao-painel", st\.lateral === "animacao" && st\.lateralAberta === true\)/.test(fita) &&
      (ppt.match(/this\.fita\?\.atualizar\(\)/g) ?? []).length >= 2,
    "trocar a aba pelo painel ou esconder o painel tem de apagar/acender o botão"
  );
  checa(
    "o popup Mais diz em qual forma o efeito vai cair",
    /pp-pop-dica/.test(fita) && /aplicar na forma <b>/.test(fita) && /\.pp-pop-anim \.pp-pop-rot\s*\{/.test(css),
    "o popup tapa a seleção"
  );
}

// ---------------------------------------------------------------- recolher a faixa

console.log("\nfita: a faixa fica como o usuário a deixou");

{
  const fita = ler("src/fita.ts");
  checa(
    "a dica da barra das abas diz o que o gesto faz (e não promete o duplo clique que saiu)",
    /const titulo = escondida[\s\S]{0,400}Mostrar a faixa de opções completa[\s\S]{0,240}Recolher a faixa de opções, deixando a faixa única/.test(fita) && !/duplo clique numa aba/.test(fita),
    "a dica precisa acompanhar o estado (e o gesto em vigor)"
  );
}

// ---------------------------------------------------------------- lâmina e página no tema escuro

console.log("\nmoldura da lâmina e relevo da página no tema escuro");
{
  const tokensCss = ler("src/styles/tokens.css");
  const pptCss = ler("src/styles/powerpoint.css");
  const editCss = ler("src/styles/powerpoint-edicao.css");
  const wordCss = ler("src/styles/word.css");
  // a mesma conta do `contrasteDeCores` do editor (o teste aqui lê CSS, não importa módulo)
  const contraste = (a: string, b: string): number => {
    const lum = (h: string) => {
      const v = [0, 1, 2].map((i) => {
        const c = parseInt(h.slice(i * 2, i * 2 + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
    };
    const la = lum(a);
    const lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const hex = (re: RegExp, txt: string) => (re.exec(txt)?.[1] ?? "").toUpperCase();
  const palcoEscuro = hex(/\[data-theme="dark"\][\s\S]*?--palco-bg:\s*#([0-9a-f]{6})/i, tokensCss);
  const bordaEscura = hex(/\[data-theme="dark"\][\s\S]*?--lamina-borda:\s*#([0-9a-f]{6})/i, tokensCss);
  const temaEscuro = hex(/escuro:\s*\{\s*bg:\s*"([0-9A-F]{6})"/, ler("src/powerpoint/schema.ts"));
  checa(
    "o palco do escuro tem tom próprio (um degrau acima do fundo do app)",
    /:root\s*\{[\s\S]*?--palco-bg:\s*var\(--bg\)/.test(tokensCss) && palcoEscuro.length === 6 && palcoEscuro !== "0E1014"
  );
  checa(
    "a moldura do escuro contrasta com o palco E com a lâmina escura (≥ 2,5:1)",
    bordaEscura.length === 6 && contraste(bordaEscura, palcoEscuro) >= 2.5 && contraste(bordaEscura, temaEscuro) >= 2.5,
    `borda #${bordaEscura} · palco #${palcoEscuro} (${contraste(bordaEscura, palcoEscuro).toFixed(2)}) · tema #${temaEscuro} (${contraste(bordaEscura, temaEscuro).toFixed(2)})`
  );
  checa(
    "o palco e a lâmina usam os tokens novos",
    /#pp-stage\s*\{[^}]*background:\s*var\(--palco-bg/.test(pptCss) && /\.pp-slide\s*\{[^}]*box-shadow:\s*0 0 0 1px var\(--lamina-borda/.test(pptCss)
  );
  checa("a miniatura da lista recebe a mesma moldura", /\.pp-thumb-box\s*\{[^}]*box-shadow:\s*0 0 0 1px var\(--lamina-borda/.test(editCss));
  checa("a dica 'Clique para adicionar' ficou legível (0,55 e não 0,4)", /\.pp-dica\s*\{[^}]*opacity:\s*0\.55/.test(editCss) && !/\.pp-dica\s*\{[^}]*opacity:\s*0\.4/.test(editCss));
  checa(
    "a folha do Word ganhou relevo (moldura + sombra em duas camadas + dobra clara no topo)",
    /\.wd-sheet\s*\{[^}]*box-shadow:\s*0 0 0 1px var\(--lamina-borda[^}]*0 1px 3px[^}]*0 8px 28px[^}]*inset 0 1px 0/s.test(wordCss) &&
      /\[data-theme="dark"\]\s*\.wd-sheet\s*\{[^}]*box-shadow:\s*0 0 0 1px var\(--lamina-borda[^}]*inset 0 1px 0/s.test(wordCss)
  );
}

// ---------------------------------------------------------------- molduras de prévia (palco, não papel)

console.log("\nPowerPoint: as molduras das prévias são palco, não papel");
{
  const css = ler("src/styles/powerpoint-edicao.css");
  const tokensCss = ler("src/styles/tokens.css");
  // A moldura recorta a lâmina de verdade (Ideias/Arranjos no painel lateral e Variantes na aba
  // Design): o vão em volta da lâmina é PALCO e acompanha o tema do app — o `#fff` fixo aparecia
  // como um branco que não existe na tela quando o app estava no escuro.
  checa(
    "a moldura das Ideias/Arranjos usa o tom do palco",
    /\.pp-ideia-moldura\s*\{[^}]*background:\s*var\(--palco-bg/.test(css),
    "no tema escuro ela pintava um branco fixo"
  );
  checa("a moldura das Variantes usa o tom do palco", /\.pp-var-moldura\s*\{[^}]*background:\s*var\(--palco-bg/.test(css));
  checa(
    "nenhuma das duas voltou ao branco fixo",
    !/\.pp-(ideia|var)-moldura\s*\{[^}]*background:\s*(#fff\b|#ffffff|white\b)/i.test(css)
  );
  checa(
    "o token do palco existe nos dois temas (é ele que muda o tom em cada um)",
    /:root\s*\{[\s\S]*?--palco-bg:\s*var\(--bg\)/.test(tokensCss) && /\[data-theme="dark"\]\s*\{[\s\S]*?--palco-bg:\s*#/.test(tokensCss)
  );
}

// ---------------------------------------------------------------- painel lateral do PowerPoint

console.log("\nPowerPoint: o painel lateral se encaixa (abas e janela estreita)");

{
  const css = ler("src/styles/powerpoint-edicao.css");
  checa(
    "as abas do painel ficam numa grade regular (células iguais, sem fila quebrada)",
    /\.pp-side-tabs \{[\s\S]{0,700}display: grid/.test(css) &&
      /\.pp-side-tabs \{[\s\S]{0,700}grid-template-columns: repeat\(auto-fit, minmax\(72px, 1fr\)\)/.test(css) &&
      /\.pp-side-tabs button \{[\s\S]{0,140}white-space: nowrap/.test(css),
    "as abas voltam a quebrar em fila irregular (células do tamanho do texto, difíceis de clicar)"
  );
  checa(
    "a aba do painel tem hover (parece clicável)",
    /\.pp-side-tabs button:hover \{[\s\S]{0,140}background: var\(--panel-2\)/.test(css),
    "sem hover a aba não parecia clicável"
  );
  checa(
    "o painel encolhe com a janela (largura e piso com min())",
    /\.pp-side \{[\s\S]{0,260}width: min\(var\(--pp-side-w, 260px\), 100%\)/.test(css) && /min-width: min\(200px, 100%\)/.test(css),
    "em janela estreita o painel sai para fora do app"
  );
  checa(
    "o conteúdo do painel acompanha a mesma largura (não empurra para fora)",
    /\.pp-side > :not\(\.pp-side-resize\) \{[\s\S]{0,260}min-width: min\(var\(--pp-side-w, 260px\), 100%\)/.test(css),
    "os filhos presos a 260px estouram o painel"
  );
  // a faixa de lâminas ganhou alça de largura no modo vertical (pedido do usuário, com print):
  // a mesma mecânica do painel, com a largura na var `--pp-faixa-w` (as miniaturas acompanham)
  const cssFita = ler("src/styles/powerpoint.css");
  checa(
    "a faixa vertical tem alça de largura (só no modo vertical)",
    /\.pp-faixa-alca \{\s*display: none/.test(cssFita) && /\.pp-left\.faixa-vertical \.pp-faixa-alca \{[\s\S]{0,200}cursor: col-resize/.test(cssFita),
    "a barra lateral ficaria sem a alça de arrasto"
  );
  checa(
    "as miniaturas saem da var `--pp-faixa-w` (crescem com a faixa)",
    /\.pp-thumb \{[\s\S]{0,160}width: var\(--pp-faixa-w, 128px\)/.test(cssFita) && /\.pp-left\.faixa-vertical \.pp-thumb \{[\s\S]{0,80}width: var\(--pp-faixa-w, 112px\)/.test(cssFita),
    "a faixa mudaria de largura sem as miniaturas acompanharem"
  );
  checa(
    "a alça da faixa arrasta como a do painel (rAF, limites e largura guardada)",
    /\[data-faixa-resize\]/.test(ppt) && /setProperty\("--pp-faixa-w"/.test(ppt) && /guardar\("pp-faixa-w"/.test(ppt) && /\[data-faixa-resize\]"\)/.test(ppt),
    "o arrasto da faixa perdeu rAF/limites ou não guarda a largura"
  );
}

console.log("\naba Desenhar: as ferramentas de traço num lugar só");
{
  const fita = ler("src/powerpoint/ui/fita.ts");
  const ppt = ler("src/powerpoint/powerpoint.ts");
  const estado = ler("src/powerpoint/ui/estado.ts");
  checa(
    "a fita ganhou a aba Desenhar logo depois de Inserir",
    /\{ id: "inserir", nome: "Inserir" \},\r?\n\s*\{ id: "desenhar", nome: "Desenhar" \}/.test(fita) && /data-painel="desenhar" hidden>\$\{this\.desenhar\(\)\}/.test(fita),
    "aba ou painel ausentes"
  );
  checa(
    "as canetas (Draw e Curva) moram na aba",
    /private desenhar\(\): string/.test(fita) &&
      /grupo\(\r?\n\s*"Canetas",[\s\S]{0,400}grande\("desenho", ic\("i-draw"\)/.test(fita) &&
      /grande\("ferramenta:curva", ic\("i-curve"\)/.test(fita)
  );
  checa(
    "Draw e Curva SAÍRAM do Inserir",
    !/grupo\("Desenho",/.test(fita) && !/pequeno\("ferramenta:curva"/.test(fita),
    "o botão antigo do Inserir ficaria duplicado"
  );
  checa(
    "o Traço traz cor, espessuras, Livre/Pontos e o Assistente",
    /btn\("pincel:cor",[\s\S]{0,120}data-barra="pincel-cor"/.test(fita) &&
      /btn\("pincel:w:1"/.test(fita) &&
      /btn\("pincel:w:8"/.test(fita) &&
      /btn\("pincel:modo:livre"/.test(fita) &&
      /btn\("pincel:modo:pontos"/.test(fita) &&
      /grande\("pincel-assistente"/.test(fita)
  );
  checa(
    "a cor do traço abre a mesma paleta do pincel",
    /case "pincel:cor":[\s\S]{0,220}abrirCores\(ancora,[\s\S]{0,120}titulo: "Cor do traço"[\s\S]{0,80}run\("pincel-cor"/.test(fita),
    "sem a paleta o botão não escolhe cor"
  );
  checa(
    "os comandos do pincel chegam ao host com o valor certo",
    /cmd\.startsWith\("pincel:w:"\)\) this\.hooks\.run\("pincel-w", cmd\.slice\(9\)\)/.test(fita) &&
      /cmd\.startsWith\("pincel:modo:"\)\) this\.hooks\.run\("pincel-modo", cmd\.slice\(12\)\)/.test(fita)
  );
  checa(
    "o host mexe no MESMO estado do pincel (aba e barrinha juntas)",
    /case "pincel-cor":/.test(ppt) &&
      /case "pincel-w":/.test(ppt) &&
      /case "pincel-modo":/.test(ppt) &&
      /case "pincel-assistente":/.test(ppt) &&
      /private atualizarPincel\(\): void \{\r?\n\s*\/\/ a aba Desenhar mostra o mesmo estado: atualiza os botões dela junto com a barrinha\r?\n\s*this\.fita\.atualizar\(\)/.test(ppt),
    "sem isso a aba e a barrinha divergem"
  );
  checa(
    "o estado do pincel chega à fita (cor, espessura, modo, assistente e tipo)",
    /pincel: \{ cor: string; w: number; modo: "livre" \| "pontos"; assistente: boolean; tipo: "caneta" \| "marca" \}/.test(estado) &&
      /pincel: \{ cor: this\.pincelUsado\(\)\.cor, w: this\.pincel\.w, modo:/.test(ppt)
  );
  checa(
    "os botões da aba acendem com o estado",
    /on\("desenho", st\.ferramenta\?\.tipo === "desenho"\)/.test(fita) &&
      /on\("ferramenta:curva", st\.ferramenta\?\.tipo === "curva"\)/.test(fita) &&
      /on\("pincel-assistente", st\.pincel\.assistente\)/.test(fita) &&
      /for \(const w of \[1, 2, 4, 8\]\) on\(`pincel:w:\$\{w\}`, st\.pincel\.w === w\)/.test(fita) &&
      /barraPincel\.style\.background = `#\$\{st\.pincel\.cor\}`/.test(fita)
  );
  // o corpo de cada aba (as checagens olham a ABA, não o arquivo inteiro: o mesmo comando vive no Inserir)
  const corpoDesenhar = fita.slice(fita.indexOf("private desenhar()"), fita.indexOf("private tabela()"));
  const corpoInserir = fita.slice(fita.indexOf("private inserir()"), fita.indexOf("private desenhar()"));
  checa(
    "a aba Desenhar NÃO repete o que é da Inserir (o diagrama saiu daqui)",
    !/grupo\(\r?\n\s*"Diagrama",/.test(corpoDesenhar) && !/mermaid-fluxo/.test(corpoDesenhar),
    "o atalho de Mermaid/Conectar repetia o grupo Diagrama do Inserir e enchia a fita"
  );
  checa(
    "e os comandos continuam na fita, na aba Inserir (mudança de LUGAR, não de existência)",
    /mermaid-fluxo/.test(corpoInserir) && /grupo\(\r?\n\s*"Diagrama",/.test(corpoInserir) && /forma-rapida:0/.test(corpoInserir) && /forma-rapida:5/.test(corpoDesenhar),
    "o Fluxo do Mermaid tem de continuar no Inserir, e as formas rápidas na aba Desenhar"
  );
  checa(
    "a prévia do traço é o mesmo desenho do final (pt e suave, com o encaixe do assistente)",
    /svgPathDePontos\(pontosDoDesenhoLivre\(paraPt\(this\.traco\), !!ctx\.pincel\?\.assistente\)\)/.test(palcoPpt) &&
      /viewBox="0 0 \$\{ctx\.dim\.w\} \$\{ctx\.dim\.h\}"/.test(palcoPpt) &&
      !/vector-effect="non-scaling-stroke"/.test(palcoPpt),
    "no zoom alto a prévia saía fina e serrilhada enquanto o traço final era grosso e curvo"
  );
  const desenhoPpt = ler("src/powerpoint/edicao/desenho.ts");
  checa(
    "o encaixe nos eixos roda ANTES do RDP (senão o trecho quase reto não tem corrida para alinhar)",
    /function simplificarLivre\(/.test(desenhoPpt) &&
      /return simplificarLivre\(encaixar \? alinharPontos\(suave\) : suave, bb\)/.test(desenhoPpt),
    "o \"L\" desenhado quase reto volta a sair torto"
  );
  checa(
    "o duplo clique termina a curva aberta (e o clique do Livre não marca nó)",
    !/this\.pontosCurva = \[pSnap\]/.test(palcoPpt) &&
      !/cursorCurva/.test(palcoPpt) &&
      /ultimoToqueCurva[\s\S]{0,320}finalizarCurva\(\)/.test(palcoPpt),
    "sem isso só fechando o círculo dava para terminar (e o clique virava nó)"
  );
  checa(
    "o clique com a caneta em Livre não cai no modo Pontos (nem herda a curva em andamento)",
    /tipo === "desenho" && this\.modoDesenho === "pontos"\)\)/.test(palcoPpt) &&
      !/modoDesenho === "pontos" \|\| this\.pontosCurva\.length > 0/.test(palcoPpt) &&
      /if \(modo !== this\.modoDesenho\) this\.limparCurva\(\);/.test(palcoPpt),
    "os pontos pendentes pegariam o próximo clique no modo Livre"
  );
}

console.log("\ntinta: marca-texto, borracha e converter em forma");
{
  const fita = ler("src/powerpoint/ui/fita.ts");
  const ppt = ler("src/powerpoint/powerpoint.ts");
  const palco = ler("src/powerpoint/stage.ts");
  const css = ler("src/styles/powerpoint-edicao.css");
  const desenho = ler("src/powerpoint/edicao/desenho.ts");
  const schema = ler("src/powerpoint/schema.ts");
  checa(
    "a aba Desenhar tem Marca-texto, Borracha e Converter em forma",
    /grande\("pincel-tipo:marca", ic\("i-mark"\), "Marca-texto"/.test(fita) &&
      /grande\("borracha", ic\("i-trash"\), "Borracha"/.test(fita) &&
      /grupo\(\r?\n\s*"Converter",[\s\S]{0,200}grande\("tinta-forma"/.test(fita)
  );
  checa("o despacho leva o tipo do pincel ao host", /cmd\.startsWith\("pincel-tipo:"\)\) this\.hooks\.run\("pincel-tipo", cmd\.slice\(12\)\)/.test(fita));
  checa(
    "a barrinha tem Caneta/Marca e o host troca o tipo",
    /data-pincel-tipo="caneta"/.test(ppt) &&
      /data-pincel-tipo="marca"/.test(ppt) &&
      /case "pincel-tipo":/.test(ppt) &&
      /this\.pincel\.tipo = value === "marca" \? "marca" : "caneta"/.test(ppt)
  );
  checa(
    "os botões da aba acendem com o tipo e com a borracha",
    /on\("pincel-tipo:marca", st\.ferramenta\?\.tipo === "desenho" && st\.pincel\.tipo === "marca"\)/.test(fita) &&
      /on\("borracha", st\.ferramenta\?\.tipo === "borracha"\)/.test(fita) &&
      /dis\("tinta-forma", !st\.formas\.some\(\(f\) => !!f\.tinta\)\)/.test(fita)
  );
  checa(
    "a borracha é uma ferramenta do palco (modo + hook)",
    /export type Ferramenta = [\s\S]{0,200}\{ tipo: "borracha" \}/.test(palco) &&
      /\{ t: "borracha" \}/.test(palco) &&
      /aoApagarTinta: \(id: string\) => void;/.test(palco) &&
      /if \(ctx\.ferramenta\.tipo === "borracha"\)/.test(palco) &&
      /private apagarEm\(e: PointerEvent\): void \{/.test(palco) &&
      /elementFromPoint\(e\.clientX \+ dx, e\.clientY \+ dy\)/.test(palco),
    "sem o modo no palco a borracha não apaga no arrasto"
  );
  checa(
    "o host apaga SÓ traço de tinta, com desfazer",
    /private aoApagarTinta\(id: string\): void \{[\s\S]{0,300}if \(!s\?\.tinta \|\| s\.bloqueada\) return;[\s\S]{0,200}this\.registrar\(\)/.test(ppt),
    "uma forma comum embaixo da borracha não pode sumir"
  );
  checa(
    "converter em forma avisa quando não reconhece e converte com desfazer",
    /case "tinta-forma": \{/.test(ppt) &&
      /O assistente não reconheceu o traço/.test(ppt) &&
      /patchFormas\(sl, ids, \(f\) => patches\.get\(f\.id\) \?\? \{\}\), "tinta-forma"\)/.test(ppt) &&
      /const nova = formaDaTinta\(s, this\.dim\(\)\)/.test(ppt)
  );
  checa(
    "o pincel do marca-texto é largo e translúcido (e não vira forma)",
    /export const MARCA_ALFA = 0\.4/.test(desenho) &&
      /export const MARCA_ESPESSURA = 3/.test(desenho) &&
      /const rec = pincel\.assistente && !marca \? reconhecerTraco\(pontos\) : null;/.test(desenho) &&
      /pontosDoDesenhoLivre\(pontos, pincel\.assistente && !marca\)/.test(desenho)
  );
  checa(
    "o traço guarda os pontos (é o que a borracha e o converter usam)",
    /tinta\?: \{ x: number; y: number; reto\?: boolean \}\[\];/.test(schema) &&
      /s\.tinta = pontos\.map\(\(p\) => \(\{ x: p\.x, y: p\.y/.test(desenho) &&
      /export function formaDaTinta\(s: Shape, d: Dim\): Partial<Shape> \| null/.test(desenho)
  );
  checa(
    "com a borracha a barrinha vira só a dica e o cursor vira mira",
    /barra\.classList\.toggle\("pp-pincel-so-dica", ehBorracha\)/.test(ppt) &&
      /this\.frame\?\.classList\.toggle\("pp-borracha", ehBorracha\)/.test(ppt) &&
      /\.pp-pincel\.pp-pincel-so-dica > :not\(\[data-pincel-dica\]\)\s*\{[^}]*display:\s*none/.test(css) &&
      /\.pp-frame\.pp-borracha \.pp-slide[^{]*\{[^}]*cursor:\s*crosshair/.test(css)
  );
  checa(
    "o Assistente fica apagado no marca-texto (ele não reconhece forma)",
    /pp-pincel-assist\.pp-fora/.test(css) && /classList\.toggle\("pp-fora", marca\)/.test(ppt)
  );
}

// ---------------------------------------------------------------- histórico: o documento, não o JSON

console.log("\nhistórico: a alteração mostra o documento (não a serialização)");

{
  const hist = ler("src/app/historySearch.ts");
  const snaps = ler("src/snapshots.ts");
  checa(
    "o tipo do histórico vem do arquivo (extensão), não da aba ativa",
    /\/\\\.pptx\?\$\/i\.test\(path\)/.test(hist) && /\/\\\.docx\$\/i\.test\(path\)/.test(hist),
    "pela aba, a projeção legível podia não entrar e o diff mostrava o JSON"
  );
  checa(
    "o texto legível tenta o projetor do tipo e os outros, e barra o JSON cru",
    /function textoLegivel\(app: App, texto: string, tipo: string\)/.test(hist) &&
      /projetores\.push\(\(t\) => app\.pptHost\.projection\(t\), \(t\) => app\.excelHost\.projection\(t\), \(t\) => app\.wordProjection\(t\)\)/.test(hist) &&
      /return \/\^\\s\*\\\{\\s\*"v"\\s\*:\/\.test\(texto\) \? "" : texto/.test(hist),
    "sem o guarda, o JSON cru volta para a tela"
  );
  checa(
    "a aba Alterações usa o texto legível no diff",
    /const project = \(text: string\) => textoLegivel\(this, text, tipo\)/.test(hist),
    "o diff voltaria a mostrar a serialização"
  );
  checa(
    "o nome da alteração sai do documento (no fecho da pausa)",
    /resumo = nomeDaAlteracao\(\s*tipo \?\? "doc",\s*projetar \? projetar\(anterior\) : anterior,\s*projetar \? projetar\(texto\) : texto\s*\)/.test(hist) &&
      /pendente = \{ path, texto, projetar, tipo \}/.test(hist) &&
      /summary: ehAncora \? "marco do documento" : opts\.resumo \|\| summarize\(ops\)/.test(snaps),
    "a lista voltaria a mostrar os números no lugar do nome"
  );
}

console.log("\nfechar todos: o app fica sem nenhuma aba, no Início");
{
  const abas = ler("src/app/tabs.ts");
  // o trecho do restoreSession (do começo do método até o addTabFor): é ali que o
  // "sem sessão" decide entre abrir no Início e criar a aba "Sem título"
  const restaura = abas.slice(abas.indexOf("async restoreSession"), abas.indexOf("/** Cria uma aba"));
  const comandos = ler("src/app/commands.ts");
  const atalhos = ler("src/app/keymap.ts");
  const paginas = ler("src/app/pages.ts");
  const layout = ler("src/app/layout.ts");
  checa(
    "fechar a última aba NÃO cria um 'Sem título' na fileira",
    /const fechouTudo = !this\.tabs\.length;\r?\n\s*if \(fechouTudo\) this\.tab = newTab\(this\.editor\.createState\(""\)\);/.test(abas) &&
      !/if \(fechouTudo\) this\.tabs\.push\(newTab/.test(abas),
    "a aba vazia volta a aparecer na fileira"
  );
  checa(
    "a ativação depois de fechar aceita a fileira vazia",
    /await this\.activate\(this\.tabs\[Math\.min\(index, this\.tabs\.length - 1\)\] \?\? this\.tab\)/.test(abas),
    "sem o fallback, fechar a última quebra a ativação"
  );
  checa("existe o 'Fechar todos' (método, menu, paleta e atalho)", /async closeAll\(this: App\): Promise<void>/.test(abas) && /label: "Fechar todos"/.test(abas) && /"Fechar todos os documentos", \(\) => void this\.closeAll\(\)/.test(comandos) && /id: "fechar-tudo"/.test(atalhos) && /padrao: "Ctrl\+Shift\+W"/.test(atalhos));
  checa(
    "iniciar sem sessão abre no Início, sem aba",
    /this\.showHome\(\);/.test(restaura) &&
      /if \(!this\.path && !this\.dirty && this\.tabs\.length === 1 && this\.tabs\[0\] === this\.tab\) \{\r?\n\s*this\.tabs = \[\];\r?\n\s*this\.afterTabChange\(\);/.test(restaura),
    "sem o ramo, a aba 'Sem título' volta a aparecer ao abrir o app"
  );
  checa("fechar as Configurações sem documento volta ao Início", /if \(!this\.tabs\.length\) this\.showHome\(\);/.test(paginas));
  checa(
    "os comandos de documento avisam em vez de agir no vazio",
    /semDocumento\(this: App\): boolean/.test(abas) &&
      /toast\("Nenhum documento aberto — crie ou abra um no Início\."/.test(abas) &&
      /async save\(this: App, saveAs = false\): Promise<boolean> \{\r?\n\s*if \(this\.semDocumento\(\)\) return false;/.test(ler("src/app/documents.ts")) &&
      /openExport\(this: App, format\?: ExportFormat\): void \{\r?\n\s*if \(this\.semDocumento\(\)\) return;/.test(ler("src/app/aiContext.ts")) &&
      /async openDraw\(this: App\): Promise<void> \{\r?\n\s*if \(this\.semDocumento\(\)\) return;/.test(ler("src/app/drawing.ts")) &&
      /openSlides\(this: App\): void \{\r?\n\s*if \(this\.semDocumento\(\)\) return;/.test(paginas) &&
      /insertImageFromDialog\(this: App\): Promise<void> \{\r?\n\s*if \(this\.semDocumento\(\)\) return;/.test(ler("src/app/media.ts")) &&
      /openReview\(this: App\): void \{\r?\n\s*if \(this\.semDocumento\(\)\) return;/.test(ler("src/app/assistant.ts")),
    "salvar/exportar/desenhar/imagem/revisar não podem agir num documento que não está à vista"
  );
  checa(
    "a barra de formatação também é barrada",
    /name !== "palette" && name !== "translate-settings" && name !== "export" && this\.semDocumento\(\)/.test(ler("src/app/toolbar.ts"))
  );
  checa(
    "a barra de status fala de 'nenhum documento'",
    /if \(!this\.tabs\.length\) \{\r?\n\s*\$\("#st-words"\)\.textContent = "Nenhum documento aberto";/.test(layout) &&
      /if \(!this\.tabs\.length\) \{\r?\n\s*el\.textContent = "Nenhum documento aberto";/.test(layout) &&
      /const title = this\.tabs\.length \?/.test(layout)
  );
}

// ---------------------------------------------------------------- dica: aninhada e saída suave

console.log("\ndica: títulos aninhados não piscam e a saída é suave");

{
  const dica = ler("src/dica.ts");
  const css = ler("src/styles/base.css");
  checa(
    "mexer dentro do dono atual não troca a dica (títulos aninhados)",
    /if \(dono && dono !== alvo && dono\.contains\(alvo\)\) return;/.test(dica),
    "cada passada sobre o filho escondia e reabria o balão (o piscar do relato)"
  );
  checa(
    "a saída esvanece antes de sair do fluxo",
    /const SAIDA_MS = \d+/.test(dica) &&
      /balao\.classList\.add\("saindo"\)/.test(dica) &&
      /relogioSair = janela\.setTimeout\([\s\S]{0,200}balao\.hidden = true;[\s\S]{0,120}classList\.remove\("saindo"\)/.test(dica),
    "o balão sumia de uma vez (sem esvanezer)"
  );
  checa(
    "reabrir cancela a saída pendente",
    /janela\.clearTimeout\(relogioSair\);[\s\S]{0,120}balao\.hidden = false/.test(dica),
    "um mostrar logo depois do esconder sumiria pelo timer antigo"
  );
  checa("a folha tem a transição da saída (e respeita reduced-motion)", /\.dica\.saindo \{[\s\S]{0,120}opacity: 0/.test(css), "sem a regra, a classe não faz nada");
}

// ---------------------------------------------------------------- animação por forma (seleção)

console.log("\nPowerPoint: animação vai para toda a seleção (e a exportação leva)");

{
  const ppt = ler("src/powerpoint/powerpoint.ts");
  const fita = ler("src/powerpoint/ui/fita.ts");
  checa(
    "os ajustes de animação valem para TODA a seleção (não só a forma principal)",
    /private editarAnimacoesDaSelecao\(/.test(ppt) &&
      /const ids = comGrupos\(this\.atual\(\), this\.selecao\);/.test(ppt) &&
      !/mudarInicioAnimacao\(inicio: AnimacaoInicio\): void \{\r?\n\s+const f = this\.principal\(\)/.test(ppt),
    "com duas formas escolhidas, a segunda ficava com o efeito original"
  );
  checa(
    "o Remover leva a lista vazia a sério (undefined = limpou o campo)",
    /private removerAnimacao\([\s\S]{0,700}let nova: Animacao\[\] \| undefined = lista;[\s\S]{0,140}for \(const id of ids\) nova = semAnimacao\(nova, id\);/.test(ppt),
    "a última forma da seleção ficava com a animação"
  );
  checa(
    "a aba Transições não traz mais a mensagem 'Transição é da lâmina'",
    !/Transição é da lâmina/.test(fita),
    "a mensagem na aba Transições foi removida a pedido"
  );
  checa(
    "a aba Animações não traz mais a mensagem 'A animação vale para as formas escolhidas'",
    !/A animação vale para as formas escolhidas/.test(fita) && !/data-anim-nota-base/.test(fita),
    "a mensagem na aba Animações foi removida a pedido"
  );
  const popupPpt = ler("src/powerpoint/ui/popup.ts");
  const cssBase = ler("src/styles/base.css");
  const cssFita = ler("src/styles/fita.css");
  const cssEdicao = ler("src/styles/powerpoint-edicao.css");
  const fitaGlobal = ler("src/fita.ts");
  checa(
    "o popup fecha no pointerdown e o clique direito no vazio da lâmina não abre 'Colar / Selecionar tudo'",
    /addEventListener\("pointerdown", fora, true\)/.test(popupPpt) &&
      /if \(!forma \|\| \(forma\.fixa && !this\.fixas\)\) return;/.test(ppt) &&
      !/\["sel-tudo", "Selecionar tudo"/.test(ppt),
    "o popup ficava preso na tela e aparecia ao navegar com o botão direito"
  );
  checa(
    "a aba Desenhar usa controles segmentados no Traço e grade compacta nas Formas rápidas",
    /ppr-traco-grade/.test(fita) && /ppr-formas-rapidas/.test(fita) && /\.ppr-formas-rapidas\s*\{[\s\S]{0,120}display:\s*grid/.test(cssEdicao),
    "a aba Desenhar voltaria a espalhar os botões em colunas altas"
  );
  checa(
    "o ajuste da fita é unificado entre abas, usa cache de larguras e os grupos recolhidos encolhem sem cortar Formas",
    /cacheLarguras = new WeakMap/.test(fitaGlobal) &&
      /const compacta = escala < 0\.88/.test(fitaGlobal) &&
      /\.fita-grupo-recolhido\s*\{[\s\S]{0,120}flex:\s*0 1 auto/.test(cssFita),
    "as abas voltariam a mudar de tamanho ao alternar ou empurrariam Formas para fora"
  );
  checa(
    "a interface e as formas fora de edição têm user-select: none para não marcar texto em azul",
    /body\s*\{[\s\S]{0,300}user-select:\s*none/.test(cssBase) &&
      /\.pp-shape,\r?\n\.pp-shape \*\s*\{[\s\S]{0,80}user-select:\s*none/.test(cssEdicao),
    "os textos dos botões e das formas voltariam a parecer marcados"
  );
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
