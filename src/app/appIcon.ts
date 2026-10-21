// Ícone do app: "claro" ou "escuro", escolhido em Configurações > Aparência.
//
// No navegador o ícone da janela é o do próprio navegador; o que dá para trocar é o
// **favicon** (a aba e o atalho). O ícone do app instalado (PWA) é fixo, gerado no build.

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

/** Aplica o ícone escolhido no favicon da aba. */
export async function aplicarIconeApp(): Promise<void> {
  const href = `/icones/mdoffice-${appIconAtual()}.png`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.append(link);
  }
  link.type = "image/png";
  link.href = href;
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
