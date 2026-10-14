# Estilos de cor (PowerPoint) — plano completo, por rodadas

> **Status:** R1 entregue (motor de cor + `test:estilos`); R2–R6 pendentes.
> **Onde vive:** `docs/estilos-de-cor-plano.md` (cópia da R1; o original da conversa fica na pasta
> de planos do OpenCode, fora do repositório).
> **Como retomar uma rodada nova:** leia a seção da rodada pendente (cada uma é autossuficiente),
> rode `tools\worktrees\status.ps1`, abra a worktree e execute o checklist da rodada.

## Progresso

- [x] **R1 — motor de cor** (`src/powerpoint/edicao/estilos.ts`) + `test:estilos` — entregue
  (2026-10-14). Tipos e campos opcionais já no `schema.ts` (`estilo`, `capa`, `bgEstilo`).
- [x] **R2 — estilo na forma** (galeria na fita + seção no painel + vivo + lustro) — entregue
  (2026-10-14). `estiloCor`/`comPintura` no host, `estilos.ts` ganhou `ligarEstilo`/`soltarEstilo`;
  a cor do preenchimento é a cor-base e a pintura manual solta o estilo.
- [x] **R3 — dobra** (forma-capa) + caso de ouro de exportação no `.pptx` — entregue (2026-10-14).
  A capa nasce agrupada com a base (e o desagrupar manda); a cópia remapeia o grude; o
  `test:pptx-edicao` prende o `a:gradFill`/alfas/`p:grpSp` do estilo.
- [x] **R4 — fundo da lâmina** com estilo — entregue (2026-10-14). "Fundo com estilo" no popover
  do fundo e na seção da lâmina do painel; no fundo a dobra vira lustro e o "Aplicar a todas"
  leva a receita junto.
- [ ] **R5 — modelos** (Design) com estilo
- [ ] **R6 — polimento** (opcional)

---

## 1. O pedido e a referência

O usuário monta organogramas/apresentações à mão no PowerPoint do mdOffice e quer um **sistema
novo capaz de estilizar cores** com a beleza da imagem de referência (o cartão
“T.I. CAMBÉ / INFRAESTRUTURA”).

**O que a imagem tem (decomposição):**
1. **Gradiente diagonal** com ~3 tons: verde vivo → verde médio → **teal escuro** (o tom escuro
   desvia o matiz para o frio — é isso que deixa “premium” em vez de “verde sujo”).
2. **Brilho diagonal** (dobra/lustro translúcido) sobre a parte direita.
3. Cantos bem arredondados, filete separando ícone e texto, tipografia branca (título forte,
   subtítulo leve).

**Decisões fechadas com o usuário (4 perguntas respondidas):**

| Pergunta | Resposta |
|---|---|
| Onde o estilo entra no v1 | **Formas + fundo de lâmina + Modelos** (as três frentes) |
| Pintura aplicada ou **vivo** | **Vivo** — a forma lembra a família/cor-base e o visual se recalcula quando a cor muda |
| O brilho diagonal entra? | **Sim**, com opção no painel (Sem brilho / Lustro / Dobra) |
| O estilo casa o resto? | **Tudo casado** — contorno, sombra e cor do texto por contraste |

O objetivo final é reproduzir o cartão da imagem **em dois cliques** (galeria ▸ Esmeralda) e
poder trocar a cor mantendo a beleza da rampa.

---

## 2. O que o app JÁ tem (não reinventar)

Levantado no código (leitura real, nada suposto):

- **Gradiente no modelo:** `src/powerpoint/schema.ts` — `Fill` com `kind: "gradient"`,
  `stops: { pos, color, alpha }[]`, `angle`, `radial`; vale para forma (`fillX`) e fundo (`slide.bg`).
- **Desenho:** `src/powerpoint/render/forma.ts` (linhas ~203-247) — gradiente linear/radial em SVG
  com **alfa por parada** (`stop-opacity`), tanto na forma quanto no fundo.
- **Painel:** `src/powerpoint/ui/painel.ts` (~150-165 e ~388-390) — editor de gradiente
  (paradas com cor/posição, +/×, ângulo) para forma e fundo.
- **Popover de preenchimento:** `src/powerpoint/ui/fita.ts` `menuPreenchimento()` (~921) —
  6 orientações (`grad:cima/baixo/...`) construídas a partir da cor atual.
- **Funções de formato:** `src/powerpoint/edicao/formato.ts` — `solido`, `gradiente(c1,c2,ang)`,
  `corPrincipal`, `ajustarCor` (clareia/escurece misturando com branco/preto — é o que “lava” a
  cor; o motor novo entra no lugar dela), `comPreenchimento`, `comLinha`, `comSombra`,
  `SOMBRAS_PRONTAS`; **não** mexe em cantos (`comCantos` é assunto do controle de cantos).
- **Estilos rápidos de hoje:** `ui/fita.ts` `ESTILOS_RAPIDOS` (cheio/contorno/gradiente/cartão/
  escuro/suave) → `powerpoint.ts` `case "estilo":` → `estiloRapido()`. **Permanecem** (o sistema
  novo é adicional).
- **Exportação fiel:** `src/powerpoint/pptxexport/rica.ts` `fillXml()` (~144-166) — grava
  `<a:gradFill>` com **todas as paradas** (`a:gsLst`), **alfa por parada** (`a:alpha`), `a:lin ang`
  (linear) ou `a:path` (radial); contorno em `a:ln`, sombra em efeitos, texto em runs. **A ida é
  nativa** — é o que permite “exportar e ver igual no PowerPoint”.
- **Precedente do “derivado + recálculo”: `src/powerpoint/edicao/ligacoes.ts`** (tarefa Conectar,
  recém-entregue) — campo `liga` na forma, `atualizarLigacoes(slide, dim, acento)` chamada dentro
  de `substituirSlide` em `powerpoint.ts` (~546), órfãos removidos, cópia/colar remapeada em
  `clonarFormas` (`edicao/operacoes.ts`). **O estilo vivo copia esse padrão.**
- **Temas e modelos:** `src/powerpoint/edicao/modelos.ts` (`MODELOS`, `aplicarModelo` — troca as
  cores da paleta antiga pelas do tema; o que está fora da paleta fica) e
  `src/powerpoint/edicao/criar.ts` (`estiloDoDeck`, `corDeContraste`) — o acento do tema é a
  “cor automática” do estilo.
- **Convenções:** worktree + `fechar.ps1`; CHANGELOG + `docs/historico-tecnico.md` obrigatórios;
  testes em `scripts/testar-*.mjs` com script `test:*` no `package.json`; validação com
  `node .\node_modules\typescript\bin\tsc --noEmit` e `node .\node_modules\vite\bin\vite.js build`.

---

## 3. Arquitetura

### 3.1 Modelo (`src/powerpoint/schema.ts`)

Tipos novos (no schema, como `Lado`/`Liga`, para não haver ciclo com `edicao/`):

```ts
export type FamiliaEstilo = "esmeralda" | "oceano" | "ameixa" | "ambar" | "rubi" | "grafite" | "propria";
export type IntensidadeEstilo = "suave" | "media" | "forte";
export type BrilhoEstilo = "nada" | "lustro" | "dobra";

export interface EstiloForma {
  familia: FamiliaEstilo;
  intensidade: IntensidadeEstilo;
  brilho: BrilhoEstilo;
  /** cor-base (hex sem #); vazio/ausente = acento do tema (acompanha os Modelos) */
  base?: string;
  /** ângulo do gradiente em graus; padrão 45 (a diagonal do app: 0 = esquerda→direita) */
  angulo?: number;
}
```

Campos novos:
- `Shape.estilo?: EstiloForma` — a forma estilizada (o estilo manda na aparência).
- `Shape.capa?: { de: string }` — a forma do **brilho-dobra**, derivada da base (posição/giro
  acompanham; apagar a base leva a capa; copiar/colar remapeia).
- `Slide.bgEstilo?: EstiloForma` — fundo de lâmina com estilo (brilho "dobra" não vale no fundo;
  ver 3.5).
- `ModeloPPT.estilo?: { familia: FamiliaEstilo; intensidade: IntensidadeEstilo; brilho: BrilhoEstilo }`
  (+ opcional `base`) — o modelo carrega o estilo do deck.

### 3.2 Motor puro (`src/powerpoint/edicao/estilos.ts`, novo)

Sem DOM, sem dependências novas (nada de npm). Contratos:

```ts
// cor
export function hexParaHsl(hex: string): { h: number; s: number; l: number }; // h 0-360, s/l 0-1
export function hslParaHex(h: number, s: number, l: number): string;
export function contrastePara(cor: string): string; // texto claro (FFFFFF) ou escuro (tom profundo)

// receitas (valores iniciais — travar com o olho e nos testes na R1)
export interface ReceitaEstilo {
  nome: string;
  base: string;   // cor da família (hex sem #)
  desvio: number; // graus de desvio do matiz no tom ESCURO (Esmeralda verde→teal = +20)
}
export const FAMILIAS: Record<FamiliaEstilo, ReceitaEstilo>;

export interface EsquemaEstilo {
  fill: Fill;            // gradiente com N paradas (e as de alfa do lustro)
  ln: Partial<Line>;     // contorno casado (tom escuro, 0,75-1,25 pt)
  shadow: Shadow | null; // sombra leve
  corTexto: string;      // por contraste
}
export function esquemaDoEstilo(e: EstiloForma, tema: { acento: string }): EsquemaEstilo;
export function aplicarEsquemaNaForma(s: Shape, esq: EsquemaEstilo): Shape; // não mexe em box/texto/cantos
export function capaDaDobra(base: Shape, d: Dim, id?: string): Shape; // a forma do brilho-dobra
export function atualizarEstilos(slide: Slide, d: Dim, tema: EstiloDeck): Slide;
```

**Rampa (o coração da beleza):** 3 paradas base — `0%` tom claro (L alto, S levemente menor),
`~45%` a cor-base, `100%` tom escuro (L baixo, S levemente maior e **matiz desviado** pelo
`desvio` da família). Diferença de luminosidade por intensidade (implementada na R1): Suave
+8/−10, Média +13/−17, Forte +18/−24 (pontos de luz). Nada de misturar com branco/preto puro
(isso é o que lava). O mesmo motor vale para o **fundo da lâmina** (`fillDoFundo`, com a dobra
virando lustro — sem forma-capa).

**Lustro (dentro do gradiente, 1 forma só):** paradas extras de **branco com alfa** formando uma
faixa suave perto de 55-75% (`0 → .22 → .10 → 0`, a calibrar), sobrepostas às paradas de cor.
Exporta nativamente (`a:alpha` por parada) — conferido em `rica.ts`.

**Dobra (a forma-capa):** paralelogramo cobrindo ~35-40% da largura à direita, do topo para baixo,
com gradiente de branco translúcido (`.16 → 0`), mesma caixa e giro da base.

**`atualizarEstilos` (o “vivo”):** para cada forma com `estilo` → deriva o esquema (base vazia =
`tema.acento`) e aplica; garante a capa quando `brilho === "dobra"` (inserida **logo depois da
base** na ordem das formas; removida quando o brilho muda); para cada `capa` → recalcula
caixa/giro da base e **remove órfã**; para o slide com `bgEstilo` → deriva o `bg`.
Guarda de custo: `slide.shapes.some((s) => s.estilo || s.capa) || slide.bgEstilo` — sem nada
disso, devolve a MESMA lâmina (referência), custo zero.

### 3.3 O “vivo”: regras de posse (documentadas e testadas)

- Enquanto `estilo` existe, **o estilo manda** em: preenchimento (gradiente+brilho), contorno,
  sombra e `Shape.color` (cor-base do texto). Texto com cor própria por trecho (runs) não é tocado.
- **Trocar a cor** no painel/fita com estilo ligado → atualiza `estilo.base` (mantém
  família/intensidade/brilho) e o recálculo refaz a rampa. O seletor de preenchimento mostra a
  **cor do estilo**, não as paradas.
- **Editar as paradas cruas** do gradiente → desliga o estilo e aplica a edição manual (com aviso
  discreto: “estilo desligado — edição manual”).
- **“Desligar estilo”** (item na galeria e no painel) → remove `estilo` (a capa vira forma comum,
  mantida) e o look atual fica como pintura, editável à mão.
- **Ordem no recálculo:** `atualizarEstilos` ANTES de `atualizarLigacoes` no `substituirSlide`
  (o conector lê a cor da caixa pela primeira parada do gradiente derivado).
- **Undo/redo:** nada extra — tudo é estado da lâmina (mesmo caminho das ligações).
- **Cantos:** o estilo NÃO mexe no raio (assunto do controle de cantos).

### 3.4 Interface

- **Fita — aba “Formato da Forma”**: grupo novo **“Estilos de Cor”** com botão grande “Estilos”
  (mini-prévia real do estilo selecionado/acento) → popover com:
  - grade de **famílias** (Esmeralda, Oceano, Ameixa, Âmbar, Rubi, Grafite, “Da sua cor”) com
    prévia real do gradiente+lustro;
  - **Intensidade** (Suave/Média/Forte), **Acabamento** (Sem brilho/Lustro/Dobra — Dobra entra na R3),
    **Ângulo** (0/45/90/135 + número);
  - **Cor do estilo** (abre o seletor de cores existente);
  - **Desligar estilo**.
  Os `ESTILOS_RAPIDOS` de hoje permanecem (grupo/posição atuais).
- **Painel “Formatar”**: seção **“Estilo”** com os mesmos controles quando a forma tem estilo
  (+ “Desligar estilo” e a dica do que é derivado).
- **Fundo da lâmina**: no popover “Formatar fundo”, seção **“Fundo com estilo”** com as famílias;
  o painel do fundo mostra Intensidade/Ângulo/Cor/Desligar.
- **Aba Design ▸ Modelos**: cada cartão de modelo ganha a prévia do estilo do modelo; aplicar o
  modelo troca o visual como hoje + re-deriva as formas de base vazia + ajusta `bgEstilo`.

### 3.5 Exportação `.pptx` — o que é fiel (e o que não é)

- **Fiel:** gradiente com N paradas + alfa (já exporta), contorno, sombra, texto, e a dobra como
  forma agrupada. Exportar → abrir no PowerPoint: mesmo visual.
- **Não sobrevive:** o conceito “vivo” (o `.pptx` não guarda a família) — reimportar traz o visual
  exato como **pintura**; o app já tem o precedente de avisar quando algo volta simplificado.
- **Fundo:** só lustro/sem brilho (a dobra no fundo criaria forma em toda lâmina).
- **Conferência obrigatória da R3:** caso de ouro — gerar formas estilizadas, exportar, reimportar
  e comparar fills/ln/sombra/texto (o `scripts/testar-edicao-pptx.mjs` e o `test:pptx` já cobrem o
  mecanismo de round-trip) + conferência visual no PowerPoint pelo usuário.

---

## 4. Rodadas (cada uma = uma worktree própria + `fechar.ps1`)

Regra geral: uma rodada por sessão; nada de duas rodadas no mesmo fecho. Se o token apertar,
feche a rodada no estado em que estiver com o aviso “parcial: falta X” **no corpo do commit**
(via `-Proposito`) — o checklist abaixo diz exatamente o que falta.

### R1 — Motor de cor (puro, invisível) — ENTREGUE (2026-10-14)

- **Entrega:** `src/powerpoint/edicao/estilos.ts` + `scripts/testar-estilos.mjs` + `test:estilos`
  no `package.json` + tipos/campos no `schema.ts` (`EstiloForma`, `Shape.estilo`, `Shape.capa`,
  `Slide.bgEstilo`) + este documento em `docs/`. Nada muda na tela.
- **Entregue (para as rodadas seguintes):** `hexParaHsl`/`hslParaHex` (ida e volta),
  `luminancia`/`contrastePara`, `FAMILIAS` (com `desvio`), `rampaDeTons` (claro/cor/escuro),
  `LUSTRO` (paradas de branco com alfa), `esquemaDoEstilo` (fill +45° em diagonal, contorno no
  tom profundo, sombra leve, texto por contraste), `aplicarEsquemaNaForma` (recolore os trechos
  que usavam a cor anterior; os com cor própria ficam), `capaDaDobra` (paralelogramo translúcido,
  mesma caixa/giro, id estável no recálculo), `fillDoFundo` (dobra vira lustro) e
  `atualizarEstilos` (guarda de custo, órfãos, idempotente). `test:estilos` com 55 verificações.
- **Passos (histórico):**
  1. `abrir.ps1 feat/estilos-motor -Porque "..." -Proposito "motor de cor puro (rampas/famílias/esquema) com testes, base das rodadas seguintes"`.
  2. Implementar hex↔HSL (round-trip exato), `contrastePara`, `FAMILIAS` (valores iniciais da
     tabela abaixo), `esquemaDoEstilo`, `aplicarEsquemaNaForma`, `capaDaDobra` (geometria da capa
     pode nascer aqui, mesmo sem UI), `atualizarEstilos` (com a guarda de custo e órfãos).
  3. Testes: round-trip de cor; rampa ordenada (`pos` 0..100, claro→escuro); matiz preservado no
     claro e desviado no escuro; alfa do lustro; contraste; `atualizarEstilos` re-deriva com base
     nova e com tema novo (base vazia acompanha, base fixa não), cria/remove capa, remove órfã,
     lâmina sem estilo devolve a MESMA referência.
  4. `tsc` + testes + build. Copiar este plano para `docs/estilos-de-cor-plano.md`.
- **Aceite:** `test:estilos` verde; nenhuma mudança visível no app. ✓
- **Commit:** `feat(powerpoint): motor de estilos de cor (rampas, familias e esquema)`

**Tabela das famílias** (travada nos testes da R1; ajustes de gosto são livres na R6):

| Família | base | desvio do matiz (escuro) | observação |
|---|---|---|---|
| Esmeralda | `1F9D55` | +20° | verde → teal (a da imagem) |
| Oceano | `1D6FB8` | −10° | azul → petróleo |
| Ameixa | `7A3E9D` | +15° | violeta → magenta profundo |
| Âmbar | `E08A1E` | −12° | âmbar → vermelho queimado |
| Rubi | `C6363C` | +12° | vermelho → vinho |
| Grafite | `4A5568` | −8° | azul-aço → azul-noite |
| Da sua cor | — | +12° | receita genérica (“propria”) |

### R2 — Estilo na forma (o coração, sem a dobra)

- **Entrega visível:** galeria “Estilos de Cor” na fita + seção “Estilo” no painel; aplicar,
  trocar família/intensidade/cor/ângulo, lustro, desligar; **vivo** funcionando (cor e tema).
- **Passos:**
  1. `abrir.ps1 feat/estilos-na-forma ...`.
  2. `schema.ts`: `EstiloForma`, `FamiliaEstilo`, `IntensidadeEstilo`, `BrilhoEstilo`, `Shape.estilo`.
  3. `powerpoint.ts`: `substituirSlide` chama `atualizarEstilos(...)` **antes** de
     `atualizarLigacoes` (guardado por `some`); `case "estilo-cor"` (aplicar/opções/desligar);
     o handler de preenchimento roteia para `estilo.base` quando a forma tem estilo.
  4. `ui/fita.ts`: grupo “Estilos de Cor” + popover (famílias com prévia real, intensidade,
     acabamento **sem** “Dobra” ainda — “Dobra” aparece na R3, ângulo, cor, desligar).
  5. `ui/painel.ts`: seção “Estilo” (mesmos controles + desligar + dica).
  6. Testes: galeria/painel existem (layout test), fluxo aplicar→re-derivar (pode ser por funções
     puras), desligar mantém o look como pintura, editor de paradas desliga o estilo.
  7. Docs: `docs/powerpoint.md` seção “Estilos de cor”; CHANGELOG; histórico por arquivo.
- **Aceite:** a caixa da imagem reproduzível em 2 cliques (Esmeralda ▸ Média ▸ Lustro); trocar a
  cor refaz a rampa; desligar devolve o controle ao painel; exporta e abre igual no PowerPoint
  (conferência visual do usuário).
- **Commit sugerido:** `feat(powerpoint): estilos de cor na forma (vivo, com lustro)`

### R3 — Dobra (brilho diagonal) + fidelidade no arquivo

- **Entrega visível:** acabamento **“Dobra”** (a forma-capa da imagem) + cópia/colar/duplicar
  corretos + caso de ouro de exportação.
- **Passos:**
  1. `abrir.ps1 feat/estilos-dobra ...`.
  2. `schema.ts`: `Shape.capa`; `operacoes.ts` `clonarFormas` remapeia `capa.de` (como `liga`);
     `estilos.ts`: `capaDaDobra` final (geometria/giro/alfa), recálculo e órfãos em
     `atualizarEstilos`; apagar a base leva a capa.
  3. UI: opção “Dobra” no acabamento (fita+painel) + a capa entra **agrupada** com a base
     (`grupo` compartilhado) para mover junto.
  4. Testes: capa criada/atualizada/removida; seguir a caixa ao mover/redimensionar; órfã;
     cópia remapeada; exporta como grupo.
  5. `scripts/testar-edicao-pptx.mjs` (ou caso novo no `test:pptx`): ouro — exportar o deck
     estilizado, reimportar e comparar fills/ln/sombra/texto.
- **Aceite:** no PowerPoint, a forma abre com o gradiente e a dobra (grupo de 2 formas, editável);
  a volta é idêntica (como pintura).
- **Commit sugerido:** `feat(powerpoint): brilho em dobra e fidelidade no pptx`

### R4 — Fundo da lâmina com estilo

- **Entrega visível:** “Fundo com estilo” no popover/ painel do fundo (famílias, intensidade,
  ângulo, cor, desligar). Brilho: **lustro/sem** (sem dobra, ver 3.5).
- **Passos:** `Slide.bgEstilo` no schema; `atualizarEstilos` deriva o `bg` da lâmina; UI no
  popover “Formatar fundo” e no painel do fundo; teste (deriva, troca de tema, desligar),
  histórico e doc.
- **Commit sugerido:** `feat(powerpoint): fundo da lamina com estilo`

### R5 — Modelos (Design) com estilo

- **Entrega visível:** cartões de modelo com prévia do estilo; `ModeloPPT.estilo`; aplicar um
  modelo re-deriva as formas de base vazia (junto com a troca de tema atual) e ajusta `bgEstilo`.
- **Passos:** `modelos.ts` (tipo + presets), `powerpoint.ts` (aplicação), `ui/fita.ts` (prévia no
  cartão), teste (base vazia acompanha o modelo; base fixa fica), histórico e doc.
- **Commit sugerido:** `feat(powerpoint): modelos com estilo de cor`

### R6 (opcional) — Polimento

Mais famílias, calibragem do lustro/dobra, “Estilos” nos cartões do Mermaid/Conectar (opcional),
guia rápido no doc. Pode virar pedido do usuário depois.

---

## 5. Testes e critérios de aceite gerais

- **`npm run test:estilos`** (novo, R1): motor puro — cor, rampa, contraste, esquema, recálculo,
  capa, órfãos, cópia.
- **`npm run test:layout`**: verificação de que o grupo/botão da galeria existe (padrão do projeto).
- **`npm run test:pptx-edicao` / `test:pptx`**: caso de ouro do estilo (R3).
- **`tsc` + build** em toda rodada (`node .\node_modules\typescript\bin\tsc --noEmit`,
  `node .\node_modules\vite\bin\vite.js build`).
- **Conferência visual do usuário**: exportar o `.pptx` e abrir no PowerPoint (aceite final de cada
  rodada visível).

## 6. Documentação obrigatória por rodada

- `CHANGELOG.md` — PowerPoint → **Não adicionado** → Frontend (promoção para **Adicionado** num
  fecho seguinte, como já é o padrão do projeto).
- `docs/historico-tecnico.md` — por arquivo: local, linha (`antes → depois`), porquê.
- `docs/powerpoint.md` — seção “Estilos de cor” (a partir da R2); `docs/estilos-de-cor-plano.md`
  (este documento, copiado na R1).

## 7. Fluxo de trabalho (obrigatório)

1. Abrir: `tools\worktrees\abrir.ps1 <branch> -Porque "..." -Proposito "..."` (na cópia principal).
2. Trabalhar só na worktree; validar; **fechar**:
   `tools\worktrees\fechar.ps1 -Mensagem "tipo(escopo): descrição"`.
   Conflito: resolver mantendo os dois lados → `git add -A` → rodar `fechar.ps1` de novo.
3. Push é automático no fecho.

## 8. Riscos e cuidados

- **Editor de paradas com estilo ligado:** a regra é desligar o estilo e avisar (3.3) — testar.
- **Ordem do recálculo (estilos → ligações):** trocar isso quebra a cor dos conectores.
- **Capa e z-order:** a capa deve entrar logo depois da base, senão cobre outras formas.
- **Fundo sem dobra:** decisão consciente (economia de formas por lâmina).
- **Tema com base automática:** formas com `base` vazia mudam junto com o Modelo — é o pedido;
  documentar no doc do módulo.
- **Nada de dependências novas** (o app não usa bibliotecas de cor; a matemática HSL é nossa).
