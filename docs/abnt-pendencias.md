# ABNT — pendências conhecidas (para arrumar depois)

Registrado na conferência de entrega do motor ABNT (2026-10-14). A entrega está inteira e
verificada (ver [abnt-entrega-por-grupo.md](abnt-entrega-por-grupo.md)); o que está aqui é
**trabalho futuro**, não falha silenciosa. Cada item diz o que é, onde dói e o caminho.

## 1. Imagem sem alt: o aviso de T02 some

- **O quê:** o verificador de figura produz o aviso, mas o `checkStyle` descarta todo aviso
  cujo trecho esteja dentro da máscara — e uma imagem sem texto alternativo tem a linha
  inteira mascarada (`![](url)`).
- **Onde:** `src/broker/mask.ts` (máscara) × `src/broker/abnt/verificadores/tabelas.ts`
  (T02).
- **Caminho:** ancorar o aviso na **linha** da imagem (fora da URL), ou reconhecer a imagem
  sem alt como caso próprio com âncora na linha; o filtro da máscara existe para não avisar
  em URL/código e não deve ser afrouxado.

## 2. Modo ABNT no export `.docx` (fase F3)

- **O quê:** as regras E04–E08 e E12 **acusam os exportadores atuais** (o fluxo Markdown
  sai com margens 2 cm, Calibri 11, entrelinha 1,25 e sem paginação; a sessão Word sai
  2,5/3 cm e 1,15). O validador existe; falta o **perfil de exportação ABNT** (A4, 3-2-3-2,
  Arial/Times 12, 1,5, citação longa com recuo, paginação a partir da introdução, quebra por
  seção primária).
- **Onde:** `src/md/docx.ts` e `src/word/docxExport.ts` (modo padrão intocado) e
  `src/md/docxcheck.ts` como prova de ida e volta.
- **Prova esperada:** o teste `testar-abnt-docx.mts` já valida o exportador configurado em
  ABNT sem nenhum aviso — é o alvo.

## 3. Seletor de perfil institucional na tela

- **O quê:** o formato do perfil (herança, versões de norma, regra `off`/`soft`/`hard`) e o
  `perfilBase()` existem e são testados; **nenhuma tela** oferece escolher perfil nem versão
  de norma.
- **Onde:** `src/broker/abnt/index.ts` (`Perfil`, `aplicarPerfil`) × `src/settingsPage.ts`.
- **Caminho:** uma aba (Escrita ou novo "Norma") com o perfil ativo e as versões; a
  aplicação já está pronta (`aplicarPerfil`).

## 4. Relatório de conformidade por norma

- **O quê:** o objetivo 2 da pesquisa ("verificar ABNT com relatório") — ok / violada / **não
  verificável**, agrupado por norma. Os dados (id, norma, severidade, mensagem, trecho) já
  existem em cada aviso; falta a tela/exportação (painel de revisão na visão ABNT).
- **Onde:** `src/broker/review.ts` / `src/broker/deep/panel.ts`, `src/app/commands.ts`.
- **Ressalva que o relatório deve respeitar:** nunca mentir — versão de norma usada, o que é
  do papel não aparece no Markdown, e verificação não é aprovação
  (`docs/pesquisa-formalidade-abnt.md` §7.5).

## 5. Salvamento: outros comandos ainda síncronos

- **O quê:** o caminho do autosave ficou 100% fora da thread principal, mas `assets`,
  `lixeira` e `bundle` continuam com comando síncrono — podem travar em rede em outros
  gestos (inserir imagem, mover para lixeira, empacotar).
- **Onde:** `src-tauri/src/commands/` (os que ainda não têm `#[tauri::command(async)]`).
- **Caminho:** o mesmo tratamento dado a `files.rs`/`backup.rs` (26 comandos), um por vez.

## 6. Salvamento: a proteção antes de gravar lê o documento inteiro

- **O quê:** `protect_before_write` lê o arquivo completo a cada salvamento para gerar a
  cópia de segurança — é garantia de segurança, mantida de propósito. Em rede continua
  custando uma leitura por salvamento.
- **Caminho (se doer):** heurística de `mtime`/tamanho validada, **nunca** remover a
  proteção; medir com um share real antes de mexer.

## 7. Não medido: latência real de SMB

- **O quê:** não há share de rede no ambiente; a lentidão foi simulada (80–150 ms por
  gravação no teste do TS, 120 ms por leitura no teste do Rust). O "fora da thread
  principal" é garantido por contrato (atributo `async` + documentação do Tauri), não medido
  em runtime.
- **Caminho:** com um share de teste, repetir a medição e guardar o número.

## 8. Limitações finas das regras (revisitar quando houver corpus maior)

Falsos negativos/positivos conscientes, já registrados no código e no histórico. Os que
mais merecem revisão futura: **C01** (lista fechada de sobrenomes), **C03** (título entre
aspas acusa), **R11** (casamento folgado de autor+ano), **S01** (profundidade 3), **E01**
(capa/folha de rosto fora), **E11** (direção única) e **R02** (entradas sem chave confiável
ficam de fora). O caminho é sempre o mesmo: corpus rotulado maior, medir, e apertar com
evidência — não apertar por impressão.
