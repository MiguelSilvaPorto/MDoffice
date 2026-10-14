// mdOffice — ponto de partida. Tudo do app está em src/app/ (e nos motores md/, word/, powerpoint/, broker/).
import "./styles.css";
import { toast } from "./util";
import { ligarMovimentoDeSaida } from "./movimento";
import { ligarDicas } from "./dica";
import { App } from "./app/app";
import { ligarBatimento } from "./app/batimento";

const app = new App();
ligarMovimentoDeSaida();
// As dicas do app (o balão no lugar do `title` nativo do navegador)
ligarDicas();
// Em desenvolvimento, avisa o servidor de dev que a página está viva: é assim que o
// watchdog percebe uma página travada (o processo continua de pé) e reinicia o app.
ligarBatimento();
// Garante que a janela nunca seja deslocada/rolada (mantém o topo sempre visível)
window.addEventListener("scroll", () => {
  if (window.scrollY !== 0 || window.scrollX !== 0) {
    window.scrollTo(0, 0);
  }
});

// gancho de depuração (útil para inspecionar/testar o app em execução)
(window as unknown as Record<string, unknown>).__mdoffice = { app };

/**
 * Tira a tela de carregamento (o `#boot` do index.html).
 *
 * Some em QUALQUER desfecho do start: se o app falhar, a tela sairia do caminho
 * do aviso de erro — e o aviso é justamente o que a pessoa precisa ver.
 */
function tirarTelaDeCarregamento(): void {
  const tela = document.getElementById("boot");
  if (!tela) return;
  tela.classList.add("boot-saindo");
  window.setTimeout(() => tela.remove(), 200);
}

void app
  .start()
  .catch((e) => {
    console.error(e);
    toast("Erro ao iniciar o mdOffice: " + e, "err", 8000);
  })
  .finally(tirarTelaDeCarregamento);
