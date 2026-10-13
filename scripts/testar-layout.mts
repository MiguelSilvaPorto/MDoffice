// Teste das regras de layout que já quebraram: quando o Início abre, ele precisa ocupar
// TODO o espaço, e não dividir a tela com o painel do documento ativo (Excel, Word ou
// PowerPoint). O Word já tinha a regra; faltavam Excel e PowerPoint.
//
// Roda com: npm run test:layout
import { readFileSync } from "node:fs";
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
  /html\.anim-discreta\s*\{[^}]*--mov-2:\s*100ms/.test(mov) && /html\.anim-completa\s*\{[^}]*--mov-2:\s*240ms/.test(mov),
  "durações de discreta/completa ausentes em movimento.css"
);
checa("o nível discreto tira entradas e elevação", /html\.anim-discreta[^{]*\{[^}]*animation:\s*none\s*!important/.test(mov), "regra animation: none ausente");
checa("o nível completo dá mais relevo", /html\.anim-completa[^{]*\{[^}]*translateY\(-2px\)\s*!important/.test(mov), "regra translateY(-2px) ausente");
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

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);