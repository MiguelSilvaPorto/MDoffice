// Teste do salvamento automático: coalescência/single-flight da fila (com um "disco
// lento" simulado) e os contratos do Rust que tiram o I/O da interface.
//
// Por que existe: em pasta de rede (UNC/SMB) cada gravação custa centenas de ms a
// segundos. O autosave antigo (a) rodava o comando síncrono do Rust na thread principal
// — travando a janela — e (b) descartava o pedido que chegasse durante uma gravação,
// deixando a última parte do texto sem salvar. Este teste prende as duas correções.
//
// O que NÃO dá para provar aqui: a latência real de um share SMB (não há servidor de
// rede no ambiente). A fila é testada com um disco artificialmente lento e o Rust é
// conferido por contrato (atributo `#[tauri::command(async)]` + leitura única).
//
// Roda com: npm run test:salvamento
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
let falhas = 0;
const checa = (nome: string, ok: boolean, falta = "") => {
  console.log(`  ${ok ? "ok  " : "FALHA"} ${nome}${!ok && falta ? ` — ${falta}` : ""}`);
  if (!ok) falhas++;
};
const ler = (rel: string) => readFileSync(join(raiz, rel), "utf8");
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const { criarFilaSalvamento } = await import("../src/app/saveQueue.ts");

// ---------------------------------------------------------------- a fila

console.log("fila do salvamento: single-flight e coalescência");

// "Disco lento": cada gravação leva 80 ms. O valor é lido no INÍCIO da gravação,
// como o app faz (`this.editor.getText()` antes do `await files.saveDoc`).
{
  let valor = "v0";
  const gravados: string[] = [];
  const estados: boolean[] = [];
  const fila = criarFilaSalvamento({
    gravar: async () => {
      const agora = valor;
      await sleep(80);
      gravados.push(agora);
    },
    aoMudarEstado: (s) => estados.push(s),
  });

  const t0 = performance.now();
  const p1 = fila.pedir();
  const travou = performance.now() - t0;
  checa("pedir() não bloqueia (a interface não espera o disco)", travou < 20, `levou ${travou.toFixed(1)} ms`);

  // digitação durante a gravação: vários pedidos, nenhuma gravação obsoleta na fila
  await sleep(10);
  valor = "v1";
  const p2 = fila.pedir();
  valor = "v2";
  const p3 = fila.pedir();
  valor = "v3";
  const p4 = fila.pedir();

  await Promise.all([p1, p2, p3, p4]);
  await sleep(20); // deixa qualquer gravação extra aparecer

  checa("uma gravação por vez (nunca em paralelo)", fila.salvando === false);
  checa(
    "rajada de pedidos vira 1 gravação + 1 (coalescida), não uma fila",
    gravados.length === 2 && gravados[0] === "v0" && gravados[1] === "v3",
    `gravou ${JSON.stringify(gravados)}`
  );
  checa("o pedido durante a gravação não é descartado", gravados.includes("v3"), "a última versão não foi gravada");
  checa("a segunda gravação usa o estado mais recente", gravados[gravados.length - 1] === valor);
  checa("o indicador começa ligado", estados[0] === true);
  checa("o indicador termina desligado", estados[estados.length - 1] === false);
  checa("esperar() resolve só depois de tudo", fila.salvando === false && gravados.length === 2);
}

// Rajada longa (simula digitar sem parar por 1 s com gravação de 120 ms): nenhuma
// gravação em paralelo e menos gravações que pedidos — os pedidos coalescem no estado
// mais recente em vez de virar uma fila de trabalho já vencido.
{
  const gravados: number[] = [];
  let texto = 0;
  let pedidos = 0;
  let ativos = 0;
  let maxAtivos = 0;
  const fila = criarFilaSalvamento({
    gravar: async () => {
      ativos++;
      maxAtivos = Math.max(maxAtivos, ativos);
      const agora = texto;
      await sleep(120);
      gravados.push(agora);
      ativos--;
    },
  });
  const inicio = performance.now();
  while (performance.now() - inicio < 1000) {
    texto++;
    pedidos++;
    fila.pedir();
    await sleep(20);
  }
  const ultimo = texto;
  await sleep(300);
  checa("nunca há duas gravações em paralelo", maxAtivos === 1, `máximo simultâneo: ${maxAtivos}`);
  checa(
    "os pedidos coalescem (gravações << pedidos)",
    gravados.length < pedidos,
    `${pedidos} pedidos viraram ${gravados.length} gravações`
  );
  checa(
    "cada gravação usa o estado da hora (nunca um texto velho)",
    gravados.every((v, i) => i === 0 || v >= gravados[i - 1]),
    JSON.stringify(gravados)
  );
  checa("o último texto entra na última gravação", gravados[gravados.length - 1] === ultimo, `${gravados[gravados.length - 1]} != ${ultimo}`);
}

// Uma gravação que falha não derruba a fila: o erro é tratado em quem grava
// (o app mostra o aviso de "não salvou") e o próximo pedido continua funcionando.
{
  let tentativas = 0;
  const fila = criarFilaSalvamento({
    gravar: async () => {
      tentativas++;
      if (tentativas === 1) throw new Error("share fora do ar");
    },
  });
  await fila.pedir();
  await fila.pedir();
  checa("falha na gravação não trava a fila", tentativas === 2 && fila.salvando === false, `tentativas: ${tentativas}`);
}

// Caso clássico que ficava sem salvar: o usuário digita durante a gravação e para.
// O debounce dispara uma vez só (durante a gravação); sem fila o pedido era ignorado
// e o texto ficava pendente até o próximo autosave.
{
  let texto = "comeco";
  const gravados: string[] = [];
  const fila = criarFilaSalvamento({
    gravar: async () => {
      const agora = texto;
      await sleep(150);
      gravados.push(agora);
    },
  });
  fila.pedir();
  await sleep(20);
  texto = "texto digitado durante a gravacao que terminou aqui";
  await fila.pedir(); // o autosave dispara uma única vez e o usuário para de digitar
  checa("a última frase termina gravada", gravados[gravados.length - 1] === texto, JSON.stringify(gravados));
}

// ---------------------------------------------------------------- contratos do Rust

console.log("\nRust: I/O fora da thread principal (comandos `async`)");

const files = ler("src-tauri/src/commands/files.rs");
const backupRs = ler("src-tauri/src/commands/backup.rs");

for (const alvo of [
  ["load_text", files],
  ["save_text", files],
  ["save_binary", files],
  ["read_file_data_url", files],
  ["rename_file", files],
  ["create_folder", files],
  ["unique_md_path", files],
] as const) {
  const [cmd, fonte] = alvo;
  checa(
    `files::${cmd} fora da main thread`,
    new RegExp(`#\\[tauri::command\\(async\\)\\]\\r?\\npub fn ${cmd}\\(`).test(fonte),
    "sem #[tauri::command(async)]: o Tauri roda este comando na thread principal"
  );
}
checa(
  "todos os comandos de files.rs são async",
  (files.match(/#\[tauri::command\(async\)\]\r?\npub fn /g) ?? []).length === 7,
  `encontrados: ${(files.match(/#\[tauri::command\(async\)\]\r?\npub fn /g) ?? []).length}`
);

const deBackup = (backupRs.match(/#\[tauri::command\(async\)\]\r?\npub fn backup_/g) ?? []).length;
checa("os comandos de backup também saíram da main thread", deBackup >= 17, `encontrados: ${deBackup}`);
for (const cmd of ["backup_write", "backup_list", "backup_missing", "backup_restore"]) {
  checa(
    `backup::${cmd} fora da main thread`,
    new RegExp(`#\\[tauri::command\\(async\\)\\]\\r?\\npub fn ${cmd}\\(`).test(backupRs)
  );
}

// ---------------------------------------------------------------- segurança preservada

console.log("\nsegurança: proteção, pasta e leitura única");

checa(
  "save_text protege antes de gravar",
  /protect_before_write\(&app, &path, content\.as_bytes\(\)\)[\s\S]{0,120}gravar_bytes\(/.test(files),
  "a proteção antes de sobrescrever sumiu do caminho do salvamento"
);
checa(
  "save_binary protege antes de gravar",
  /protect_before_write\(&app, &path, &bytes\)[\s\S]{0,120}gravar_bytes\(/.test(files),
  "a proteção antes de sobrescrever sumiu do caminho do salvamento binário"
);
checa(
  "a gravação não faz exists() antes de salvar (uma ida a menos por salvamento)",
  /pub\(crate\) fn gravar_bytes/.test(files) && !/!dir\.exists\(\)/.test(files),
  "o exists() por salvamento voltou"
);
checa(
  "a pasta é criada quando falta (NotFound) e a gravação tenta de novo",
  /ErrorKind::NotFound[\s\S]{0,400}create_dir_all\(dir\)[\s\S]{0,400}fs::write\(p, bytes\)/.test(files),
  "sem recuperação de pasta inexistente"
);
checa(
  "a proteção ANTES de sobrescrever continua existindo no backup.rs",
  /write_backup_of_bytes/.test(backupRs) && /decidir_protecao/.test(backupRs),
  "a proteção por conteúdo mudou de lugar ou sumiu"
);
{
  const trecho = backupRs.slice(backupRs.indexOf("fn gravar_copia_com"), backupRs.indexOf("fn write_copy_atomic"));
  checa(
    "a cópia de backup lê o documento uma única vez",
    /let bytes = match ler_original\(&src\)/.test(trecho),
    "a cópia voltou a ler o original por raiz"
  );
  checa(
    "a cópia não usa mais fs::copy do original (leitura duplicada em rede)",
    trecho.length > 0 && !trecho.includes("fs::copy"),
    "fs::copy do original ainda está no miolo da cópia"
  );
}
checa(
  "o backup continua pulando quando o conteúdo não mudou",
  /same_bytes_with\(&bytes,/.test(backupRs),
  "a comparação com a última cópia sumiu"
);

// ---------------------------------------------------------------- arquivo do Office do usuário

console.log("\nselo do salvamento: arquivo SEU do Office não é regravado sozinho");

const { modoDoSelo, ehArquivoOfficeDoUsuario, criarAvisosOffice } = await import("../src/app/seloAutosave.ts");

const selo = (opts: Partial<Parameters<typeof modoDoSelo>[0]>) =>
  modoDoSelo({ ligado: true, kind: "ppt", temPath: true, rascunho: false, sujo: true, salvando: false, ...opts });

checa("arquivo do Office do usuário com alterações diz 'Não salvo' (e não 'Salvando…')", selo({}) === "nao-salvo");
checa("sem alterações pendentes volta a 'Salvo'", selo({ sujo: false }) === "salvo");
checa("rascunho do app continua no caminho da fila ('Salvando…')", selo({ rascunho: true }) === "salvando");
checa("documento MD continua 'Salvando…' (a fila grava)", selo({ kind: "doc" }) === "salvando");
checa("com o salvamento automático desligado o selo é 'Desativado'", selo({ ligado: false }) === "desligado");
checa(
  "word e xlsx seguem a mesma regra do pptx",
  selo({ kind: "word" }) === "nao-salvo" && selo({ kind: "xlsx" }) === "nao-salvo"
);
checa(
  "arquivo do Office sem caminho (ou rascunho) não é 'do usuário'",
  !ehArquivoOfficeDoUsuario("ppt", false, false) && !ehArquivoOfficeDoUsuario("ppt", true, true)
);

{
  const avisos = criarAvisosOffice();
  checa("o aviso sai uma vez por arquivo", avisos.primeiraVez("X:\\Pasta\\deck.pptx") === true);
  checa("a segunda vez (mesmo arquivo) não repete o aviso", avisos.primeiraVez("X:\\Pasta\\deck.pptx") === false);
  checa("o caminho não diferencia maiúsculas (Windows)", avisos.primeiraVez("x:\\pasta\\DECK.PPTX") === false);
  checa("outro arquivo tem o próprio aviso", avisos.primeiraVez("X:\\Pasta\\outro.pptx") === true);
}

// Os três motores usam a regra no ramo de arquivo do usuário: guardam versão e avisam — sem gravar por cima.
const wordDocs = ler("src/app/wordDocs.ts");
const pptDocs = ler("src/app/powerpointDocs.ts");
const xlsDocs = ler("src/app/excelDocs.ts");
for (const [nome, fonte, kind] of [
  ["Word", wordDocs, "word"],
  ["PowerPoint", pptDocs, "ppt"],
  ["Excel", xlsDocs, "xlsx"],
] as const) {
  checa(
    `${nome}: arquivo do usuário guarda versão + aviso, sem gravar por cima`,
    new RegExp(
      `recordVersion\\(tab\\.path, this\\.\\w+\\.serialized\\(\\)\\);\\r?\\n\\s+if \\(this\\.avisosOffice\\.primeiraVez\\(tab\\.path\\)\\) toast\\(avisoOfficeSemAutosave\\("${kind}"\\)`
    ).test(fonte),
    "o ramo do arquivo do usuário mudou"
  );
}
const layoutSrc = ler("src/app/layout.ts");
checa("o selo usa a decisão pura ('modoDoSelo') e tem o estado pendente", /modoDoSelo\(\{/.test(layoutSrc) && /is-pendente/.test(layoutSrc));
checa("o caminho fica à vista quando o arquivo do Office está pendente", /topBtn\.hidden = modo === "salvando"/.test(layoutSrc));
checa("o selo pendente tem cor própria (âmbar), sem a pulsação", /\.tb-autosave-badge\.is-pendente \{/.test(ler("src/styles/topbar.css")));

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTudo certo.");
process.exit(falhas ? 1 : 0);
