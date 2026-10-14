# ABNT — como escrever uma regra

O motor ABNT separa **dado** de **julgamento**:

- **Dado:** a regra declarada em `.toml` — id, norma, severidade, o padrão (ou o
  verificador), a mensagem, a troca. Vive em `src/broker/abnt/regras/`.
- **Julgamento:** o que não cabe em dado, em código curto e declarado: os
  **transformadores** (`interpretador.ts`) e os **verificadores**
  (`src/broker/abnt/verificadores/`, um arquivo por grupo de regras).

O lint (`lint.ts`) confere tudo **na carga**: regra com sintaxe fora do dialeto, `{nome}`
que não é grupo nomeado, `<<classe>>` no lugar errado, bloco desconhecido, tipo sem
verificador — **derrubam a carga**. Não existe regra pela metade em silêncio.

Leia antes: `src/broker/abnt/regras/*.toml` (dez exemplos reais),
`src/broker/abnt/esquema.ts` (o vocabulário), `src/broker/abnt/documento.ts` (o modelo).

## 1. Regra de texto (`tipo` padrão)

```toml
id = "abnt.r06"
norma = "nbr6023:2025"
grupo = "R"
severidade = "warning"
escopo = "bloco"
contexto = { blocos = ["referencias"] }
ignorar_caixa = true
regex = '(?<trecho>dispon[íi]vel[<<espaco>>]+em)'
trecho = "trecho"
antes = "nao_letra"
depois = "nao_espaco"
mensagem = "[ABNT NBR 6023:2025] …"
```

| campo | o que é |
| --- | --- |
| `id` | estável, único, `abnt.<grupo><nn>` (ex.: `abnt.e01`) — é a chave do perfil e do relatório |
| `norma` | `nbr14724:2024`, `nbr10520:2023`, `nbr6023:2025`, `nbr6027:2012`, `nbr6024:2012`, `nbr6028:2021`, `nbr15287:2025`, `abnt:tipografia`, `ibge:1993` |
| `grupo` | letra do catálogo (`E`, `C`, `R`, `S`, `A`, `P`, `T`; as antigas são `T`) |
| `severidade` | `warning` (padrão), `error` (só quando é regra dura de norma), `suggestion` (confiança baixa / sem consenso) |
| `auto` | **quase nunca.** Só com troca mecânica e inequívoca. Regra de conferência **não** é auto |
| `regex` | o padrão, no dialeto da seção 2 |
| `trecho` | qual **grupo nomeado** do padrão é o aviso e o alvo da troca — não é opcional |
| `antes` / `depois` | predicados de borda (seção 2) |
| `substituir` | a troca, com `{captura}`. **Opcional**: sem ele, a regra é de aviso (acusa sem saber a troca) |
| `mensagem` | o texto do aviso, com `{captura}`; cite a norma: `[ABNT NBR 6023:2025] …` |
| `ignorar_caixa` | liga a flag `i` — use para palavra fixa, não para capturas |
| `pular_se_igual` | não acusa quando a troca ficaria idêntica ao que já está escrito |
| `escopo` + `contexto.blocos` | restringe a regra a seções do documento (seção 3) |

**Regra de aviso** (sem `substituir` e sem `transformar`): o aviso sai sem sugestão. É o
caso de “complete os dados da referência” — a máquina não sabe o dado que falta.

## 2. O dialeto (fechado)

- **Lookaround não existe.** Borda é predicado (`antes`/`depois`), que não consome nada —
  e é **verdadeiro nas bordas do texto** (o que substitui o `(?<!…)`).
- **Shorthand de regex é recusado:** `\d`, `\s`, `\w`, `\b` (o significado muda de motor
  para motor). Use as classes e predicados.
- **Classes** (referência `<<nome>>` **dentro** de `[ ]`): `espaco` (o `\s` do JS, code
  point a code point), `digito` (`0-9`), `palavra_ascii` (o `\w` do JS).
- **Listas** (referência `<<nome>>` **fora** de `[ ]`): `meses`, `latinismo`.
- **Sem lista de exclusão de contexto:** para “exceto quando…”, escreva a condição na
  borda ou num grupo.
- Todo `{nome}` na `mensagem`/`substituir` precisa ser **grupo nomeado** do próprio
  padrão. `{nome:minusculo}` e `{nome:mapa}` são os formatos; `mapa` precisa de
  `[regra.mapa]`.
- **A troca substitui o `trecho`**, não o match inteiro.
- Ao descartar um match, a busca retoma **um caractere depois do INÍCIO dele** (decisão do
  motor, não da regra).

## 3. Escopo de bloco

```toml
escopo = "bloco"
contexto = { blocos = ["referencias", "resumo"] }
```

A regra só acusa dentro das seções cujo título casa com o bloco. **Bloco que não existe
no documento é silêncio** — quem cobra a existência é a regra de estrutura (R01).

Blocos conhecidos (`BLOCOS` em `esquema.ts`): `referencias`, `resumo`, `abstract`,
`sumario`, `lista-de-figuras`, `lista-de-tabelas`, `lista-de-siglas`,
`lista-de-abreviaturas`, `lista-de-simbolos`, `glossario`, `apendices`, `anexos`, `capa`,
`folha-de-aprovacao`, `folha-de-rosto`.

O título é normalizado: sem numeração, sem acento, caixa alta, sem dois-pontos no fim.
Casa por **palavra inteira no começo**: `REFERÊNCIAS BIBLIOGRÁFICAS` casa com
`referencias`; `Referencial teórico` **não** casa.

## 4. Regra de estrutura (`tipo = "estrutura"`)

```toml
id = "abnt.e01"
norma = "nbr14724:2024"
grupo = "E"
severidade = "warning"
tipo = "estrutura"
verifica = "secoes-obrigatorias"
opcoes = { obrigatorias = ["RESUMO", "ABSTRACT", "REFERÊNCIAS"] }
mensagem = "(o verificador escreve a mensagem)"
```

O TOML é a **declaração**; o julgamento está em
`src/broker/abnt/verificadores/<arquivo-do-grupo>.ts`, num mapa
`Record<string, Verificador>`:

```ts
export const VERIFICADORES: Record<string, Verificador> = {
  "secoes-obrigatorias": (doc, regra) => {
    const obrigatorias = opcaoLista(regra, "obrigatorias");
    // … devolve Aviso[] { from, to, mensagem, fix?, sugestoes?, auto? }
  },
};
```

Contrato (`verificadores/tipos.ts`):

- `(doc: Documento, regra: RegraToml) => Aviso[]`.
- `opcoes` do TOML chega em `regra.opcoes`; leia com `opcaoTexto` / `opcaoLista` /
  `opcaoNumero` (elas reclamam quando falta).
- **Aviso sem trecho não aparece**: o motor descarta aviso de trecho vazio. Para “falta
  isto”, ancore no vizinho que existe ou use `ancoraNoFim(doc)` (é ali que o elemento
  entraria) e explique na mensagem.
- A mensagem é **sua** (o TOML de estrutura não a escreve) — cite a norma.
- `auto` do aviso sobrepõe o da regra; use com parcimônia.

**Faça a mensagem apontar o que fazer**, não só o que falta — e, quando souber, devolva
`fix`/`sugestoes`.

## 5. O modelo do documento (`documento.ts`)

`documentoDe(texto)` (uma leitura por texto, compartilhada):

- `linhas`: cada linha com faixa e tipo — `vazio`, `titulo`, `cerca`, `codigo`, `citacao`,
  `lista`, `tabela`, `imagem`, `regua`, `texto`.
- `paragrafos`: linhas consecutivas não vazias (a unidade de uma referência).
- `secoes`: nível, título, faixa do título (`tituloFrom`/`tituloTo`), da seção (`from`/`to`,
  até o próximo título de nível igual ou menor), `corpoFrom`, `fimDoConteudo`.
- `blocos`: as seções de cada bloco conhecido; `regioesDeBlocos(nomes)` dá as faixas;
  `estaEmBloco(nomes, from, to)` responde pontualmente.
- `contarPalavras(texto)`, `ancoraNoFim(doc)`, `ancoraNoInicio(doc)`.

O modelo lê o **texto original** (não a máscara): a máscara esconde código e links.

## 6. Convenções

- **Id:** `abnt.<catálogo minúsculo>` — `abnt.e01`, `abnt.c03`, `abnt.r11`. É o que o
  relatório por norma e o perfil usam; não mude depois de entregue.
- **Mensagens:** começam com `[ABNT NBR <norma>:<ano>]` (ou `[ABNT]` nas de tipografia),
  dizem o que está errado e o que fazer.
- **Falso positivo é pior que falso negativo.** A confiança do catálogo manda: confiança
  baixa vira `suggestion`; regra que dispara em texto correto do corpus é **apertada até
  não disparar**.
- O corpus (`node scripts/testar-correcoes.mts`) é a rede de segurança: ele tem que
  continuar **34/34 casos corrigidos e 34/34 textos corretos preservados**.

## 7. Testes

Use o ajudante `scripts/abnt/ferramentas.mts`:

```ts
import { checa, fim, regrasDe, rodar, verificar, documento } from "./abnt/ferramentas.mts";

const regras = await regrasDe("abnt.c");              // só as do seu prefixo
const avisos = await rodar("(Silva)", regras);        // mesma máscara do app
checa("acusa sem o ano", avisos.length === 1, JSON.stringify(avisos));

const fora = await rodar("(Silva, 2020)", regras);    // o caso correto
checa("não acusa com o ano", fora.length === 0, JSON.stringify(fora));

// verificador:
const saida = await verificar("secoes-obrigatorias", "# INTRODUÇÃO\n\ntexto", {
  obrigatorias: ["RESUMO"],
});
checa("acusa o resumo que falta", saida.length === 1, JSON.stringify(saida));

fim();
```

Todo teste tem **os dois lados**: o caso que acusa e o caso correto que **não** acusa.
Sem o segundo, o teste não prova precisão.

## 8. Antes de fechar (dentro da worktree)

```powershell
npx tsc --noEmit                          # limpo
node scripts/testar-regras-abnt.mts       # teste de ouro das dez antigas: "Tudo certo"
node scripts/testar-abnt-contexto.mts     # a base nova: "Tudo certo"
node scripts/testar-correcoes.mts         # corpus: 34/34 e 34/34
node scripts/testar-abnt-<grupo>.mts      # o seu
```

Depois: `CHANGELOG.md` (em **Não adicionado**, categoria **MD\***) e
`docs/historico-tecnico.md` — o `fechar.ps1` **bloqueia** sem os dois. Conflitos comuns no
rebase, quando outro trabalho entrou antes: `src/broker/abnt/index.ts` (a lista `FONTES`),
`CHANGELOG.md`, `docs/historico-tecnico.md`, `package.json` — resolva **mantendo os dois
lados** (`git add` e rode o `fechar.ps1` de novo).
