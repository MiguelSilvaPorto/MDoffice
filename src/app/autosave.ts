// O salvamento automático é de CADA DOCUMENTO: o botão do topo do app liga e desliga o
// documento que está à vista, e cada aba guarda a sua escolha.
//
// A regra é simples e mora aqui (para ser testada fora do navegador): a aba tem a sua
// flag; se não tem (nunca ajustada, ou um documento novo), ela herda o padrão das
// Configurações — que é o que valia antes de o salvamento automático ser por documento.

export interface AbaComAutosave {
  path?: string | null;
  autosave?: boolean;
}

/** O salvamento automático de um documento: o da aba; sem ele, o padrão global. */
export function autosaveDoDoc(aba: AbaComAutosave, padrao: boolean): boolean {
  return aba.autosave ?? padrao;
}

/**
 * O mapa que a sessão guarda: caminho (em minúsculas) → ligado/desligado. Só entram os
 * documentos que têm a SUA flag — quem herda o padrão não precisa ser guardado (o padrão
 * pode mudar e vale para eles).
 */
export function mapaDeAutosave(abas: AbaComAutosave[]): Record<string, boolean> {
  const mapa: Record<string, boolean> = {};
  for (const aba of abas) {
    if (!aba.path || aba.autosave === undefined) continue;
    mapa[aba.path.toLowerCase()] = aba.autosave;
  }
  return mapa;
}
