// Testa o posicionamento dos menus da fita (src/powerpoint/ui/popup.ts): o menu abre logo abaixo
// da âncora e NUNCA por cima dela — quando não cabe, ele encolhe (com rolagem interna) em vez de
// subir e tapar o próprio botão (o clique seguinte cairia no menu em vez de reabrir/fechar).
// Uso: node scripts/testar-menus-fita.mjs
import { build } from "esbuild";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const raiz = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const tmp = mkdtempSync(join(tmpdir(), "pp-menus-"));
await build({ entryPoints: [join(raiz, "src/powerpoint/ui/popup.ts")], bundle: true, platform: "node", format: "esm", outfile: join(tmp, "popup.mjs"), logLevel: "error" });
const P = await import(pathToFileURL(join(tmp, "popup.mjs")).href);

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

/** O menu nunca cobre a âncora: ou começa abaixo dela, ou termina antes dela. */
const naoCobre = (r, p, altura) => {
  const usada = Math.min(altura, p.maxAltura ?? altura);
  return p.top >= r.bottom - 0.001 || p.top + usada <= r.top + 0.001;
};

// O botão do Contorno na fita (medido no app: 132x24 em x 539) com o menu alto (533px).
const botao = { left: 539, right: 671, top: 165, bottom: 189 };
const MENU = { w: 330, h: 533 };

{
  // janela com espaço de sobra: abre abaixo, altura natural
  const p = P.posicaoDoPopup(botao, MENU.w, MENU.h, { w: 1384, h: 805 });
  ok("com espaço de sobra, abre abaixo da âncora", p.top === 193 && p.maxAltura === null, JSON.stringify(p));
  ok("e não cobre a âncora", naoCobre(botao, p, MENU.h));
}
{
  // janela baixa (700): não cabe abaixo e em cima há menos ainda — encolhe abaixo (rolagem interna)
  const p = P.posicaoDoPopup(botao, MENU.w, MENU.h, { w: 1384, h: 700 });
  ok("janela baixa: encolhe embaixo em vez de subir por cima do botão", p.top === 193 && p.maxAltura === 499, JSON.stringify(p));
  ok("janela baixa: não cobre o botão", naoCobre(botao, p, MENU.h));
}
{
  // âncora no alto com pouco espaço em cima: também fica embaixo
  const r = { left: 100, right: 232, top: 60, bottom: 84 };
  const p = P.posicaoDoPopup(r, MENU.w, MENU.h, { w: 1000, h: 300 });
  ok("âncora no alto: fica embaixo", p.top === 88 && naoCobre(r, p, MENU.h), JSON.stringify(p));
  ok("e usa o espaço que existe (204px cabem por inteiro)", p.maxAltura === 204, String(p.maxAltura));
}
{
  // âncora no rodapé: lá em cima há MUITO mais espaço — abre acima e termina antes da âncora
  const r = { left: 100, right: 232, top: 700, bottom: 724 };
  const p = P.posicaoDoPopup(r, 240, 300, { w: 1000, h: 780 });
  ok("âncora no rodapé: abre acima", p.top < r.top, JSON.stringify(p));
  ok("âncora no rodapé: termina antes da âncora (não cobre)", p.top + Math.min(300, p.maxAltura ?? 300) === r.top - 4, JSON.stringify(p));
}
{
  // janela minúscula: ainda não cobre (o menu passa da borda de baixo, mas o botão fica livre)
  const r = { left: 10, right: 100, top: 60, bottom: 84 };
  const p = P.posicaoDoPopup(r, 240, 533, { w: 400, h: 200 });
  ok("janela minúscula: não cobre a âncora", naoCobre(r, p, 533), JSON.stringify(p));
  ok("janela minúscula: o menu fica utilizável (rola por dentro)", (p.maxAltura ?? 0) >= 160, String(p.maxAltura));
}
{
  // âncora colada na borda direita: o menu entra para dentro da janela
  const r = { left: 1300, right: 1384, top: 165, bottom: 189 };
  const p = P.posicaoDoPopup(r, MENU.w, MENU.h, { w: 1384, h: 805 });
  ok("na borda direita, o menu entra para dentro", p.left === 1046, String(p.left));
  const pd = P.posicaoDoPopup(r, MENU.w, MENU.h, { w: 1384, h: 805 }, true);
  ok("alinhado à direita, respira a margem", pd.left === 1046, String(pd.left));
  const pe = P.posicaoDoPopup({ left: 0, right: 80, top: 165, bottom: 189 }, MENU.w, MENU.h, { w: 1384, h: 805 });
  ok("na borda esquerda, respira a margem", pe.left === 8, String(pe.left));
}
{
  // varredura: em nenhum tamanho de janela o menu cobre a âncora
  let cobriu = 0;
  for (let h = 200; h <= 1200; h += 50) {
    for (const top of [30, 100, 165, 400, h - 60]) {
      const r = { left: 539, right: 671, top, bottom: top + 24 };
      const p = P.posicaoDoPopup(r, MENU.w, MENU.h, { w: 1384, h });
      if (!naoCobre(r, p, MENU.h)) {
        cobriu++;
        console.log(`      cobriu: janela ${h} · âncora ${top}..${top + 24} →`, JSON.stringify(p));
      }
    }
  }
  ok("varredura de janelas: nenhuma cobre a âncora", cobriu === 0, `${cobriu} caso(s)`);
}

{
  // submenu (menu de contexto → "Organizar"): abre AO LADO do item, nunca no canto da tela.
  // O item fica no rodapé de um menu estreito, no meio da janela.
  const r = { left: 300, right: 540, top: 600, bottom: 628 };
  const p = P.posicaoDoPopup(r, 240, 533, { w: 1384, h: 805 }, false, true);
  ok("submenu abre à direita do item", p.left === 544, JSON.stringify(p));
  ok("submenu não começa no canto superior esquerdo", p.top > 8 && p.left > 8, JSON.stringify(p));
  ok("submenu inteiro cabe na janela", p.top + Math.min(533, p.maxAltura ?? 533) <= 805 - 8, JSON.stringify(p));
}
{
  // sem espaço à direita: abre à esquerda do item (e não sai pela borda)
  const r = { left: 1300, right: 1384, top: 300, bottom: 328 };
  const p = P.posicaoDoPopup(r, 240, 300, { w: 1384, h: 805 }, false, true);
  ok("submenu sem espaço à direita abre à esquerda", p.left === 1056, JSON.stringify(p));
}
{
  // menu mais alto que a janela: começa na margem e rola por dentro
  const p = P.posicaoDoPopup({ left: 300, right: 540, top: 100, bottom: 128 }, 240, 900, { w: 1384, h: 805 }, false, true);
  ok("submenu mais alto que a janela encolhe e rola", p.top === 8 && p.maxAltura === 789, JSON.stringify(p));
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo");
process.exit(falhas ? 1 : 0);
