// Configuração da IA local. Para trocar de modelo, mude aqui e em scripts/baixar-modelo.mjs.

/** Pasta do modelo dentro do app (public/modelos/…, vai no instalador). */
export const MODELO_DIR = "gemma-3-270m";
/** Pesos em 4 bits e meia precisão (273 MB), feitos para GPU. (A versão de 8 bits desse modelo dá resultado ruim.) */
export const MODELO_DTYPE = "q4f16";
/** Tempo parado até o modelo sair da memória (devolve ~0,6 GB). */
export const LIBERAR_APOS_MS = 90_000;

/** Preferências da pessoa (Configurações). */
const KEY_ON = "mdc.llm.on";
const KEY_GPU = "mdc.llm.gpu";
const KEY_TYPING = "mdc.llm.typing";

function read(key: string, def: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v === "1";
  } catch {
    return def;
  }
}

function write(key: string, on: boolean): void {
  try {
    localStorage.setItem(key, on ? "1" : "0");
  } catch {
    /* sem armazenamento */
  }
}

export const llmEnabled = (): boolean => read(KEY_ON, true);
export const llmUseGpu = (): boolean => read(KEY_GPU, true);
export const setLlmEnabled = (on: boolean): void => write(KEY_ON, on);
export const setLlmUseGpu = (on: boolean): void => write(KEY_GPU, on);

/** A IA ajuda a escolher a sugestão enquanto a pessoa digita? (Precisa da IA local ligada e da GPU.) */
export const llmTypingOn = (): boolean => read(KEY_TYPING, true) && llmEnabled() && llmUseGpu();
/** O interruptor em si (sem considerar as outras duas opções), para mostrar nas Configurações. */
export const llmTypingSetting = (): boolean => read(KEY_TYPING, true);
export const setLlmTyping = (on: boolean): void => write(KEY_TYPING, on);
