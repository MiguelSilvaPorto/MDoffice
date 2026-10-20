// O selo do salvamento automÃ¡tico na barra e o aviso dos arquivos do Office.
//
// O autosave reescreve rascunhos do app e documentos Markdown, mas **nÃ£o** reescreve um
// arquivo SEU do Word/PowerPoint/Excel: o motor pode simplificar recursos que ainda nÃ£o
// entende (animaÃ§Ãµes, grÃ¡ficos, comentÃ¡rios, revisÃµes) e sobrescrever o original seria
// perda silenciosa â€” o arquivo sÃ³ Ã© gravado no Salvar (Ctrl+S).
//
// O que estava errado era o **recado**: para esses arquivos o selo dizia "Salvandoâ€¦" para
// sempre (como se houvesse uma gravaÃ§Ã£o que nunca termina), o chip do caminho sumia junto
// e nada explicava o Ctrl+S â€” lido como um loop que nunca salva. Aqui ficam as decisÃµes
// puras: o estado do selo e o aviso (uma vez por arquivo).

export type ModoSelo = "desligado" | "salvando" | "nao-salvo" | "erro" | "salvo";

/** O arquivo da aba Ã© um arquivo do Office DO USUÃRIO (salvo por ele), nÃ£o um rascunho do app. */
export function ehArquivoOfficeDoUsuario(kind: string | undefined, temPath: boolean, rascunho: boolean): boolean {
  return (kind === "word" || kind === "ppt" || kind === "xlsx") && temPath && !rascunho;
}

/**
 * O estado do selo da barra:
 * - `desligado` â€” o salvamento automÃ¡tico estÃ¡ desligado;
 * - `salvando`  â€” hÃ¡ gravaÃ§Ã£o a caminho (a fila) ou em andamento: o autosave VAI gravar;
 * - `nao-salvo` â€” arquivo do Office do usuÃ¡rio com alteraÃ§Ãµes: o autosave **nÃ£o** vai gravar;
 * - `erro`      â€” a Ãºltima gravaÃ§Ã£o falhou: o selo nÃ£o pode dizer "Salvo";
 * - `salvo`     â€” nada pendente.
 */
export function modoDoSelo(opts: {
  ligado: boolean;
  kind: string | undefined;
  temPath: boolean;
  rascunho: boolean;
  sujo: boolean;
  salvando: boolean;
  /** a Ãºltima tentativa de gravar falhou */
  erro?: boolean;
}): ModoSelo {
  if (opts.erro) return "erro";
  if (!opts.ligado) return "desligado";
  if (ehArquivoOfficeDoUsuario(opts.kind, opts.temPath, opts.rascunho)) {
    return opts.sujo ? "nao-salvo" : "salvo";
  }
  return opts.salvando || opts.sujo ? "salvando" : "salvo";
}

/**
 * Avisos jÃ¡ dados nesta sessÃ£o, por arquivo. O aviso Ã© sobre o **comportamento** (vale para
 * o arquivo inteiro), nÃ£o sobre uma tecla: uma vez por arquivo basta â€” e o selo "NÃ£o salvo"
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

/** O texto do aviso, com a extensÃ£o do tipo aberto. */
export function avisoOfficeSemAutosave(kind: string): string {
  const ext = kind === "word" ? ".docx" : kind === "ppt" ? ".pptx" : ".xlsx";
  return (
    `Este ${ext} Ã© um arquivo seu: o salvamento automÃ¡tico nÃ£o reescreve arquivos do Office ` +
    `(recursos que o app ainda nÃ£o entende podem se perder ao salvar). ` +
    `As alteraÃ§Ãµes ficam no histÃ³rico do app â€” use Ctrl+S para gravar o arquivo.`
  );
}
