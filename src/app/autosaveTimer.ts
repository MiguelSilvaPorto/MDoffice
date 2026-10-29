// O relógio do salvamento automático.
//
// Antes era um `debounce` de 2 s: a cada tecla o relógio recomeçava. Quem escrevia sem
// parar passava minutos sem nada ir para o disco — a gravação só acontecia quando a pessoa
// parava, e se o app fechasse antes (ou o computador desligasse) a última parte do texto
// sumia. Uma pausa de 2 s é curta para quem pensa entre frases e longa para quem digita
// corrido.
//
// Aqui cada alteração agenda a gravação para daqui a `pausaMs`, mas o agendamento **nunca
// passa do teto** `maximoMs` contado desde a última gravação: digitando sem parar, o
// documento é gravado de tempos em tempos; quando a pessoa para, a última palavra entra na
// gravação de pausa. A gravação em si continua na fila (`saveQueue`), que garante uma por
// vez e coalesce os pedidos — este módulo só decide **quando** pedir.
//
// O relógio e os timers entram por parâmetro para o teste rodar no Node, sem navegador.

/**
 * O agendador é **chamável** (`autosaveSoon()`, como o `debounce` que ele substituiu) e
 * também tem os métodos com nome — assim os pontos que já chamavam `autosaveSoon()` não
 * precisam mudar.
 */
export interface AgendadorSalvamento {
  /** Marca que há alteração e (re)agenda a próxima gravação. */
  (): void;
  /** O mesmo que chamar o agendador. */
  agendar(): void;
  /** Cancela a gravação agendada (a que já está em andamento não é interrompida). */
  parar(): void;
  /** Há alteração esperando a próxima gravação? */
  readonly pendente: boolean;
}

export interface OpcoesAgendador {
  /** A gravação (o pedido à fila). Pode devolver promise: o teto conta a partir do fim. */
  salvar: () => Promise<void> | void;
  /** Espera depois da última alteração (padrão: 900 ms). */
  pausaMs?: number;
  /** Teto sem gravar, mesmo digitando sem parar (padrão: 5 s). */
  maximoMs?: number;
  agora?: () => number;
  agendarTimer?: (fn: () => void, ms: number) => number;
  cancelarTimer?: (id: number) => void;
}

/** Espera depois da última tecla: curta o bastante para a gravação parecer imediata. */
export const PAUSA_PADRAO_MS = 900;
/** Teto durante digitação contínua: perde no máximo isto se o app fechar de repente. */
export const TETO_PADRAO_MS = 5000;

export function criarAgendadorSalvamento(opcoes: OpcoesAgendador): AgendadorSalvamento {
  const pausa = Math.max(0, opcoes.pausaMs ?? PAUSA_PADRAO_MS);
  const teto = Math.max(pausa, opcoes.maximoMs ?? TETO_PADRAO_MS);
  const agora = opcoes.agora ?? (() => Date.now());
  const agendarTimer =
    opcoes.agendarTimer ?? ((fn: () => void, ms: number) => window.setTimeout(fn, ms));
  const cancelarTimer = opcoes.cancelarTimer ?? ((id: number) => window.clearTimeout(id));

  let timer: number | null = null;
  let pendente = false;
  let salvando = false;
  let ultimaGravacao = agora();

  const cancelar = (): void => {
    if (timer === null) return;
    cancelarTimer(timer);
    timer = null;
  };

  const marcar = (): void => {
    cancelar();
    const desdeUltima = agora() - ultimaGravacao;
    const ateTeto = Math.max(0, teto - desdeUltima);
    timer = agendarTimer(disparar, Math.min(pausa, ateTeto));
  };

  const disparar = (): void => {
    timer = null;
    if (!pendente || salvando) return;
    pendente = false;
    salvando = true;
    const terminar = (): void => {
      salvando = false;
      ultimaGravacao = agora();
      // alterou durante a gravação: agenda a próxima (a fila grava o texto mais recente)
      if (pendente) marcar();
    };
    try {
      const resultado = opcoes.salvar();
      if (resultado && typeof (resultado as Promise<void>).then === "function") {
        void (resultado as Promise<void>).then(terminar, terminar);
      } else {
        terminar();
      }
    } catch {
      terminar();
    }
  };

  const agendar = (): void => {
    pendente = true;
    // durante uma gravação não há o que agendar: ao terminar, `terminar()` vê o pendente
    if (!salvando) marcar();
  };

  const agendador = agendar as AgendadorSalvamento;
  agendador.agendar = agendar;
  agendador.parar = (): void => {
    cancelar();
    pendente = false;
  };
  Object.defineProperty(agendador, "pendente", { get: () => pendente });

  return agendador;
}
