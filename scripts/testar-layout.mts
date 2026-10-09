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

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
