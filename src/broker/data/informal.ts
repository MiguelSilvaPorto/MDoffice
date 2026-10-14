// Linguagem informal → alternativa formal, em catálogo classificado.
//
// Cada padrão diz:
//   • classe   — tipo do marcador (internetês, contração, gíria, muleta, oralidade,
//                atenuação, redundância, vagueza): é o que conta no MIP e no
//                agrupamento por classe do painel de revisão;
//   • seguro   — true quando o app pode corrigir sozinho (a troca não mexe no sentido);
//                false quando só cabe sugerir (a troca depende de contexto ou de sentido);
//   • tom      — tom MÍNIMO em que o padrão aparece: "neutro" para o caso claro
//                ("pra" → "para") e "formal" para o que é opinião de estilo;
//   • fix      — a correção direta (só nos seguros);
//   • sugestoes — alternativas para aplicar com um clique (quando não há fix);
//   • exemplo  — frase curta que o teste usa para provar que o padrão casa.
//
// Nada age dentro de código, link ou URL (a máscara de `mask.ts` cuida) e as regras
// pulam citação (`>`) e sigla (na hora de aplicar, em `style/register.ts`).
//
// Observação: o internetês que `data/abbreviations.ts` já corrigia (vc, qdo, blz…)
// continua corrigido por aquela regra, que roda primeiro; a entrada aqui classifica
// o marcador (classe "internetes") e alimenta o MIP.

import type { ClasseMarcador } from "../types";

/** Um padrão do catálogo informal → formal. */
export interface PadraoInformal {
  rx: RegExp;
  message: string;
  fix?: string;
  sugestoes?: string[];
  classe: ClasseMarcador;
  seguro: boolean;
  tom: "neutro" | "formal";
  /** frase de exemplo usada pelo teste do catálogo */
  exemplo: string;
}

/** Rótulos das classes (painel de revisão e MIP). */
export const ROTULO_CLASSE: Record<ClasseMarcador, string> = {
  giria: "gíria",
  internetes: "internetês",
  contracao: "contração",
  muleta: "muleta",
  oralidade: "oralidade",
  atenuacao: "atenuação",
  redundancia: "redundância",
  vagueza: "vagueza",
};

/** Pesos do MIP por classe (pesquisa-formalidade-abnt, seção 3.5). */
export const PESO_CLASSE: Record<ClasseMarcador, number> = {
  giria: 3,
  internetes: 3,
  contracao: 3,
  muleta: 2,
  oralidade: 2,
  atenuacao: 1,
  redundancia: 1,
  vagueza: 1,
};

/** A classe é de marcador informal (conta no MIP)? */
export function ehClasseMarcador(c: string | undefined): c is ClasseMarcador {
  return c !== undefined && c in PESO_CLASSE;
}

export const INFORMAL: PadraoInformal[] = [
  // ---------------------------------------------------------------- internetês
  { rx: /(?<![\p{L}])vcs(?![\p{L}])/giu, message: "“vcs” é internetês — escreva “vocês”", fix: "vocês", classe: "internetes", seguro: true, tom: "neutro", exemplo: "vcs viram o aviso?" },
  { rx: /(?<![\p{L}])vc(?![\p{L}])/giu, message: "“vc” é internetês — escreva “você”", fix: "você", classe: "internetes", seguro: true, tom: "neutro", exemplo: "vc vai ao evento?" },
  { rx: /(?<![\p{L}])tbm(?![\p{L}])/giu, message: "“tbm” é internetês — escreva “também”", fix: "também", classe: "internetes", seguro: true, tom: "neutro", exemplo: "o relatório tbm ficou pronto" },
  { rx: /(?<![\p{L}])tb(?![\p{L}])/giu, message: "“tb” é internetês — escreva “também”", fix: "também", classe: "internetes", seguro: true, tom: "neutro", exemplo: "eu tb quero participar" },
  { rx: /(?<![\p{L}])qdo(?![\p{L}])/giu, message: "“qdo” é internetês — escreva “quando”", fix: "quando", classe: "internetes", seguro: true, tom: "neutro", exemplo: "me avise qdo chegar" },
  { rx: /(?<![\p{L}])qto(?![\p{L}])/giu, message: "“qto” é internetês — escreva “quanto”", fix: "quanto", classe: "internetes", seguro: true, tom: "neutro", exemplo: "qto custa o projeto?" },
  { rx: /(?<![\p{L}])pq(?![\p{L}])/giu, message: "“pq” é internetês — escreva “porque” (ou “por que”, conforme a frase)", sugestoes: ["porque"], classe: "internetes", seguro: false, tom: "formal", exemplo: "ele faltou pq ficou doente" },
  { rx: /(?<![\p{L}])qm(?![\p{L}])/giu, message: "“qm” é internetês — escreva “quem”", fix: "quem", classe: "internetes", seguro: true, tom: "neutro", exemplo: "qm chegou primeiro?" },
  { rx: /(?<![\p{L}])msm(?![\p{L}])/giu, message: "“msm” é internetês — escreva “mesmo” (ou “mesma”, “mesmos”, “mesmas”)", sugestoes: ["mesmo"], classe: "internetes", seguro: false, tom: "formal", exemplo: "ele fez o msm trajeto" },
  { rx: /(?<![\p{L}])hj(?![\p{L}])/giu, message: "“hj” é internetês — escreva “hoje”", fix: "hoje", classe: "internetes", seguro: true, tom: "neutro", exemplo: "hj ficou pronto" },
  { rx: /(?<![\p{L}])blz(?![\p{L}])/giu, message: "“blz” é internetês — em texto formal use “certo”, “combinado” ou “de acordo”", sugestoes: ["certo", "combinado"], classe: "internetes", seguro: false, tom: "formal", exemplo: "blz, envio amanhã" },
  { rx: /(?<![\p{L}])apps(?![\p{L}])/giu, message: "em texto formal prefira “aplicativos”", fix: "aplicativos", sugestoes: ["aplicativos"], classe: "internetes", seguro: true, tom: "neutro", exemplo: "instalei dois apps novos" },
  { rx: /(?<![\p{L}])app(?![\p{L}])/giu, message: "em texto formal prefira “aplicativo”", fix: "aplicativo", sugestoes: ["aplicativo"], classe: "internetes", seguro: true, tom: "neutro", exemplo: "baixei o app ontem" },

  // ---------------------------------------------------------------- contração
  { rx: /(?<![\p{L}])pra[^\S\n]+gente(?![\p{L}])/giu, message: "“pra gente” é informal — escreva “para nós”", fix: "para nós", classe: "contracao", seguro: true, tom: "neutro", exemplo: "pra gente revisar isso depois" },
  { rx: /(?<![\p{L}])pra(?![\p{L}])(?!\s+ver(?![\p{L}]))(?!\s+gente(?![\p{L}]))/giu, message: "“pra” é informal — use “para”", fix: "para", classe: "contracao", seguro: true, tom: "neutro", exemplo: "vou pra casa agora" },
  { rx: /(?<![\p{L}])pros(?![\p{L}])/giu, message: "“pros” é informal — use “para os”", fix: "para os", classe: "contracao", seguro: true, tom: "neutro", exemplo: "manda pros colegas" },
  { rx: /(?<![\p{L}])pro(?![\p{L}])/giu, message: "“pro” é informal — use “para o”", fix: "para o", classe: "contracao", seguro: true, tom: "neutro", exemplo: "leva pro escritório" },
  { rx: /(?<![\p{L}])t[áa](?![\p{L}])/giu, message: "“tá” é informal — use “está”", fix: "está", classe: "contracao", seguro: true, tom: "neutro", exemplo: "o arquivo tá pronto" },
  { rx: /(?<![\p{L}])tô(?![\p{L}])/giu, message: "“tô” é informal — use “estou”", fix: "estou", classe: "contracao", seguro: true, tom: "neutro", exemplo: "tô revisando o texto" },
  { rx: /(?<![\p{L}])tava(?![\p{L}])/giu, message: "“tava” é informal — use “estava”", fix: "estava", classe: "contracao", seguro: true, tom: "neutro", exemplo: "tava tudo certo ontem" },
  { rx: /(?<![\p{L}])cê(?![\p{L}])/giu, message: "“cê” é informal — use “você”", fix: "você", classe: "contracao", seguro: true, tom: "neutro", exemplo: "cê já viu isso?" },
  { rx: /(?<![\p{L}])né(?![\p{L}])/giu, message: "“né” é informal — escreva por extenso (ex.: “não é?”)", sugestoes: ["não é?"], classe: "contracao", seguro: false, tom: "formal", exemplo: "o prazo é curto, né?" },

  // ---------------------------------------------------------------- muleta
  { rx: /(?<![\p{L}])tipo[^\S\n]+assim(?![\p{L}])/giu, message: "“tipo assim” é informal — use “por exemplo”", fix: "por exemplo", classe: "muleta", seguro: true, tom: "neutro", exemplo: "tipo assim, o sistema falhou" },
  { rx: /(?<![\p{L}])tipo(?=,)/giu, message: "“tipo,” no meio da frase é marca de fala — use “por exemplo,”", sugestoes: ["por exemplo"], classe: "muleta", seguro: false, tom: "formal", exemplo: "precisamos de prazo, tipo, uma semana" },
  { rx: /(?<![\p{L}])sei[^\S\n]+lá(?![\p{L}])/giu, message: "“sei lá” é oral — em texto formal, afirme o que se sabe ou use “não é possível determinar”", classe: "muleta", seguro: false, tom: "formal", exemplo: "sei lá o que aconteceu" },
  { rx: /(?<![\p{L}])e[^\S\n]+tal(?![\p{L}])/giu, message: "“e tal” é informal — use “entre outros”", fix: "entre outros", classe: "muleta", seguro: true, tom: "neutro", exemplo: "comprei papel, caneta e tal" },
  { rx: /(?<![\p{L}])(sabe|entende)\?(?![\p{L}])/giu, message: "“sabe?”/“entende?” é marcador de fala — em texto formal, retire ou reformule a pergunta", classe: "muleta", seguro: false, tom: "formal", exemplo: "o prazo muda toda hora, sabe?" },
  { rx: /(?<![\p{L}])enfim(?![\p{L}])/giu, message: "“enfim” é muleta de fala — use “por fim” quando concluir ou retire", sugestoes: ["por fim"], classe: "muleta", seguro: false, tom: "formal", exemplo: "enfim, o projeto terminou" },
  { rx: /(?<![\p{L}])(vamos[^\S\n]+dizer|digamos[^\S\n]+assim)(?![\p{L}])/giu, message: "“vamos dizer”/“digamos assim” é muleta de fala — use “por exemplo”", sugestoes: ["por exemplo"], classe: "muleta", seguro: false, tom: "formal", exemplo: "digamos assim, o número dobrou" },
  { rx: /(?<![\p{L}])daí(?![\p{L}])(?!\s+(?:eu|você|ele|ela|nós|vocês|eles|elas|a gente)[^\S\n]+[\p{L}])/giu, message: "“daí” é informal — prefira “então” ou “em seguida”", sugestoes: ["então", "em seguida"], classe: "muleta", seguro: false, tom: "formal", exemplo: "o sistema caiu, daí perdemos o prazo" },
  { rx: /(?<![\p{L}])no[^\S\n]+final[^\S\n]+das[^\S\n]+contas(?![\p{L}])/giu, message: "“no final das contas” → “em última análise”", fix: "em última análise", classe: "muleta", seguro: true, tom: "neutro", exemplo: "no final das contas, deu certo" },
  { rx: /(?<![\p{L}])por[^\S\n]+causa[^\S\n]+disso(?![\p{L}])/giu, message: "“por causa disso” → “por esse motivo”", fix: "por esse motivo", classe: "muleta", seguro: true, tom: "neutro", exemplo: "por causa disso, mudamos o plano" },

  // ---------------------------------------------------------------- gíria
  { rx: /(?<![\p{L}])baita(?![\p{L}])/giu, message: "“baita” é informal — use “grande” ou “expressivo”", fix: "grande", classe: "giria", seguro: true, tom: "neutro", exemplo: "um baita problema" },
  { rx: /(?<![\p{L}])muito[^\S\n]+massa(?![\p{L}])/giu, message: "“muito massa” é informal — use “excelente”", fix: "excelente", classe: "giria", seguro: true, tom: "neutro", exemplo: "o resultado ficou muito massa" },
  { rx: /(?<![\p{L}])muito[^\S\n]+bom(?![\p{L}])/giu, message: "Em texto formal, “muito bom” pode virar “excelente”", sugestoes: ["excelente"], classe: "giria", seguro: false, tom: "formal", exemplo: "o texto ficou muito bom" },
  { rx: /(?<![\p{L}])bagulho(?![\p{L}])/giu, message: "“bagulho” é gíria — use “objeto”, “elemento” ou “assunto”", sugestoes: ["objeto", "elemento", "assunto"], classe: "giria", seguro: false, tom: "formal", exemplo: "esse bagulho não funciona" },
  { rx: /(?<![\p{L}])troço(?![\p{L}])/giu, message: "“troço” é vago e informal — use “objeto” ou “item”", sugestoes: ["objeto", "item"], classe: "giria", seguro: false, tom: "formal", exemplo: "o troço quebrou de novo" },
  { rx: /(?<![\p{L}])parada(?![\p{L}])/giu, message: "“parada” é gíria em texto formal — use “assunto” ou “item”", sugestoes: ["assunto", "item"], classe: "giria", seguro: false, tom: "formal", exemplo: "essa parada é séria" },
  { rx: /(?<![\p{L}])da[^\S\n]+hora(?![\p{L}])/giu, message: "“da hora” é gíria — use “excelente” ou “muito bom”", sugestoes: ["excelente", "muito bom"], classe: "giria", seguro: false, tom: "formal", exemplo: "o resultado ficou da hora" },
  { rx: /(?<![\p{L}])ok(?![\p{L}])/giu, message: "“ok” é informal — em texto formal use “certo”, “combinado” ou “de acordo”", sugestoes: ["certo", "de acordo"], classe: "giria", seguro: false, tom: "formal", exemplo: "ok, podemos seguir" },

  // ---------------------------------------------------------------- vagueza
  { rx: /(?<![\p{L}])coisas?(?![\p{L}])/giu, message: "“coisa” é vago em texto formal — prefira “item”, “elemento” ou “aspecto”", sugestoes: ["item", "elemento", "aspecto"], classe: "vagueza", seguro: false, tom: "formal", exemplo: "essa coisa ficou estranha" },
  { rx: /(?<![\p{L}])negócio(?![\p{L}])/giu, message: "“negócio” é vago em texto formal — prefira “assunto”, “atividade” ou “elemento”", sugestoes: ["assunto", "atividade", "elemento"], classe: "vagueza", seguro: false, tom: "formal", exemplo: "o negócio começou cedo" },
  { rx: /(?<![\p{L}])dar[^\S\n]+uma[^\S\n]+olhada(?![\p{L}])/giu, message: "“dar uma olhada” é coloquial — use “examinar”", fix: "examinar", classe: "vagueza", seguro: true, tom: "neutro", exemplo: "vou dar uma olhada no relatório" },
  { rx: /(?<![\p{L}])fazer[^\S\n]+uma[^\S\n]+análise[^\S\n]+de(?![\p{L}])/giu, message: "“fazer uma análise de” → “analisar”", sugestoes: ["analisar"], classe: "vagueza", seguro: false, tom: "formal", exemplo: "vamos fazer uma análise de dados" },
  { rx: /(?<![\p{L}])realizar[^\S\n]+uma[^\S\n]+pesquisa[^\S\n]+sobre(?![\p{L}])/giu, message: "“realizar uma pesquisa sobre” → “pesquisar”", sugestoes: ["pesquisar"], classe: "vagueza", seguro: false, tom: "formal", exemplo: "vamos realizar uma pesquisa sobre o tema" },
  { rx: /(?<![\p{L}])um[^\S\n]+monte[^\S\n]+de(?![\p{L}])/giu, message: "“um monte de” é informal — use “muitos” ou “vários”", fix: "muitos", classe: "vagueza", seguro: true, tom: "neutro", exemplo: "um monte de gente reclamou" },
  { rx: /(?<![\p{L}])muita[^\S\n]+gente(?![\p{L}])(?!\s+que[^\S\n]+(?:diz|afirma|fala|pensa|acha)(?![\p{L}]))/giu, message: "“muita gente” é vago — use “muitas pessoas” ou “muitos autores”", sugestoes: ["muitas pessoas", "muitos autores"], classe: "vagueza", seguro: false, tom: "formal", exemplo: "muita gente defende essa ideia" },

  // ---------------------------------------------------------------- oralidade
  { rx: /(?<![\p{L}])o[^\S\n]+pessoal(?![\p{L}])/giu, message: "“o pessoal” é oral — use “a equipe” ou “os participantes”; risco: depende de quem é o sujeito", sugestoes: ["a equipe", "os participantes"], classe: "oralidade", seguro: false, tom: "formal", exemplo: "o pessoal terminou a tarefa" },
  { rx: /(?<![\p{L}])tem[^\S\n]+muita[^\S\n]+gente[^\S\n]+que[^\S\n]+(?:diz|afirma|fala|pensa|acha)(?![\p{L}])/giu, message: "“tem muita gente que diz” é oral — use “há quem afirme” ou “muitos autores afirmam”; risco: muda o sujeito", sugestoes: ["há quem afirme", "muitos autores afirmam"], classe: "oralidade", seguro: false, tom: "formal", exemplo: "tem muita gente que diz o contrário" },

  // ---------------------------------------------------------------- atenuação
  { rx: /(?<![\p{L}])(?:eu[^\S\n]+)?acho[^\S\n]+que(?![\p{L}])/giu, message: "“acho que” é opinião assumida — em texto formal use “considera-se que” ou “entende-se que”; risco: vira afirmação impessoal", sugestoes: ["considera-se que", "entende-se que"], classe: "atenuacao", seguro: false, tom: "formal", exemplo: "acho que o prazo é curto" },
  { rx: /(?<![\p{L}])(?:eu[^\S\n]+)?acredito[^\S\n]+que(?![\p{L}])/giu, message: "“acredito que” é opinião em 1ª pessoa — em texto formal use “acredita-se que” ou “entende-se que”; risco: vira afirmação impessoal", sugestoes: ["acredita-se que", "entende-se que"], classe: "atenuacao", seguro: false, tom: "formal", exemplo: "acredito que a hipótese se confirma" },
  { rx: /(?<![\p{L}])me[^\S\n]+parece[^\S\n]+que(?![\p{L}])/giu, message: "“me parece que” é atenuação em 1ª pessoa — use “os indícios sugerem que” ou “aparentemente”", sugestoes: ["os indícios sugerem que", "aparentemente"], classe: "atenuacao", seguro: false, tom: "formal", exemplo: "me parece que o resultado mudou" },
  { rx: /(?<![\p{L}])meio[^\S\n]+que(?![\p{L}])/giu, message: "“meio que” é oral — use “de certa forma” ou retire; risco: pode atenuar algo que você quer afirmar", sugestoes: ["de certa forma"], classe: "atenuacao", seguro: false, tom: "formal", exemplo: "o texto meio que fugiu do tema" },
  { rx: /(?<![\p{L}])mais[^\S\n]+ou[^\S\n]+menos(?=[^\S\n]+\d)/giu, message: "“mais ou menos” antes de número → “aproximadamente”", fix: "aproximadamente", classe: "atenuacao", seguro: true, tom: "neutro", exemplo: "mais ou menos 30 participantes" },
  { rx: /(?<![\p{L}])mais[^\S\n]+ou[^\S\n]+menos(?!\s*\d)/giu, message: "“mais ou menos” pode virar “aproximadamente” ou “parcialmente”; risco: pode ser avaliação, não quantidade", sugestoes: ["aproximadamente", "parcialmente"], classe: "atenuacao", seguro: false, tom: "formal", exemplo: "o desempenho ficou mais ou menos" },
  { rx: /(?<![\p{L}])pode[^\S\n]+ser[^\S\n]+que(?![\p{L}])/giu, message: "“pode ser que” → “é possível que”", sugestoes: ["é possível que"], classe: "atenuacao", seguro: false, tom: "formal", exemplo: "pode ser que o prazo mude" },

  // ---------------------------------------------------------------- redundância
  { rx: /(?<![\p{L}])subir[^\S\n]+para[^\S\n]+cima(?![\p{L}])/giu, message: "redundância: “subir para cima” → “subir”", fix: "subir", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "vamos subir para cima agora" },
  { rx: /(?<![\p{L}])descer[^\S\n]+para[^\S\n]+baixo(?![\p{L}])/giu, message: "redundância: “descer para baixo” → “descer”", fix: "descer", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "precisamos descer para baixo" },
  { rx: /(?<![\p{L}])entrar[^\S\n]+para[^\S\n]+dentro(?![\p{L}])/giu, message: "redundância: “entrar para dentro” → “entrar”", fix: "entrar", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "ele foi entrar para dentro" },
  { rx: /(?<![\p{L}])sair[^\S\n]+para[^\S\n]+fora(?![\p{L}])/giu, message: "redundância: “sair para fora” → “sair”", fix: "sair", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "não dá para sair para fora" },
  { rx: /(?<![\p{L}])repetir[^\S\n]+de[^\S\n]+novo(?![\p{L}])/giu, message: "redundância: “repetir de novo” → “repetir”", fix: "repetir", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "vou repetir de novo o teste" },
  { rx: /(?<![\p{L}])prever[^\S\n]+antecipadamente(?![\p{L}])/giu, message: "redundância: “prever antecipadamente” → “prever”", fix: "prever", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "é difícil prever antecipadamente o resultado" },
  { rx: /(?<![\p{L}])planejar[^\S\n]+antecipadamente(?![\p{L}])/giu, message: "redundância: “planejar antecipadamente” → “planejar”", fix: "planejar", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "é melhor planejar antecipadamente" },
  { rx: /(?<![\p{L}])elo[^\S\n]+de[^\S\n]+ligação(?![\p{L}])/giu, message: "redundância: “elo de ligação” → “elo” (ou “ligação”)", fix: "elo", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "o elo de ligação entre as áreas" },
  { rx: /(?<![\p{L}])verdade[^\S\n]+real(?![\p{L}])/giu, message: "redundância: “verdade real” → “verdade”", fix: "verdade", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "a verdade real dos fatos" },
  { rx: /(?<![\p{L}])certeza[^\S\n]+absoluta(?![\p{L}])/giu, message: "redundância: “certeza absoluta” → “certeza”", fix: "certeza", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "não há certeza absoluta sobre isso" },
  { rx: /(?<![\p{L}])monopólio[^\S\n]+exclusivo(?![\p{L}])/giu, message: "redundância: “monopólio exclusivo” → “monopólio”", fix: "monopólio", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "o monopólio exclusivo da empresa" },
  { rx: /(?<![\p{L}])acabamento[^\S\n]+final(?![\p{L}])/giu, message: "redundância: “acabamento final” → “acabamento”", fix: "acabamento", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "falta o acabamento final" },
  { rx: /(?<![\p{L}])conclusão[^\S\n]+final(?![\p{L}])/giu, message: "“conclusão final” reforça demais — prefira “conclusão”", sugestoes: ["conclusão"], classe: "redundancia", seguro: false, tom: "formal", exemplo: "na conclusão final, retomamos o tema" },
  { rx: /(?<![\p{L}])em[^\S\n]+duas[^\S\n]+metades[^\S\n]+iguais(?![\p{L}])/giu, message: "redundância: “em duas metades iguais” → “em duas metades” (ou “ao meio”)", fix: "em duas metades", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "o bolo foi cortado em duas metades iguais" },
  { rx: /(?<![\p{L}])mais[^\S\n]+melhor(?![\p{L}])/giu, message: "“mais melhor” não existe — use “melhor”", fix: "melhor", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "essa opção é mais melhor" },
  { rx: /(?<![\p{L}])menos[^\S\n]+pior(?![\p{L}])/giu, message: "“menos pior” → “menos ruim”", fix: "menos ruim", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "o cenário ficou menos pior" },
  { rx: /(?<![\p{L}])encarar[^\S\n]+de[^\S\n]+frente(?![\p{L}])/giu, message: "redundância: “encarar de frente” → “encarar”", fix: "encarar", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "é preciso encarar de frente o problema" },
  { rx: /(?<![\p{L}])pequenos[^\S\n]+detalhes(?![\p{L}])/giu, message: "redundância: “pequenos detalhes” → “detalhes”", fix: "detalhes", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "atenção aos pequenos detalhes" },
  { rx: /(?<![\p{L}])totalmente[^\S\n]+único(?![\p{L}])/giu, message: "redundância: “totalmente único” → “único”", fix: "único", classe: "redundancia", seguro: true, tom: "neutro", exemplo: "esse caso é totalmente único" },
];
