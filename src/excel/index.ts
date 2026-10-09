// Ponto de entrada do motor de planilhas. O App importa daqui (como importa de
// ../word/host e ../powerpoint/powerpoint).

export { ExcelHost, type ExcelTabData, type ExcelHostOptions } from "./host";
export { livroParaXlsx, type OpcoesXlsx } from "./xlsxexport";
export { xlsxParaLivro } from "./xlsximport";
export { CONFIG_PADRAO, serialize, deserialize, resumo, livroDeExemplo } from "./model";
export type { Livro, Folha, Celula, Estilo, ConfigPlanilha } from "./schema";