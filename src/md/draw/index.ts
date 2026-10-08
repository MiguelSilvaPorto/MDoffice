// Quadro de desenho ASSISTIDO, usado embutido no documento (sem popup).
// - reconhece traços à mão livre e os transforma em formas alinhadas
// - encaixa ângulos/quadrados e alinha elementos entre si (ímã)
// - salva o desenho como PNG + um arquivo .json ao lado (para editar depois)
// Peças: model · geometry · recognize · links · elements · board · editor
export * from "./model";
export * from "./geometry";
export * from "./recognize";
export * from "./links";
export * from "./board";
export * from "./editor";
