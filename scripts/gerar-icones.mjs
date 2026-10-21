// Gera a marca do mdOffice: o SVG (fonte), o app-icon.png, os dois PNGs da tela de
// Configurações/Início e os ícones do PWA (192 e 512).
//
// O desenho reflete o que o mdOffice se tornou: uma suíte completa de documentos
// (Documentos, Planilhas, Apresentações e Markdown) com escrita assistida e IA local —
// representada pelo leque simétrico de três folhas (planilha à esquerda em ciano-petróleo,
// lâmina com gráfico à direita em rosa-rubi e folha central de escrita com o monograma "M",
// linhas de documento e a centelha de IA em fúcsia/violeta).
//
// Uso: node scripts/gerar-icones.mjs  (precisa do Chrome instalado)
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });

/**
 * Composição da suíte mdOffice:
 * - Folha esquerda inclinada (-11°): Planilhas (grade em ciano-petróleo #0891B2)
 * - Folha direita inclinada (+11°): Apresentações (barras de gráfico em rosa-rubi #E11D48)
 * - Folha central em primeiro plano: Documentos + Markdown + centelha de IA (#6D28D9 / #7C3AED / #C026D3)
 */
const suite = (bordaFolha = "rgba(109,40,217,.22)", fundoLateral = "#FAF9FC") => `
  <!-- Folha esquerda: Planilhas (grade ciano-petróleo) -->
  <g transform="translate(512 560) rotate(-12) translate(-512 -560)">
    <rect x="164" y="248" width="320" height="460" rx="40" fill="${fundoLateral}" stroke="#0891B2" stroke-width="10" stroke-opacity="0.45"/>
    <rect x="200" y="292" width="210" height="36" rx="10" fill="#0891B2"/>
    <rect x="200" y="346" width="98" height="44" rx="8" fill="#CFFAFE" stroke="#0891B2" stroke-width="6"/>
    <rect x="312" y="346" width="98" height="44" rx="8" fill="#E0F2FE" stroke="#0891B2" stroke-width="6"/>
    <rect x="200" y="404" width="98" height="44" rx="8" fill="#E0F2FE" stroke="#0891B2" stroke-width="6"/>
    <rect x="312" y="404" width="98" height="44" rx="8" fill="#CFFAFE" stroke="#0891B2" stroke-width="6"/>
    <rect x="200" y="462" width="98" height="44" rx="8" fill="#CFFAFE" stroke="#0891B2" stroke-width="6"/>
  </g>

  <!-- Folha direita: Apresentações (lâmina e gráfico rosa-rubi) -->
  <g transform="translate(512 560) rotate(12) translate(-512 -560)">
    <rect x="548" y="248" width="320" height="460" rx="40" fill="${fundoLateral}" stroke="#E11D48" stroke-width="10" stroke-opacity="0.45"/>
    <rect x="656" y="292" width="176" height="32" rx="10" fill="#FFE4E6"/>
    <rect x="688" y="446" width="38" height="78" rx="10" fill="#FDA4AF"/>
    <rect x="740" y="398" width="38" height="126" rx="10" fill="#F43F5E"/>
    <rect x="792" y="346" width="38" height="178" rx="10" fill="#E11D48"/>
    <path d="M694 416 L756 368 L816 322" fill="none" stroke="#E11D48" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <!-- Folha central: Documentos + Markdown + Escrita assistida por IA -->
  <rect x="292" y="184" width="440" height="656" rx="52" fill="#FFFFFF" stroke="${bordaFolha}" stroke-width="8"/>
  <!-- Cabeçalho sutil da folha -->
  <rect x="348" y="240" width="144" height="22" rx="11" fill="#EDE9FE"/>
  <!-- Monograma M + pena/estrutura do mdOffice -->
  <path d="M364 520V344l88 98 88-98v176" fill="none" stroke="url(#traco)" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
  <!-- Centelha de IA / escrita assistida -->
  <path d="M636 306 L652 354 L700 370 L652 386 L636 434 L620 386 L572 370 L620 354 Z" fill="#C026D3"/>
  <circle cx="684" cy="312" r="12" fill="#0891B2"/>
  <!-- Linhas de texto e estrutura -->
  <rect x="364" y="596" width="296" height="28" rx="14" fill="#7C3AED" fill-opacity="0.85"/>
  <rect x="364" y="650" width="224" height="28" rx="14" fill="#C026D3" fill-opacity="0.55"/>
  <rect x="364" y="704" width="264" height="28" rx="14" fill="#0891B2" fill-opacity="0.45"/>
  <rect x="364" y="758" width="184" height="28" rx="14" fill="#E11D48" fill-opacity="0.40"/>
`;

const svg = (corpo) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${corpo}</svg>`;

const gradiente = `
    <defs>
      <linearGradient id="marca" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4F46E5"/>
        <stop offset="0.5" stop-color="#6D28D9"/>
        <stop offset="0.78" stop-color="#7C3AED"/>
        <stop offset="1" stop-color="#C026D3"/>
      </linearGradient>
      <linearGradient id="traco" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#4F46E5"/>
        <stop offset="0.55" stop-color="#7C3AED"/>
        <stop offset="1" stop-color="#C026D3"/>
      </linearGradient>
    </defs>`;

/** O ícone do executável: chapa em gradiente (sem fundo transparente fora dos cantos). */
const appIcon = svg(`${gradiente}
  <rect x="16" y="16" width="992" height="992" rx="240" fill="url(#marca)"/>
  ${suite("rgba(109,40,217,.18)", "rgba(255,255,255,.94)")}`);

/** As duas chapas da tela de Configurações/Início (clara e escura), com a suíte completa. */
const placa = (cor, bordaPlaca, bordaFolha, fundoLateral) => svg(`${gradiente}
  <rect x="16" y="16" width="992" height="992" rx="240" fill="${cor}" stroke="${bordaPlaca}" stroke-width="12"/>
  ${suite(bordaFolha, fundoLateral)}`);

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
foto(pagina(placa("#F6F4F9", "#E4E0EC", "rgba(109,40,217,.24)", "#FFFFFF"), 256), join("public", "icones", "mdoffice-claro.png"), 256);
foto(pagina(placa("#100E16", "#2D273B", "rgba(167,139,250,.32)", "#F8F7FC"), 256), join("public", "icones", "mdoffice-escuro.png"), 256);
// PWA: o Chrome/Edge pedem 192 e 512 para instalar o app (o mesmo desenho do ícone do .exe).
foto(pagina(appIcon, 512), join("public", "icones", "pwa-512.png"), 512);
foto(pagina(appIcon, 192), join("public", "icones", "pwa-192.png"), 192);
console.log("ok  public/icones (PWA)");
