// "Estou vivo" — o aviso que deixa o watchdog perceber a página travada.
//
// Quando o conteúdo da janela trava, o processo do app continua de pé e a própria
// janela continua respondendo mensagens do sistema. Quem morre é a página: nada do
// que está aqui dentro roda mais. De fora não dá para perguntar "você responde?" —
// então a página avisa sozinha, e o silêncio é o sintoma.
//
// Só em desenvolvimento: quem escuta é o servidor de dev (vite.config.ts), e é o
// watchdog (tools\watchdog.ps1) quem consulta e reinicia o app.

const INTERVALO_MS = 5000;

/**
 * Liga o aviso periódico ao servidor de dev. Sem efeito fora do desenvolvimento.
 *
 * O aviso sai mesmo com a janela minimizada de propósito: escondida, o navegador
 * limita os timers a cerca de um por minuto, e é por isso que o watchdog só fala em
 * travamento depois de bem mais tempo que isso (ver `-TravadoSegundos`).
 */
export function ligarBatimento(): void {
  if (!import.meta.env.DEV) return;
  const avisar = (): void => {
    void fetch("/__vivo", { method: "POST", keepalive: true }).catch(() => {
      // servidor fora do ar: não há o que fazer aqui
    });
  };
  avisar();
  window.setInterval(avisar, INTERVALO_MS);
}
