// Linguagem informal → alternativa formal.

/** Linguagem informal → alternativa formal. */
export const INFORMAL: { rx: RegExp; message: string; fix?: string; suggestion?: string }[] = [
  { rx: /(?<![\p{L}])pra(?![\p{L}])/giu, message: "“pra” é informal — use “para”", fix: "para" },
  { rx: /(?<![\p{L}])pro(?![\p{L}])/giu, message: "“pro” é informal — use “para o”", fix: "para o" },
  { rx: /(?<![\p{L}])t[áa](?![\p{L}])/giu, message: "“tá” é informal — use “está”", fix: "está" },
  { rx: /(?<![\p{L}])n[ée](?![\p{L}])/giu, message: "“né” é informal — escreva por extenso (ex.: “não é?”)" },
  { rx: /(?<![\p{L}])um monte de(?![\p{L}])/giu, message: "“um monte de” é informal — use “muitos” ou “vários”", fix: "muitos" },
  { rx: /(?<![\p{L}])muito bom(?![\p{L}])/giu, message: "Em texto formal, “muito bom” pode virar “excelente”", suggestion: "excelente" },
  { rx: /(?<![\p{L}])bem legal(?![\p{L}])/giu, message: "“bem legal” é informal — use “muito interessante”", fix: "muito interessante" },
  { rx: /(?<![\p{L}])tipo assim(?![\p{L}])/giu, message: "“tipo assim” é informal — use “por exemplo”", fix: "por exemplo" },
  { rx: /(?<![\p{L}])acho que(?![\p{L}])/giu, message: "Em texto formal, prefira “considero que” ou “entendo que”", suggestion: "considero que" },
  { rx: /(?<![\p{L}])e tal(?![\p{L}])/giu, message: "“e tal” é informal — use “entre outros”", fix: "entre outros" },
  { rx: /(?<![\p{L}])da[íi](?![\p{L}])/giu, message: "“daí” é informal — prefira “então” ou “em seguida”" },
  { rx: /(?<![\p{L}])no final das contas(?![\p{L}])/giu, message: "“no final das contas” → “em última análise”", fix: "em última análise" },
  { rx: /(?<![\p{L}])por causa disso(?![\p{L}])/giu, message: "“por causa disso” → “por esse motivo”", fix: "por esse motivo" },
  { rx: /(?<![\p{L}])coisa(?![\p{L}])/giu, message: "“coisa” é vago em texto formal — prefira “item”, “elemento” ou “aspecto”", suggestion: "item" },
  { rx: /(?<![\p{L}])baita(?![\p{L}])/giu, message: "“baita” é informal — use “grande” ou “expressivo”", fix: "grande" },
  { rx: /(?<![\p{L}])muito massa(?![\p{L}])/giu, message: "“muito massa” é informal — use “excelente”", fix: "excelente" },
  { rx: /(?<![\p{L}])apps(?![\p{L}])/giu, message: "em texto formal prefira “aplicativos”", suggestion: "aplicativos", fix: "aplicativos" },
  { rx: /(?<![\p{L}])app(?![\p{L}])/giu, message: "em texto formal prefira “aplicativo”", suggestion: "aplicativo", fix: "aplicativo" },
];
