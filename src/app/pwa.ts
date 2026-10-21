// O app instalado (PWA).
//
// O mdOffice é um site que roda no seu computador (localhost). O navegador pode instalá-lo
// como um aplicativo de verdade: janela própria, ícone no menu Iniciar e abertura sem a barra
// do navegador. Não há instalador .exe — o "instalar" é o do próprio navegador.
//
// Este arquivo faz três coisas:
// 1. registra o service worker (o app abre mesmo com o servidor parado / sem rede);
// 2. guarda o convite de instalação que o Chrome/Edge fazem (`beforeinstallprompt`);
// 3. oferece `instalarApp()` para a tela de Configurações usar.

/** O evento de instalação do Chrome/Edge (não está no TypeScript do DOM). */
interface ConviteDeInstalacao extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let convite: ConviteDeInstalacao | null = null;
let instaladoAgora = false;

/** O app está rodando como PWA instalado (janela própria)? */
export function jaInstalado(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** Dá para instalar agora? (o navegador ofereceu o convite nesta sessão) */
export function podeInstalar(): boolean {
  return !!convite && !jaInstalado();
}

/**
 * Abre o convite de instalação do navegador.
 *
 * Devolve `true` se a pessoa aceitou. Se não houver convite, devolve `false` — quem chama
 * mostra as instruções (o menu do navegador).
 */
export async function instalarApp(): Promise<boolean> {
  if (!convite) return false;
  const atual = convite;
  convite = null;
  try {
    await atual.prompt();
    const escolha = await atual.userChoice;
    instaladoAgora = escolha.outcome === "accepted";
    return instaladoAgora;
  } catch {
    return false;
  }
}

/** O app acabou de ser instalado nesta sessão? */
export function acabouDeInstalar(): boolean {
  return instaladoAgora;
}

/**
 * Liga o PWA: service worker + convite de instalação.
 *
 * O service worker só entra na versão de produção: em desenvolvimento ele guardaria os
 * módulos antigos e o HMR deixaria de mostrar o código novo.
 */
export function iniciarPwa(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    // sem `preventDefault` o Chrome mostra a faixa dele; queremos o botão nas Configurações
    e.preventDefault();
    convite = e as ConviteDeInstalacao;
    document.documentElement.classList.add("pwa-instalavel");
  });
  window.addEventListener("appinstalled", () => {
    convite = null;
    instaladoAgora = true;
    document.documentElement.classList.add("pwa-instalado");
  });
  if (jaInstalado()) document.documentElement.classList.add("pwa-instalado");

  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      // não é fatal: o app funciona igual, só não abre com o servidor parado
      console.warn("service worker não registrado:", e);
    });
  });
}
