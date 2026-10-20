// A tela Exportar: escolha de formato, idioma e opções.

import { h, loadJSON, saveJSON, toast } from "../util";
import { type ExportFormat, type Lang, type Theme, type ExportPrefs, type ExportCtx } from "./types";
import { FORMATS, PREFS_KEY } from "./formats";
import { runExport } from "./run";

export function openExportDialog(ctx: ExportCtx, initial?: ExportFormat): void {
  const prefs: ExportPrefs = { format: "html", lang: "pt", theme: "light", size: "A4", toc: false, ...loadJSON<Partial<ExportPrefs>>(PREFS_KEY, {}) };
  if (initial) prefs.format = initial;
  const backdrop = h("div", { class: "modal-backdrop" });
  const modal = h("div", { class: "modal export-modal" });
  modal.innerHTML = `
    <header class="wm-head">
      <svg class="ic"><use href="#i-export"/></svg>
      <h2>Exportar documento</h2>
      <button class="btn icon" data-close title="Fechar (Esc)"><svg class="ic"><use href="#i-close"/></svg></button>
    </header>
    <div class="ex-body">
      <div class="ex-formats" role="radiogroup" aria-label="Formato">
        ${FORMATS.map(
          (f) => `<button class="ex-card" role="radio" data-fmt="${f.id}"><svg class="ic"><use href="#${f.icon}"/></svg><span class="ex-t"><b>${f.title}</b><small>${f.desc}</small></span></button>`
        ).join("")}
      </div>
      <div class="ex-side">
        <h4>Idioma</h4>
        <div class="seg ex-lang">
          <button class="seg-btn" data-lang="pt">Português</button>
          <button class="seg-btn" data-lang="en">English</button>
          <button class="seg-btn" data-lang="both">Os dois</button>
        </div>
        <p class="ex-hint" data-lang-hint></p>
        <div class="ex-opts" data-for="html pdf">
          <h4>Aparência</h4>
          <div class="seg ex-theme">
            <button class="seg-btn" data-theme="light">Claro</button>
            <button class="seg-btn" data-theme="paper">Papel</button>
            <button class="seg-btn" data-theme="dark" data-for="html">Escuro</button>
          </div>
        </div>
        <div class="ex-opts" data-for="pdf docx">
          <h4>Tamanho da página</h4>
          <div class="seg ex-size">
            <button class="seg-btn" data-size="A4">A4</button>
            <button class="seg-btn" data-size="Letter">Carta</button>
          </div>
        </div>
        <div class="ex-opts" data-for="html pdf">
          <label class="tr-opt"><input type="checkbox" data-toc> <span>Incluir sumário no início</span></label>
        </div>
        <p class="ex-hint" data-fmt-hint></p>
      </div>
    </div>
    <footer class="wm-foot">
      <span class="ex-status muted" data-status></span>
      <span class="dr-spacer"></span>
      <button class="btn" data-close>Cancelar</button>
      <button class="btn primary" data-go><svg class="ic"><use href="#i-export"/></svg><span>Exportar</span></button>
    </footer>`;
  backdrop.append(modal);
  document.body.append(backdrop);

  const $m = <T extends HTMLElement>(sel: string) => modal.querySelector<T>(sel)!;
  const status = $m("[data-status]");
  const go = $m<HTMLButtonElement>("[data-go]");
  let busy = false;

  const save = () => saveJSON(PREFS_KEY, prefs);
  const paint = () => {
    modal.querySelectorAll<HTMLElement>("[data-fmt]").forEach((b) => {
      const on = b.dataset.fmt === prefs.format;
      b.classList.toggle("active", on);
      b.setAttribute("aria-checked", String(on));
    });
    modal.querySelectorAll<HTMLElement>("[data-lang]").forEach((b) => b.classList.toggle("active", b.dataset.lang === prefs.lang));
    modal.querySelectorAll<HTMLElement>("[data-theme]").forEach((b) => b.classList.toggle("active", b.dataset.theme === prefs.theme));
    modal.querySelectorAll<HTMLElement>("[data-size]").forEach((b) => b.classList.toggle("active", b.dataset.size === prefs.size));
    modal.querySelectorAll<HTMLElement>(".ex-opts").forEach((o) => (o.hidden = !o.dataset.for!.split(" ").includes(prefs.format)));
    modal.querySelectorAll<HTMLElement>("[data-theme][data-for]").forEach((b) => (b.hidden = b.dataset.for !== prefs.format));
    if (prefs.format === "pdf" && prefs.theme === "dark") prefs.theme = "paper";
    ($m("[data-toc]") as HTMLInputElement).checked = prefs.toc;
    const separate = prefs.format === "md" || prefs.format === "txt" || prefs.format === "zip";
    $m("[data-lang-hint]").textContent =
      prefs.lang === "pt"
        ? "O documento sai como você escreveu, em português."
        : prefs.lang === "en"
          ? "O texto é traduzido para o inglês (estrutura, imagens e código ficam iguais)."
          : separate
            ? "Salva dois arquivos: um em português e outro em inglês."
            : "Um só documento com duas colunas: português à esquerda, inglês à direita, parágrafo por parágrafo.";
    $m("[data-fmt-hint]").textContent =
      prefs.format === "pdf"
        ? "Abre a janela de impressão: escolha “Salvar como PDF” (ou “Microsoft Print to PDF”) como impressora."
        : prefs.format === "copy"
          ? "Copia o texto com formatação. Depois é só colar (Ctrl+V) no seu editor, no Google Docs ou no e-mail."
          : "";
    go.querySelector("span")!.textContent = prefs.format === "copy" ? "Copiar" : prefs.format === "pdf" ? "Abrir impressão" : "Exportar";
  };
  paint();

  modal.querySelectorAll<HTMLElement>("[data-fmt]").forEach((b) =>
    b.addEventListener("click", () => {
      prefs.format = b.dataset.fmt as ExportFormat;
      if (prefs.format === "pdf" && prefs.theme === "dark") prefs.theme = "paper";
      save();
      paint();
    })
  );
  modal.querySelectorAll<HTMLElement>("[data-lang]").forEach((b) =>
    b.addEventListener("click", () => {
      prefs.lang = b.dataset.lang as Lang;
      save();
      paint();
    })
  );
  modal.querySelectorAll<HTMLElement>("[data-theme]").forEach((b) =>
    b.addEventListener("click", () => {
      prefs.theme = b.dataset.theme as Theme;
      save();
      paint();
    })
  );
  modal.querySelectorAll<HTMLElement>("[data-size]").forEach((b) =>
    b.addEventListener("click", () => {
      prefs.size = b.dataset.size as ExportPrefs["size"];
      save();
      paint();
    })
  );
  $m<HTMLInputElement>("[data-toc]").addEventListener("change", (e) => {
    prefs.toc = (e.target as HTMLInputElement).checked;
    save();
  });

  const close = () => {
    if (busy) return;
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
  modal.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));

  go.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    go.disabled = true;
    const say = (t: string) => (status.textContent = t);
    try {
      const done = await runExport(ctx, prefs, say);
      if (done) {
        busy = false;
        close();
      }
    } catch (e) {
      toast("Não foi possível exportar: " + e, "err", 7000);
    } finally {
      busy = false;
      go.disabled = false;
      say("");
    }
  });
}
