// Modelos guiados para escrever documentos que "ensinam" uma IA: Skills (SKILL.md) e Regras do agente
// (AGENTS.md, CLAUDE.md, GEMINI.md). Cada modelo é só dados + duas funções puras:
//   gerar(valores) -> Markdown        e        checar(valores) -> dicas de qualidade.
// Para criar outro tipo (ex.: um comando, um prompt de sistema), basta acrescentar um modelo à lista MODELOS.

export type TipoCampo = "texto" | "area" | "lista" | "escolha";

export interface Campo {
  id: string;
  rotulo: string;
  /** frase curta que explica o que escrever (aparece abaixo do campo) */
  ajuda: string;
  tipo: TipoCampo;
  placeholder?: string;
  /** só para "escolha" */
  opcoes?: string[];
}

export type Valores = Record<string, string>;

export interface Dica {
  nivel: "ok" | "aviso" | "erro";
  texto: string;
}

export interface Modelo {
  id: string;
  nome: string;
  /** nome do arquivo que o modelo cria (pode depender dos valores) */
  arquivo: (v: Valores) => string;
  resumo: string;
  campos: Campo[];
  exemplo: Valores;
  gerar: (v: Valores) => string;
  checar: (v: Valores) => Dica[];
}

/** Uma linha por item; tira marcadores ("-", "*", "1.") que a pessoa tenha digitado. */
export function itens(texto: string | undefined): string[] {
  return (texto ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

const limpo = (s: string | undefined) => (s ?? "").trim();

/** Valor de uma linha do frontmatter YAML: entre aspas só quando precisa. */
function yaml(valor: string): string {
  const v = valor.replace(/\s*\n\s*/g, " ").trim();
  return /^[\w][^:#]*$/.test(v) && !/^(true|false|null|yes|no)$/i.test(v) ? v : JSON.stringify(v);
}

const marcadores = (l: string[]) => l.map((i) => `- ${i}`).join("\n");
const numerados = (l: string[]) => l.map((i, n) => `${n + 1}. ${i}`).join("\n");

function secao(titulo: string, corpo: string): string {
  return corpo ? `## ${titulo}\n\n${corpo}\n` : "";
}

/** Nome de skill: minúsculas, números e hífens. */
export function nomeDeSkill(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

// ---------------------------------------------------------------------------
// Skill
// ---------------------------------------------------------------------------

const skill: Modelo = {
  id: "skill",
  nome: "Skill",
  arquivo: () => "SKILL.md",
  resumo: "Ensina a IA a fazer uma tarefa do seu jeito. A IA só lê o texto quando a descrição combina com o pedido.",
  campos: [
    { id: "nome", rotulo: "Nome", tipo: "texto", placeholder: "revisar-contrato", ajuda: "Minúsculas, números e hífen. É o nome da pasta da skill." },
    {
      id: "descricao",
      rotulo: "Descrição (o que faz e quando usar)",
      tipo: "area",
      placeholder: "Revisa contratos em PDF ou .docx e lista cláusulas de risco. Use quando o usuário pedir análise, revisão ou resumo de um contrato.",
      ajuda: "É o que a IA lê para decidir se usa a skill. Diga o que ela faz E em que situações usar.",
    },
    { id: "titulo", rotulo: "Título", tipo: "texto", placeholder: "Revisão de contratos", ajuda: "Título que aparece no topo do documento." },
    { id: "quando", rotulo: "Quando usar", tipo: "lista", placeholder: "O usuário envia um contrato\nO usuário pede resumo de cláusulas", ajuda: "Uma situação por linha." },
    { id: "passos", rotulo: "Passo a passo", tipo: "lista", placeholder: "Leia o contrato inteiro antes de comentar\nListe as partes, o prazo e o valor\nMarque cláusulas de risco com o motivo", ajuda: "Uma etapa por linha, na ordem em que a IA deve fazer." },
    { id: "regras", rotulo: "Regras e cuidados", tipo: "lista", placeholder: "Nunca invente cláusulas que não estão no texto\nCite o número da cláusula", ajuda: "O que sempre fazer e o que nunca fazer." },
    { id: "exemplo", rotulo: "Exemplo de resultado", tipo: "area", placeholder: "**Cláusula 7 — Multa** · Risco alto: multa de 30% sem limite.", ajuda: "Mostre um pedaço de uma resposta boa. Exemplos valem mais que explicações." },
    { id: "apoio", rotulo: "Arquivos de apoio", tipo: "lista", placeholder: "modelo-parecer.md — formato do parecer final\nglossario.md — termos jurídicos", ajuda: "Formato: arquivo — para que serve. A IA abre só quando precisar." },
  ],
  exemplo: {
    nome: "revisar-contrato",
    descricao: "Revisa contratos em PDF ou .docx e lista cláusulas de risco. Use quando o usuário pedir análise, revisão ou resumo de um contrato.",
    titulo: "Revisão de contratos",
    quando: "O usuário envia um contrato\nO usuário pede o resumo das cláusulas\nO usuário pergunta se um contrato é seguro assinar",
    passos: "Leia o contrato inteiro antes de comentar\nListe as partes, o prazo e o valor\nMarque cada cláusula de risco com o motivo\nTermine com um resumo de 3 linhas e uma recomendação",
    regras: "Nunca invente cláusulas que não estão no texto\nCite sempre o número da cláusula\nSe faltar informação, pergunte antes de concluir",
    exemplo: "**Cláusula 7 — Multa rescisória**\nRisco: alto. A multa é de 30% do contrato sem limite de valor.",
    apoio: "modelo-parecer.md — formato do parecer final\nglossario.md — termos jurídicos usados",
  },
  gerar(v) {
    const nome = nomeDeSkill(v.nome || v.titulo || "") || "minha-skill";
    const titulo = limpo(v.titulo) || nome;
    const quando = itens(v.quando);
    const passos = itens(v.passos);
    const regras = itens(v.regras);
    const apoio = itens(v.apoio).map((l) => {
      const [arq, ...resto] = l.split(/\s+[—–-]\s+/);
      return resto.length ? `\`${arq.trim()}\` — ${resto.join(" — ").trim()}` : `\`${arq.trim()}\``;
    });
    const exemplo = limpo(v.exemplo);
    const partes = [
      `---\nname: ${nome}\ndescription: ${yaml(limpo(v.descricao) || "Descreva o que a skill faz e quando usar.")}\n---\n`,
      `# ${titulo}\n`,
      secao("Quando usar", marcadores(quando)),
      secao("Passo a passo", numerados(passos)),
      secao("Regras", marcadores(regras)),
      secao("Exemplo", exemplo ? exemplo.split("\n").map((l) => `> ${l}`).join("\n") : ""),
      secao("Arquivos de apoio", marcadores(apoio)),
    ];
    return partes.filter(Boolean).join("\n").trimEnd() + "\n";
  },
  checar(v) {
    const d: Dica[] = [];
    const nome = nomeDeSkill(v.nome || "");
    if (!limpo(v.nome)) d.push({ nivel: "erro", texto: "Dê um nome à skill." });
    else if (nome !== limpo(v.nome)) d.push({ nivel: "aviso", texto: `O nome será gravado como "${nome}" (minúsculas, números e hífen).` });
    const desc = limpo(v.descricao);
    if (!desc) d.push({ nivel: "erro", texto: "Falta a descrição: sem ela a IA não sabe quando usar a skill." });
    else {
      if (desc.length < 40) d.push({ nivel: "aviso", texto: "Descrição curta demais: diga o que a skill faz e quando usar." });
      if (desc.length > 1024) d.push({ nivel: "erro", texto: "Descrição passou de 1024 caracteres." });
      if (!/\b(quando|use|usar|sempre que|se o usu)/i.test(desc)) d.push({ nivel: "aviso", texto: 'Inclua "Use quando…" na descrição: é o gatilho que faz a IA escolher esta skill.' });
    }
    if (!itens(v.passos).length) d.push({ nivel: "aviso", texto: "Sem passo a passo: a IA vai improvisar a ordem." });
    if (!limpo(v.exemplo)) d.push({ nivel: "aviso", texto: "Um exemplo de resultado melhora muito a qualidade das respostas." });
    if (!d.some((x) => x.nivel !== "ok")) d.push({ nivel: "ok", texto: "Tudo certo: nome, descrição com gatilho, passos e exemplo." });
    return d;
  },
};

// ---------------------------------------------------------------------------
// Regras do agente
// ---------------------------------------------------------------------------

const ALVOS = ["AGENTS.md", "CLAUDE.md", "GEMINI.md"];

const regras: Modelo = {
  id: "regras",
  nome: "Regras do agente",
  arquivo: (v) => (ALVOS.includes(limpo(v.alvo)) ? limpo(v.alvo) : "AGENTS.md"),
  resumo: "Instruções fixas que a IA lê no começo de toda conversa sobre o projeto: comandos, estilo, limites.",
  campos: [
    { id: "alvo", rotulo: "Arquivo", tipo: "escolha", opcoes: ALVOS, ajuda: "AGENTS.md é aceito por vários agentes; CLAUDE.md é o do Claude Code; GEMINI.md o do Gemini CLI." },
    { id: "projeto", rotulo: "Nome do projeto", tipo: "texto", placeholder: "mdOffice", ajuda: "Aparece no título." },
    { id: "resumo", rotulo: "O que é o projeto", tipo: "area", placeholder: "Editor de documentos (Markdown, .docx, .xlsx e .pptx) em Tauri + TypeScript.", ajuda: "Duas frases: o que é e para quem." },
    { id: "stack", rotulo: "Tecnologias", tipo: "lista", placeholder: "Tauri 2 + Rust\nTypeScript + Vite, sem framework", ajuda: "Uma por linha." },
    { id: "comandos", rotulo: "Comandos úteis", tipo: "lista", placeholder: "npm run dev — abre o app\nnpx tsc --noEmit — confere os tipos", ajuda: "Formato: comando — o que faz." },
    { id: "estrutura", rotulo: "Onde fica cada coisa", tipo: "lista", placeholder: "src/word — editor de documentos .docx\nsrc/excel — planilhas", ajuda: "Formato: pasta — conteúdo." },
    { id: "estilo", rotulo: "Estilo de código", tipo: "lista", placeholder: "Siga o estilo dos arquivos vizinhos\nComentários só onde o porquê não é óbvio", ajuda: "Convenções que a IA deve seguir." },
    { id: "fluxo", rotulo: "Como trabalhar", tipo: "lista", placeholder: "Leia o código antes de mudar\nRode os testes antes de dizer que terminou", ajuda: "Hábitos que você espera do agente." },
    { id: "nunca", rotulo: "Nunca faça", tipo: "lista", placeholder: "Nunca apague arquivos do usuário\nNunca faça push sem eu pedir", ajuda: "Limites firmes. Seja específico." },
  ],
  exemplo: {
    alvo: "AGENTS.md",
    projeto: "mdOffice",
    resumo: "Editor de documentos (Markdown, .docx, .xlsx e .pptx) em Tauri + TypeScript, feito para uso offline.",
    stack: "Tauri 2 + Rust\nTypeScript + Vite, sem framework de interface",
    comandos: "npm run dev — abre o app em modo de desenvolvimento\nnpx tsc --noEmit — confere os tipos\nnpm run test:pptx-edicao — testa a edição de apresentações",
    estrutura: "src/word — motor dos documentos .docx\nsrc/excel — planilhas e fórmulas\nsrc/powerpoint — apresentações .pptx",
    estilo: "Siga o estilo dos arquivos vizinhos\nComentários só onde o porquê não é óbvio\nTextos da interface em português do Brasil",
    fluxo: "Leia o código antes de mudar\nRode a checagem de tipos e os testes antes de dizer que terminou\nPeça confirmação antes de mudanças grandes",
    nunca: "Nunca apague arquivos do usuário\nNunca faça push ou commit sem eu pedir\nNunca mexa em src/excel sem aviso",
  },
  gerar(v) {
    const alvo = ALVOS.includes(limpo(v.alvo)) ? limpo(v.alvo) : "AGENTS.md";
    const nome = limpo(v.projeto) || "Projeto";
    const comando = (l: string) => {
      const [c, ...r] = l.split(/\s+[—–]\s+/);
      return r.length ? `\`${c.trim()}\` — ${r.join(" — ").trim()}` : `\`${c.trim()}\``;
    };
    const pasta = (l: string) => {
      const [c, ...r] = l.split(/\s+[—–]\s+/);
      return r.length ? `\`${c.trim()}\` — ${r.join(" — ").trim()}` : `\`${c.trim()}\``;
    };
    const nunca = itens(v.nunca);
    const quemLe = alvo === "CLAUDE.md" ? "o Claude Code" : alvo === "GEMINI.md" ? "o Gemini CLI" : "agentes de código";
    const partes = [
      `# ${nome}\n`,
      `> Instruções para ${quemLe}. Leia antes de mexer no projeto.\n`,
      secao("Visão geral", limpo(v.resumo)),
      secao("Tecnologias", marcadores(itens(v.stack))),
      secao("Comandos", marcadores(itens(v.comandos).map(comando))),
      secao("Estrutura", marcadores(itens(v.estrutura).map(pasta))),
      secao("Estilo de código", marcadores(itens(v.estilo))),
      secao("Como trabalhar", marcadores(itens(v.fluxo))),
      secao("Limites", nunca.length ? marcadores(nunca.map((n) => (/^nunca\b/i.test(n) ? n : `Nunca ${n.charAt(0).toLowerCase()}${n.slice(1)}`))) : ""),
    ];
    return partes.filter(Boolean).join("\n").trimEnd() + "\n";
  },
  checar(v) {
    const d: Dica[] = [];
    if (!limpo(v.projeto)) d.push({ nivel: "erro", texto: "Dê um nome ao projeto." });
    if (!limpo(v.resumo)) d.push({ nivel: "aviso", texto: "Explique em duas frases o que é o projeto." });
    if (!itens(v.comandos).length) d.push({ nivel: "aviso", texto: "Sem comandos: o agente vai adivinhar como rodar e testar." });
    if (!itens(v.nunca).length) d.push({ nivel: "aviso", texto: 'Liste ao menos um limite em "Nunca faça" (ex.: apagar dados, fazer push).' });
    const linhas = regras.gerar(v).split("\n").length;
    if (linhas > 150) d.push({ nivel: "aviso", texto: `Ficou longo (${linhas} linhas): quanto menor, mais a IA respeita. Corte o que ela já descobre lendo o código.` });
    if (!d.length) d.push({ nivel: "ok", texto: "Tudo certo: resumo, comandos e limites definidos." });
    return d;
  },
};

export const MODELOS: Modelo[] = [skill, regras];
