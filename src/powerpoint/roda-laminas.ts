// A roda do mouse sobre a lâmina troca de lâmina, como no PowerPoint: um gesto
// sobe/desce UMA lâmina. Quando a lâmina está ampliada e ainda dá para rolar naquele
// sentido, a roda rola a tela primeiro — no fim da rolagem (ou com a lâmina inteira à
// vista) o gesto troca. A espera depois de trocar engole a inércia do gesto: sem ela,
// um "tapa" na roda passaria várias lâminas de uma vez.
//
// A decisão é uma função pura (dá para testar sem DOM); a ligação no canvas fica em
// `ligarRodaDeLaminas`.

/** Pixels de rolagem que valem por um gesto (meio "clique" de roda comum). */
export const PASSO_DA_RODA = 40;
/** Espera mínima entre duas trocas (ms): a inércia do mesmo gesto não passa adiante. */
export const ESPERA_DA_TROCA = 260;

export interface AmostraDaRoda {
  /** deltaY já normalizado para pixels (positivo = roda para baixo) */
  dy: number;
  /** o quadro ainda tem para onde rolar neste sentido? */
  podeRolar: boolean;
}

/** "rolar" = deixa a rolagem acontecer; "segurar" = consome sem trocar; "trocar" = já trocou. */
export type DecisaoDaRoda = "rolar" | "segurar" | "trocar";

export function criarRodaDeLaminas(opcoes: {
  irPara: (direcao: 1 | -1) => void;
  agora?: () => number;
}): (a: AmostraDaRoda) => DecisaoDaRoda {
  const agora = opcoes.agora ?? (() => performance.now());
  let acumulado = 0;
  let ultimaTroca = Number.NEGATIVE_INFINITY;
  return (a) => {
    if (a.podeRolar) {
      acumulado = 0;
      return "rolar";
    }
    const t = agora();
    if (t - ultimaTroca < ESPERA_DA_TROCA) return "segurar";
    acumulado += Math.abs(a.dy);
    if (acumulado < PASSO_DA_RODA) return "segurar";
    acumulado = 0;
    ultimaTroca = t;
    opcoes.irPara(a.dy > 0 ? 1 : -1);
    return "trocar";
  };
}

/** Liga a roda do mouse no quadro da lâmina (o `canvas` do editor). */
export function ligarRodaDeLaminas(canvas: HTMLElement, irPara: (direcao: 1 | -1) => void): void {
  const roda = criarRodaDeLaminas({ irPara });
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) return; // Ctrl + roda = zoom (tem ouvinte próprio)
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // roda lateral: rolagem normal
      const escala = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
      const dy = e.deltaY * escala;
      const temRolagem = canvas.scrollHeight - canvas.clientHeight > 4;
      const podeRolar =
        temRolagem &&
        ((dy > 0 && canvas.scrollTop + canvas.clientHeight < canvas.scrollHeight - 1) || (dy < 0 && canvas.scrollTop > 0));
      if (roda({ dy, podeRolar }) === "rolar") return;
      e.preventDefault(); // não há o que rolar: a roda é da troca de lâmina
    },
    { passive: false }
  );
}
