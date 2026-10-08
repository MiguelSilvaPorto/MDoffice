// mdCreator — ponto de partida. Tudo do app está em src/app/ (e nos motores md/, word/, power/, broker/).
import "./styles.css";
import { toast } from "./util";
import { App } from "./app/app";

const app = new App();
// gancho de depuração (útil para inspecionar/testar o app em execução)
(window as unknown as Record<string, unknown>).__mdcreator = { app };
void app.start().catch((e) => {
  console.error(e);
  toast("Erro ao iniciar o mdCreator: " + e, "err", 8000);
});
