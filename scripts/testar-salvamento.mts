// Teste do salvamento automático: coalescência/single-flight da fila (com um "disco
// lento" simulado) e os contratos da camada de disco do navegador.
//
// Por que existe: em pasta de rede (UNC/SMB) cada gravação custa centenas de ms a
// segundos. O autosave antigo (a) rodava a gravação na thread principal — travando a
// janela — e (b) descartava o pedido que chegasse durante uma gravação, deixando a última
// parte do texto sem salvar. Este teste prende as duas correções.
//
// Até a W3 a segunda metade conferia o Rust (`#[tauri::command(async)]`, leitura única).
// Agora o contrato é da camada do navegador: o autosave usa o disco quando existe
// (`temDisco`, não "é o Tauri"), a gravação é feita num handle e o backup compara antes de
// duplicar. O comportamento de ponta a ponta é exercitado no navegador (`npm run app`).
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
const { criarAgendadorSalvamento } = await import("../src/app/autosaveTimer.ts");

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

// ---------------------------------------------------------------- o relógio do autosave

console.log("\nrelógio do autosave: grava mesmo digitando sem parar");

{
  // Relógio e timers falsos: o teste controla o tempo sem dormir.
  const criarRelogio = () => {
    let agora = 0;
    let proximoId = 1;
    const timers = new Map<number, { quando: number; fn: () => void }>();
    return {
      agora: () => agora,
      agendar: (fn: () => void, ms: number) => {
        const id = proximoId++;
        timers.set(id, { quando: agora + Math.max(0, ms), fn });
        return id;
      },
      cancelar: (id: number) => {
        timers.delete(id);
      },
      avancar: async (ms: number) => {
        const alvo = agora + ms;
        for (;;) {
          const proximo = [...timers.entries()]
            .filter(([, t]) => t.quando <= alvo)
            .sort((a, b) => a[1].quando - b[1].quando)[0];
          if (!proximo) break;
          timers.delete(proximo[0]);
          agora = proximo[1].quando;
          proximo[1].fn();
          await Promise.resolve(); // deixa o encadeamento de promises (gravação) terminar
        }
        agora = alvo;
      },
    };
  };

  // Digitação contínua (uma tecla a cada 300 ms por 12 s): as gravações não podem esperar
  // a pessoa parar. O teto de 5 s vale mesmo com o relógio sendo reiniciado a cada tecla.
  {
    const relogio = criarRelogio();
    const gravacoes: number[] = [];
    const ag = criarAgendadorSalvamento({
      salvar: () => {
        gravacoes.push(relogio.agora());
      },
      pausaMs: 900,
      maximoMs: 5000,
      agora: relogio.agora,
      agendarTimer: relogio.agendar,
      cancelarTimer: relogio.cancelar,
    });
    for (let t = 0; t < 12000; t += 300) {
      ag();
      await relogio.avancar(300);
    }
    const maiorIntervalo = gravacoes.slice(1).reduce((m, t, i) => Math.max(m, t - gravacoes[i]), 0);
    checa("digitando sem parar, grava mais de uma vez", gravacoes.length >= 2, `gravações: ${JSON.stringify(gravacoes)}`);
    checa("nenhuma gravação espera mais de 5 s", maiorIntervalo <= 5000, `maior intervalo: ${maiorIntervalo} ms`);
    checa(
      "a primeira gravação chega no teto (não só quando a pessoa para)",
      gravacoes[0] >= 4800 && gravacoes[0] <= 5000,
      `primeira: ${gravacoes[0]} ms`
    );

    // parou de digitar: a última alteração entra na pausa curta (900 ms)
    await relogio.avancar(900);
    checa(
      "ao parar, a última alteração é gravada",
      gravacoes[gravacoes.length - 1] > 12000,
      JSON.stringify(gravacoes)
    );
    checa("o agendador fica sem pendência depois de gravar", ag.pendente === false);
  }

  // Uma gravação lenta não pode ser atropelada por outra: a próxima só começa depois que a
  // atual termina — e o texto digitado nesse meio-tempo é gravado logo em seguida.
  {
    const relogio = criarRelogio();
    let terminou: (() => void) | null = null;
    let ativos = 0;
    let maxAtivos = 0;
    const gravacoes: number[] = [];
    const ag = criarAgendadorSalvamento({
      salvar: () => {
        ativos++;
        maxAtivos = Math.max(maxAtivos, ativos);
        gravacoes.push(relogio.agora());
        return new Promise<void>((ok) => {
          terminou = () => {
            ativos--;
            ok();
          };
        });
      },
      pausaMs: 900,
      maximoMs: 5000,
      agora: relogio.agora,
      agendarTimer: relogio.agendar,
      cancelarTimer: relogio.cancelar,
    });
    ag();
    await relogio.avancar(900); // começa a gravação lenta
    ag();
    await relogio.avancar(5000); // digita durante a gravação: nada em paralelo
    checa("uma gravação por vez (a fila continua valendo)", maxAtivos === 1 && gravacoes.length === 1, `ativas: ${maxAtivos}, gravações: ${gravacoes.length}`);
    terminou!();
    await Promise.resolve();
    await Promise.resolve();
    await relogio.avancar(900); // a alteração pendente ganha a vez
    checa("a alteração feita durante a gravação entra na próxima", gravacoes.length === 2, `gravações: ${JSON.stringify(gravacoes)}`);
  }

  // Rajada curta: um pedido só, no fim da pausa.
  {
    const relogio = criarRelogio();
    let gravacoes = 0;
    const ag = criarAgendadorSalvamento({
      salvar: () => {
        gravacoes++;
      },
      pausaMs: 900,
      maximoMs: 5000,
      agora: relogio.agora,
      agendarTimer: relogio.agendar,
      cancelarTimer: relogio.cancelar,
    });
    ag();
    await relogio.avancar(300);
    ag();
    await relogio.avancar(300);
    ag();
    await relogio.avancar(300);
    checa("as teclas seguidas continuam virando uma gravação só", gravacoes === 0, `gravações: ${gravacoes}`);
    await relogio.avancar(900);
    checa("a gravação sai depois da pausa", gravacoes === 1, `gravações: ${gravacoes}`);
  }
}

// ---------------------------------------------------------------- a camada de disco do navegador

console.log("\ndisco do navegador: o autosave grava de verdade");

const arquivo = ler("src/disco/arquivo.ts");
const documents = ler("src/app/documents.ts");
const backupDisco = ler("src/disco/backup.ts");
const ponte = ler("src/ponte/index.ts");
const appFonte = ler("src/app/app.ts");
const previewFonte = ler("src/md/preview.ts");
const mediaFonte = ler("src/app/media.ts");
const layoutFonte = ler("src/app/layout.ts");

checa(
  "o autosave pergunta 'tem disco?' (e não 'é o Tauri?')",
  documents.includes("files.temDisco()") && !documents.includes("files.emTauri()"),
  "o ramo do navegador voltou a mandar o texto só para o localStorage"
);
checa(
  "a gravação passa pelo handle (createWritable)",
  arquivo.includes("createWritable") && arquivo.includes("gravarNoHandle"),
  "a gravação do arquivo sumiu"
);
checa(
  "o backup compara antes de duplicar",
  backupDisco.includes("mesmosBytes"),
  "a comparação com a última cópia sumiu"
);
checa(
  "a proteção do estado anterior continua existindo",
  backupDisco.includes(".orig"),
  "a proteção por conteúdo sumiu"
);
checa(
  "o rascunho de documento novo existe (draft_path -> rascunhos)",
  ponte.includes('case "draft_path"') && ler("src/disco/rascunhos.ts").includes("export async function criar"),
  "o documento novo não tem onde ser guardado"
);
for (const cmd of ["save_text", "save_binary", "read_file_data_url", "load_text"]) {
  checa(`ponte atende ${cmd}`, ponte.includes(`case "${cmd}"`), "comando sem tradução");
}

// O autosave contínuo e a imagem recém-colada: o que o teste puro acima garante precisa
// estar ligado no app de verdade (não adianta o relógio existir e ninguém usá-lo).
checa(
  "o app usa o relógio com teto (não o debounce de 2 s)",
  appFonte.includes("criarAgendadorSalvamento") &&
    /maximoMs:\s*5000/.test(appFonte) &&
    !/debounce\(\(\) => void this\.autosave\(\), 2000\)/.test(appFonte),
  "o autosave voltou a esperar a pessoa parar"
);
checa(
  "o autosave grava ao esconder a janela/trocar de app",
  /visibilitychange/.test(appFonte) && /visibilityState !== "hidden"/.test(appFonte),
  "sair do app deixou de gravar na hora"
);
checa(
  "o rascunho criado depois de uma falha limpa o selo",
  /tab\.saveFailed = false;\s*\r?\n\s*tab\.dirty = this\.tab === tab/.test(documents),
  "o selo continuaria dizendo 'Não foi possível salvar' com o arquivo gravado"
);
checa(
  "o selo com falha tenta salvar de novo",
  documents.includes("async retrySave(") && /acionavel\(\s*true/.test(layoutFonte) && appFonte.includes("#save-state"),
  "o aviso vermelho do rodapé voltou a ser só texto"
);
checa(
  "o preview aceita a imagem recém-gravada (seedAsset)",
  previewFonte.includes("seedAsset(rel: string, dataUrl: string)") &&
    /setDocPath[\s\S]{0,2500}img\.img-missing/.test(previewFonte),
  "a imagem colada voltou a depender da leitura de volta do disco"
);
checa(
  "colar e arrastar entregam os bytes ao preview",
  /insertImageMd\(rel, "imagem", `data:/.test(mediaFonte) &&
    /insertImageMd\(rel, stripExt\(img\.nome\), `data:/.test(mediaFonte),
  "a imagem colada/arrastada não é semeada no preview"
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
  "rascunho parado diz 'Rascunho' (não 'Salvo': ainda não é o arquivo da pessoa)",
  selo({ kind: "doc", rascunho: true, sujo: false }) === "rascunho"
);
checa("documento novo (sem caminho) parado também diz 'Rascunho'", selo({ kind: "doc", temPath: false, sujo: false }) === "rascunho");
checa("documento novo com alterações continua 'Salvando…'", selo({ kind: "doc", temPath: false }) === "salvando");
checa("arquivo de verdade sem pendência diz 'Salvo'", selo({ kind: "doc", sujo: false }) === "salvo");
checa("gravação que falhou diz 'Não salvo' (nunca 'Salvo')", selo({ kind: "doc", sujo: false, erro: true }) === "erro");
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
