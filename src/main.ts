// mdCreator — ponto de partida. Tudo do app está em src/app/ (e nos motores md/, word/, powerpoint/, broker/).
import "./styles.css";
import { toast } from "./util";
import { ligarMovimentoDeSaida } from "./movimento";
import { App } from "./app/app";

const app = new App();
ligarMovimentoDeSaida();
// Garante que a janela nunca seja deslocada/rolada (mantém o topo sempre visível)
window.addEventListener("scroll", () => {
  if (window.scrollY !== 0 || window.scrollX !== 0) {
    window.scrollTo(0, 0);
  }
});

// gancho de depuração (útil para inspecionar/testar o app em execução)
(window as unknown as Record<string, unknown>).__mdcreator = { app };
void app.start().catch((e) => {
  console.error(e);
  toast("Erro ao iniciar o mdCreator: " + e, "err", 8000);
});
