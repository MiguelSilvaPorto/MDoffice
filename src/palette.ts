// Busca de comandos (Ctrl+K): digite parte do nome e aperte Enter — tudo do app num só lugar.
import { h } from "./util";

export interface PaletteItem {
  label: string;
  group: string;
  hint?: string;
  /** Palavras extras que também encontram o comando. */
  keywords?: string;
  run: () => void;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function openPalette(items: PaletteItem[]): void {
  if (document.querySelector(".palette")) return;
  const backdrop = h("div", { class: "modal-backdrop palette-backdrop" });
  const box = h("div", { class: "palette", role: "dialog", "aria-label": "Buscar comando" });
  const input = h("input", { class: "palette-input", type: "text", placeholder: "Digite um comando… (exportar, traduzir, tema, aba…)", spellcheck: "false", autocomplete: "off" });
  const list = h("div", { class: "palette-list", role: "listbox" });
  box.append(input, list);
  backdrop.append(box);
  document.body.append(backdrop);

  let shown: PaletteItem[] = [];
  let index = 0;

  const paint = () => {
    list.textContent = "";
    let lastGroup = "";
    shown.forEach((it, i) => {
      if (it.group !== lastGroup) {
        lastGroup = it.group;
        list.append(h("div", { class: "palette-group", text: it.group }));
      }
      const row = h("button", { class: `palette-item${i === index ? " active" : ""}`, type: "button", role: "option" });
      row.append(h("span", { class: "pi-label", text: it.label }));
      if (it.hint) row.append(h("span", { class: "pi-hint", text: it.hint }));
      row.addEventListener("mousemove", () => {
        if (index !== i) {
          index = i;
          list.querySelectorAll(".palette-item").forEach((e, k) => e.classList.toggle("active", k === i));
        }
      });
      row.addEventListener("click", () => pick(i));
      list.append(row);
    });
    if (!shown.length) list.append(h("div", { class: "palette-empty", text: "Nenhum comando encontrado." }));
    list.querySelector(".palette-item.active")?.scrollIntoView({ block: "nearest" });
  };

  const filter = () => {
    const words = fold(input.value).split(/\s+/).filter(Boolean);
    shown = items.filter((it) => {
      const hay = fold(`${it.label} ${it.group} ${it.keywords ?? ""}`);
      return words.every((w) => hay.includes(w));
    });
    index = 0;
    paint();
  };

  const close = () => {
    document.removeEventListener("keydown", onKey, true);
    backdrop.remove();
  };
  const pick = (i: number) => {
    const it = shown[i];
    if (!it) return;
    close();
    window.setTimeout(it.run, 0);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      if (shown.length) index = (index + (e.key === "ArrowDown" ? 1 : -1) + shown.length) % shown.length;
      paint();
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      pick(index);
    }
  };
  document.addEventListener("keydown", onKey, true);
  backdrop.addEventListener("mousedown", (e) => {
    if (e.target === backdrop) close();
  });
  input.addEventListener("input", filter);
  filter();
  input.focus();
}
