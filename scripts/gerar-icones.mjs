// Gera a marca do mdOffice: o SVG (fonte), o app-icon.png e os dois PNGs da tela de
// Configurações, e regenera os ícones do Tauri (src-tauri/icons).
//
// A paleta é a do app (índigo → violeta → fúcsia), de propósito longe do azul, verde e
// laranja das marcas do Office: o mdOffice não é afiliado, patrocinado nem endossado pela
// Microsoft. Nada de letra numa chapa colorida (a linguagem dos ícones do Office): aqui a
// folha é a mesma do editor e o "M↓" é a marca do produto.
//
// Uso: node scripts/gerar-icones.mjs
//      (precisa do Chrome instalado; depois roda `tauri icon` para os tamanhos do Windows/macOS)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });

/** A folha com o "M↓" — o desenho que vale do ícone do executável ao cartão da Início. */
const folha = (stroke = "rgba(79,70,229,.22)") => `
  <rect x="300" y="196" width="424" height="632" rx="52" fill="#FFFFFF" stroke="${stroke}" stroke-width="3"/>
  <path d="M372 556V400l76 86 76-86v156" fill="none" stroke="#4F46E5" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M636 400v148m0 0l-54-54m54 54l54-54" fill="none" stroke="#7C3AED" stroke-width="48" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="372" y="650" width="280" height="30" rx="15" fill="#C4B5FD"/>
  <rect x="372" y="708" width="206" height="30" rx="15" fill="#C4B5FD"/>
  <rect x="372" y="766" width="244" height="30" rx="15" fill="#DDD6FE"/>
`;

const svg = (corpo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${corpo}</svg>`;

const gradiente = `
    <defs>
      <linearGradient id="marca" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4F46E5"/>
        <stop offset="0.55" stop-color="#7C3AED"/>
        <stop offset="1" stop-color="#C026D3"/>
      </linearGradient>
    </defs>`;

/** O ícone do executável: chapa em gradiente (sem fundo transparente fora dos cantos). */
const appIcon = svg(`${gradiente}
  <rect x="16" y="16" width="992" height="992" rx="240" fill="url(#marca)"/>
  ${folha("none")}`);

/** As duas chapas da tela de Configurações (clara e escura), com a mesma folha. */
const placa = (cor) => svg(`${gradiente}
  <rect x="16" y="16" width="992" height="992" rx="240" fill="${cor}"/>
  ${folha()}`);

/** Página com o SVG no tamanho exato, fundo transparente (o Chrome tira a foto nítida). */
const pagina = (marca, px) => `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:transparent}svg{display:block;width:${px}px;height:${px}px}</style>${marca}`;

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const foto = (html, saida, px) => {
  const arquivo = join(temp, "marca.html");
  writeFileSync(arquivo, html, "utf8");
  execFileSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    `--window-size=${px},${px}`,
    "--default-background-color=00000000",
    "--screenshot=" + join(raiz, saida),
    "--virtual-time-budget=800",
    "file:///" + arquivo.replace(/\\/g, "/"),
  ]);
  console.log(`ok  ${saida}  (${px}×${px})`);
};

writeFileSync(join(raiz, "app-icon.svg"), appIcon, "utf8");
console.log("ok  app-icon.svg");
foto(pagina(appIcon, 1024), "app-icon.png", 1024);
foto(pagina(placa("#F4F5F8"), 256), join("public", "icones", "mdoffice-claro.png"), 256);
foto(pagina(placa("#0E1014"), 256), join("public", "icones", "mdoffice-escuro.png"), 256);

execFileSync("npx", ["tauri", "icon", "app-icon.png"], { cwd: raiz, stdio: "inherit", shell: true });
console.log("ok  src-tauri/icons regenerado");
