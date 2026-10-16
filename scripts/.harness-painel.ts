
import "../src/styles.css";

// o corpo da Composição como o app monta (powerpoint.ts), com o cabeçalho, a dica, o filtro e o
// "aplicar a todas": é o suficiente para o layout do filtro, que é o que o harness confere
const host = document.getElementById("painel") as HTMLElement;
host.innerHTML = `
  <div class="pp-side-head"><span>Composição</span><span class="pp-side-hint">geradas no seu computador</span></div>
  <p class="pp-ideias-dica">Sugestões para <b>esta lâmina</b>: o <b>Designer</b> desenha a arte; o <b>Visual</b> muda cores, fonte e o formato das caixas; a <b>Arrumação</b> reposiciona o conteúdo.</p>
  <div class="pp-seg" role="group" aria-label="O que as sugestões mudam">
    <button type="button" class="on">Designer</button>
    <button type="button">Visual</button>
    <button type="button">Arrumação</button>
    <button type="button">Tudo</button>
  </div>
  <label class="pp-ideias-todas"><input type="checkbox" /> Aplicar o visual a todas as lâminas</label>
`;

const seg = host.querySelector<HTMLElement>(".pp-seg")!;
const corpo = host.closest(".pp-side-corpo") as HTMLElement | null;
const botoes = [...seg.querySelectorAll<HTMLElement>("button")];
const cortados = botoes.filter((b) => b.scrollWidth > b.clientWidth).map((b) => b.textContent ?? "");
const sobra = seg.scrollWidth - seg.clientWidth;
document.getElementById("info")!.textContent =
  "painel=" + host.clientWidth + "  filtro=" + seg.clientWidth + "/" + seg.scrollWidth +
  "  sobra=" + sobra + (sobra > 1 ? " (ESTOURA)" : " (cabe)") +
  "  botoes=" + botoes.map((b) => (b.textContent ?? "").slice(0, 4) + ":" + b.clientWidth + "/" + b.scrollWidth).join(" ") +
  "  cortados=" + (cortados.length ? cortados.join(",") : "-") +
  "  corpo=" + (corpo ? corpo.clientWidth + "/" + corpo.scrollWidth : "?");
