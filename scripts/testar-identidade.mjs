// Testa a identidade e o aviso de marcas:
//   1) o aviso de não afiliação existe no README e na tela Início (a mesma frase nos dois);
//   2) o logo aparece no README (o arquivo referenciado existe) e na Início (a marca no cabeçalho);
//   3) as cores e os ícones dos módulos são PRÓPRIOS — nenhum hex do Office no src, nenhuma
//      letra W/X/P numa chapa colorida, e as placas vêm dos tokens de identidade.
//
// Uso: node scripts/testar-identidade.mjs
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ler = (rel) => readFileSync(join(raiz, rel), "utf8");

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

/** Todos os .ts/.css de src/ (o app inteiro, não só a Início). */
const arquivos = [];
const andar = (dir) => {
  for (const nome of readdirSync(join(raiz, dir))) {
    const rel = join(dir, nome).replace(/\\/g, "/");
    const st = statSync(join(raiz, rel));
    if (st.isDirectory()) andar(rel);
    else if (/\.(ts|css)$/.test(nome)) arquivos.push(rel);
  }
};
andar("src");

// ---------------------------------------------------------------- 1) o aviso

console.log("aviso de marcas (Microsoft)");

const AVISO_A = "não é afiliado, patrocinado nem endossado pela Microsoft";
const AVISO_B = "são marcas da Microsoft Corporation";

const readme = ler("README.md");
const home = ler("src/homePage.ts");

ok("o README tem a frase do aviso", readme.includes(AVISO_A) && readme.includes(AVISO_B));
ok("a tela Início (rodapé) tem a mesma frase", home.includes(AVISO_A) && home.includes(AVISO_B));
ok(
  "o aviso é o mesmo nos dois (palavra por palavra)",
  readme.includes("**mdOffice** não é afiliado") && home.includes("<strong>mdOffice</strong> não é afiliado"),
  "no README em negrito markdown; na Início em <strong>"
);

// ---------------------------------------------------------------- 2) o logo aparece

console.log("\nlogo na página");

const logoClaro = "public/icones/mdoffice-claro.png";
const logoEscuro = "public/icones/mdoffice-escuro.png";
ok(
  "o README mostra o logo (claro e escuro, pelo tema do GitHub)",
  readme.includes(logoClaro) && readme.includes(logoEscuro) && readme.includes("prefers-color-scheme: dark"),
  "antes o cabeçalho só tinha o texto MDOFFICE (nenhuma imagem)"
);
ok("os PNGs do logo existem no repositório", existsSync(join(raiz, logoClaro)) && existsSync(join(raiz, logoEscuro)));
ok(
  "a Início desenha a marca no cabeçalho",
  /class="home-brand"/.test(home) && /class="home-brand-mark"/.test(home) && /home-brand-nome">mdOffice</.test(home)
);
ok(
  "o ícone do executável tem fonte vetorial e os ícones gerados",
  existsSync(join(raiz, "app-icon.svg")) && existsSync(join(raiz, "src-tauri/icons/icon.png")) && existsSync(join(raiz, "src-tauri/icons/icon.ico")),
  "o PNG de 1024 é artefato (ignorado); a fonte é o app-icon.svg"
);

// ---------------------------------------------------------------- 3) identidade própria

console.log("\nidentidade própria (sem imitar o Office)");

// Os hexes que o app usava — todos são (ou são a versão escura de) cores das marcas do Office.
const HEXES_DO_OFFICE = [
  "185ABD", // azul do Word
  "2B579A", // azul do Word (versão antiga)
  "103F91", // azul escuro da chapa do Word
  "0F6CBD", // azul Fluent Word Online
  "2B6CE4", // azul antes usado nos ícones do Word
  "107C41", // verde do Excel
  "0E5C2F", // verde escuro da chapa do Excel
  "16A34A", // verde antes usado nos ícones do Excel
  "1B8A4B", // verde antes usado como fallback na fita do Excel
  "C43E1C", // laranja do PowerPoint
  "8E2A12", // laranja escuro da chapa do PowerPoint
  "D24A17", // laranja-avermelhado antes usado como fallback no PowerPoint
  "0284C7", // azul do "Markdown"
  "0D4E7A", // azul escuro da chapa do "Markdown"
  "7DD3FC",
  "8CB5F8",
  "72D699",
  "FCA585",
];
const achados = [];
for (const rel of arquivos) {
  const texto = ler(rel).toUpperCase();
  for (const hex of HEXES_DO_OFFICE) if (texto.includes(hex)) achados.push(`${rel}: #${hex}`);
}
ok("nenhuma cor das marcas do Office no src", achados.length === 0, achados.slice(0, 6).join(", "));
ok("a paleta dos módulos é própria (tokens.css)", ["--mod-md", "--mod-word", "--mod-excel", "--mod-ppt", "--mod-word-placa"].every((v) => ler("src/styles/tokens.css").includes(v)));
ok(
  "os cartões usam as placas da identidade (não letra em quadrado colorido)",
  ["--mod-word-placa", "--mod-excel-placa", "--mod-md-placa", "--mod-ppt-placa"].every((v) => home.includes(v)) &&
    !/>W<\/text>/.test(home) &&
    !/>X<\/text>/.test(home) &&
    !/>P<\/text>/.test(home)
);
ok("o botão de salvamento automático usa a cor do app", /\.tb-autosave-track[\s\S]{0,200}background: var\(--accent\)/.test(ler("src/styles/topbar.css").replace(/\n/g, " ")));
ok("o comentário 'Office Word Blue' saiu", !arquivos.some((rel) => ler(rel).includes("Office Word Blue")));

// o boot e o ícone também são da identidade nova (leque da suíte + centelha de IA)
const boot = ler("index.html");
ok("a tela de carregamento usa a marca nova (suíte com leque e centelha de IA, sem azul do Office)", boot.includes('rx="14" fill="#4F46E5"') && boot.includes("#0891B2") && boot.includes("#E11D48") && !boot.includes("#0D4E7A"));
const svgIcone = ler("app-icon.svg");
ok(
  "o app-icon.svg representa a suíte completa (leque de planilha, apresentação, documento e IA no gradiente da marca)",
  svgIcone.includes("#4F46E5") && svgIcone.includes("#7C3AED") && svgIcone.includes("#C026D3") && svgIcone.includes("#0891B2") && svgIcone.includes("#E11D48")
);

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
