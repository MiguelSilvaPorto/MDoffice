// Desfazer e refazer da apresentação inteira. Cada estado é uma referência às lâminas (que nunca são alteradas
// no lugar: toda edição devolve lâminas novas), então guardar dezenas de estados custa quase nada.

export class Historico<T> {
  private passado: T[] = [];
  private futuro: T[] = [];
  private ultimaChave = "";
  private ultimoMomento = 0;

  constructor(private limite = 100) {}

  /**
   * Guarda o estado de ANTES de uma edição. Edições seguidas da mesma `chave` (digitar, arrastar um controle)
   * dentro de ~1 s viram um passo só.
   */
  registrar(antes: T, chave = ""): void {
    const agora = Date.now();
    if (chave && chave === this.ultimaChave && agora - this.ultimoMomento < 1000) {
      this.ultimoMomento = agora;
      return;
    }
    this.ultimaChave = chave;
    this.ultimoMomento = agora;
    this.passado.push(antes);
    if (this.passado.length > this.limite) this.passado.shift();
    this.futuro = [];
  }

  desfazer(atual: T): T | null {
    const p = this.passado.pop();
    if (p === undefined) return null;
    this.futuro.push(atual);
    this.ultimaChave = "";
    return p;
  }

  refazer(atual: T): T | null {
    const f = this.futuro.pop();
    if (f === undefined) return null;
    this.passado.push(atual);
    this.ultimaChave = "";
    return f;
  }

  get podeDesfazer(): boolean {
    return this.passado.length > 0;
  }

  get podeRefazer(): boolean {
    return this.futuro.length > 0;
  }

  limpar(): void {
    this.passado = [];
    this.futuro = [];
    this.ultimaChave = "";
  }
}
