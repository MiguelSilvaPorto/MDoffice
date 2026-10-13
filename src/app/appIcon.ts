// Ícone do app (janela e barra de tarefas): "claro" ou "escuro", escolhido em
// Configurações > Aparência. O ícone do .exe/instalador é fixo (gerado no build com
// `npm run icon`); este aqui troca na hora pela API do Tauri (setIcon).
import { Image } from "@tauri-apps/api/image";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type AppIcon = "claro" | "escuro";

const CHAVE = "mdc.appicon";

/** Escolha guardada; sem escolha ainda, segue o tema (claro no tema claro, escuro no escuro). */
export function appIconAtual(): AppIcon {
  try {
    const v = localStorage.getItem(CHAVE);
    if (v === "claro" || v === "escuro") return v;
  } catch {
    /* sem armazenamento: segue o tema */
  }
  return document.documentElement.dataset.theme === "dark" ? "escuro" : "claro";
}

/** Aplica o ícone escolhido na janela. Fora do Tauri (navegador/dev) não faz nada. */
export async function aplicarIconeApp(): Promise<void> {
  try {
    const res = await fetch(`/icones/mdoffice-${appIconAtual()}.png`);
    if (!res.ok) return;
    const bytes = new Uint8Array(await res.arrayBuffer());
    await getCurrentWindow().setIcon(await Image.fromBytes(bytes));
  } catch {
    /* navegador ou permissão ausente: mantém o ícone padrão */
  }
}

/** Guarda a escolha e aplica na hora. */
export function definirIconeApp(v: AppIcon): void {
  try {
    localStorage.setItem(CHAVE, v);
  } catch {
    /* sem armazenamento: vale só nesta sessão */
  }
  void aplicarIconeApp();
}
