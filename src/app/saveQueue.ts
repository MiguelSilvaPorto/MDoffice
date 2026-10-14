// Fila do salvamento automático: uma gravação por vez (single-flight), sem perder pedidos.
//
// O salvamento automático dispara a cada pausa na digitação, mas em pasta de rede uma
// gravação pode levar segundos. A fila resolve os dois problemas que apareciam nesse caso:
//
// 1. **Nada roda em paralelo:** enquanto uma gravação está em andamento, `pedir()` não
//    inicia outra — mesma garantia do antigo `if (this.saving) return`.
// 2. **Nenhum pedido é descartado:** o pedido que chega durante a gravação fica marcado
//    (`pendente`) e, ao terminar, a fila grava de novo — com o estado mais recente, lido
//    na hora da gravação. Rajadas de digitação não formam fila de gravações obsoletas:
//    vários pedidos durante uma gravação viram **uma** gravação só, com o texto de agora.
//
// Quem espera (`await`) recebe uma promise que só resolve quando a fila esvazia — é o que
// o fechamento da janela e a troca de aba precisam para não perder a última palavra.

export interface FilaSalvamento {
  /** Pede uma gravação; resolve quando a fila inteira (incluindo o pedido pendente) vazia. */
  pedir(): Promise<void>;
  /** true enquanto há uma gravação em andamento. */
  readonly salvando: boolean;
}

export interface OpcoesFilaSalvamento {
  /** A gravação em si. É chamada sempre com o estado mais recente. */
  gravar: () => Promise<void>;
  /** Avisa a interface quando começa/termina (o indicador "Salvando…"). */
  aoMudarEstado?: (salvando: boolean) => void;
}

export function criarFilaSalvamento(opcoes: OpcoesFilaSalvamento): FilaSalvamento {
  let emAndamento: Promise<void> | null = null;
  let pendente = false;
  let esperas: Array<() => void> = [];

  const avisar = () => opcoes.aoMudarEstado?.(emAndamento !== null);

  const liberarEsperas = () => {
    if (emAndamento !== null || pendente) return;
    const fila = esperas;
    esperas = [];
    for (const resolver of fila) resolver();
  };

  const executar = async (): Promise<void> => {
    try {
      do {
        pendente = false;
        try {
          await opcoes.gravar();
        } catch {
          // uma gravação que falha não derruba a fila; o erro é tratado em quem grava
        }
      } while (pendente);
    } finally {
      emAndamento = null;
      avisar();
      liberarEsperas();
    }
  };

  const esperar = (): Promise<void> =>
    new Promise<void>((resolver) => {
      esperas.push(resolver);
      // se por algum motivo a fila já estiver vazia, não deixa a espera pendurada
      liberarEsperas();
    });

  return {
    get salvando(): boolean {
      return emAndamento !== null;
    },

    pedir(): Promise<void> {
      // marca o pedido: se algo estiver gravando, a fila repete ao terminar (coalescido)
      pendente = true;
      if (emAndamento === null) {
        emAndamento = executar();
        avisar();
      }
      return esperar();
    },
  };
}
