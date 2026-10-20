// Menu do clique direito DENTRO do documento do Word.
//
// Antes o clique direito caía no menu nativo do WebView2 ("Emoji", "Colar como texto sem
// formatação", "Inspecionar"…) — que não conhece tabela. O "Excluir tabela" existia só na aba
// contextual Tabela, e quem tentava pelo clique direito (o caminho natural) não achava nada.
//
// A lista é PURA (entra "está em tabela?", sai comando + rótulo) para poder ser presa em teste
// sem DOM — quem monta o popup é a fita (ribbon.ts).

export type ItemDoContexto =
  | { tipo: "acao"; comando: string; rotulo: string }
  | { tipo: "separador" };

const acao = (comando: string, rotulo: string): ItemDoContexto => ({ tipo: "acao", comando, rotulo });
const separador: ItemDoContexto = { tipo: "separador" };

/**
 * Itens do menu de contexto do documento. Com o cursor dentro de uma tabela, os comandos de
 * tabela vêm primeiro — e "Excluir tabela" abre a lista, que é o que se procura ali.
 */
export function itensDoContexto(dentroDeTabela: boolean): ItemDoContexto[] {
  const tabela: ItemDoContexto[] = dentroDeTabela
    ? [
        acao("t-del", "Excluir tabela"),
        separador,
        acao("t-row-before", "Inserir linha acima"),
        acao("t-row-after", "Inserir linha abaixo"),
        acao("t-row-del", "Excluir linha"),
        separador,
        acao("t-col-before", "Inserir coluna à esquerda"),
        acao("t-col-after", "Inserir coluna à direita"),
        acao("t-col-del", "Excluir coluna"),
        separador,
        acao("t-merge", "Mesclar células"),
        acao("t-split", "Dividir célula"),
        separador,
      ]
    : [];
  const edicao: ItemDoContexto[] = dentroDeTabela
    ? [acao("cut", "Recortar"), acao("copy", "Copiar"), acao("paste", "Colar"), separador]
    : [acao("undo", "Desfazer"), separador, acao("cut", "Recortar"), acao("copy", "Copiar"), acao("paste", "Colar"), separador];
  return [...tabela, ...edicao, acao("select-all", "Selecionar tudo")];
}
