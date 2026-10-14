// O selo do salvamento automático na barra e o aviso dos arquivos do Office.
//
// O autosave reescreve rascunhos do app e documentos Markdown, mas **não** reescreve um
// arquivo SEU do Word/PowerPoint/Excel: o motor pode simplificar recursos que ainda não
// entende (animações, gráficos, comentários, revisões) e sobrescrever o original seria
// perda silenciosa — o arquivo só é gravado no Salvar (Ctrl+S).
//
// O que estava errado era o **recado**: para esses arquivos o selo dizia "Salvando…" para
// sempre (como se houvesse uma gravação que nunca termina), o chip do caminho sumia junto
// e nada explicava o Ctrl+S — lido como um loop que nunca salva. Aqui ficam as decisões
// puras: o estado do selo e o aviso (uma vez por arquivo).

export type ModoSelo = "desligado" | "salvando" | "nao-salvo" | "salvo";

/** O arquivo da aba é um arquivo do Office DO USUÁRIO (salvo por ele), não um rascunho do app. */
export function ehArquivoOfficeDoUsuario(kind: string | undefined, temPath: boolean, rascunho: boolean): boolean {
  return (kind === "word" || kind === "ppt" || kind === "xlsx") && temPath && !rascunho;
}

/**
 * O estado do selo da barra:
 * - `desligado` — o salvamento automático está desligado;
 * - `salvando`  — há gravação a caminho (a fila) ou em andamento: o autosave VAI gravar;
 * - `nao-salvo` — arquivo do Office do usuário com alterações: o autosave **não** vai gravar;
 * - `salvo`     — nada pendente.
 */
export function modoDoSelo(opts: {
  ligado: boolean;
  kind: string | undefined;
  temPath: boolean;
  rascunho: boolean;
  sujo: boolean;
  salvando: boolean;
}): ModoSelo {
  if (!opts.ligado) return "desligado";
  if (ehArquivoOfficeDoUsuario(opts.kind, opts.temPath, opts.rascunho)) {
    return opts.sujo ? "nao-salvo" : "salvo";
  }
  return opts.salvando || opts.sujo ? "salvando" : "salvo";
}

/**
 * Avisos já dados nesta sessão, por arquivo. O aviso é sobre o **comportamento** (vale para
 * o arquivo inteiro), não sobre uma tecla: uma vez por arquivo basta — e o selo "Não salvo"
 * continua lembrando.
 */
export function criarAvisosOffice(): { primeiraVez(path: string): boolean } {
  const vistos = new Set<string>();
  return {
    primeiraVez(path: string): boolean {
      const chave = path.toLowerCase();
      if (vistos.has(chave)) return false;
      vistos.add(chave);
      return true;
    },
  };
}

/** O texto do aviso, com a extensão do tipo aberto. */
export function avisoOfficeSemAutosave(kind: string): string {
  const ext = kind === "word" ? ".docx" : kind === "ppt" ? ".pptx" : ".xlsx";
  return (
    `Este ${ext} é um arquivo seu: o salvamento automático não reescreve arquivos do Office ` +
    `(recursos que o app ainda não entende podem se perder ao salvar). ` +
    `As alterações ficam no histórico do app — use Ctrl+S para gravar o arquivo.`
  );
}
