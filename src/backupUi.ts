// Tela "Arquivos só no backup": o original sumiu do disco, mas a cópia está lá.
//
// Aparece quando você clica no indicador vermelho da barra inferior. Cada linha mostra
// o arquivo que sumiu e a cópia mais recente, com um botão para devolvê-la ao lugar.
import * as backup from "./backup";
import { h, toast } from "./util";

const when = (at: number) =>
  new Date(at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function openMissingDialog(entries: backup.BackupEntry[], onDone?: () => void): void {
  if (document.querySelector(".missing-modal")) return;
  const backdrop = h("div", { class: "modal-backdrop" });
  const modal = h("div", { class: "modal missing-modal" });
  modal.innerHTML = `
    <header class="wm-head">
      <svg class="ic"><use href="#i-shield"/></svg>
      <h2>Arquivos que só existem no backup</h2>
      <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
    </header>
    <div class="ms-body" data-body></div>
    <footer class="wm-foot">
      <span class="muted">Restaurar devolve a cópia mais recente ao caminho original.</span>
      <span class="dr-spacer"></span>
      <button class="btn" data-close2>Fechar</button>
    </footer>`;
  backdrop.append(modal);
  document.body.append(backdrop);

  const body = modal.querySelector<HTMLElement>("[data-body]")!;
  let restantes = [...entries];

  const pintar = () => {
    body.textContent = "";
    if (!restantes.length) {
      body.append(
        h("div", { class: "sb-note", text: "Nada pendente: todos os arquivos com backup estão no disco." })
      );
      return;
    }
    for (const e of restantes) {
      const maisNova = e.copies[0];
      const linha = h("div", { class: "ms-item" });
      linha.append(
        h("div", { class: "ms-info" }, [
          h("code", { class: "ms-path", text: e.original }),
          h("span", {
            class: "ms-sub",
            text: maisNova
              ? `cópia de ${when(maisNova.at)} · ${backup.tamanhoLegivel(maisNova.bytes)} · ${e.copies.length} versão(ões)`
              : "sem cópia legível",
          }),
        ])
      );
      const btn = h("button", { class: "btn small primary", text: "Restaurar" }) as HTMLButtonElement;
      btn.disabled = !maisNova;
      btn.addEventListener("click", async () => {
        if (!maisNova) return;
        btn.disabled = true;
        btn.textContent = "Restaurando…";
        try {
          await backup.restaurar(e.original, maisNova.root, maisNova.name);
          restantes = restantes.filter((x) => x !== e);
          toast("Arquivo restaurado no lugar original.", "ok", 3200);
          pintar();
          onDone?.();
        } catch (err) {
          toast("Não foi possível restaurar: " + err, "err", 6000);
          btn.disabled = false;
          btn.textContent = "Restaurar";
        }
      });
      linha.append(btn);
      body.append(linha);
    }
  };
  pintar();

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    backdrop.remove();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener("keydown", onKey, true);
  backdrop.addEventListener("mousedown", (e) => {
    if (e.target === backdrop) close();
  });
  modal.querySelectorAll("[data-close], [data-close2]").forEach((b) => b.addEventListener("click", close));
}