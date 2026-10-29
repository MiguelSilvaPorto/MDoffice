// Testa a correção de pontuação NO NAVEGADOR, com texto mal formado de verdade.
//
// O caso que motivou a tarefa: um texto com título/parágrafo em minúscula, sem a vírgula
// antes de "pois" e sem pontos finais. O teste confere as duas portas:
//   1. a correção automática depois da pausa (`runIdleFix`, o mesmo caminho do timer);
//   2. o comando "Formatar texto" (`formatarTexto`), que fecha também o último parágrafo.
// Depois roda o Ctrl+S simulado (`applySaveFixes`) num texto terminado em "app" — a palavra
// que antes perdia o ponto por ter outro aviso no mesmo trecho.
//
// Precisa do app rodando (npm run dev) — o roteiro usa o Chrome headless pelo DevTools.
// Uso: node scripts/testar-correcao-navegador.mjs   (MDOFICE_URL aponta para outro lugar)
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });

const URL_APP = process.env.MDOFICE_URL || "http://localhost:1433/";
const PORTA = Number(process.env.MDOFFICE_PORTA_CHROME || 9337);
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

const TEXTO = `# melhorias de interface
quero uma melhoria de funcionalidade que para salvar documentos conforme escrevo pois eu tava fazendo teste de escrita recentemente dentro do programa e ele tem dificuldades em salvar o documentos abertos

As imagens que eu colei dentro do próprio app ele tem dificuldades em renderizador no preview do app`;

const CURTO = `## objetivos do projeto
A reunião foi longa pois muita coisa estava pendente

O sistema abriu o app`;

async function main() {
  const proc = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${join(temp, "chrome-correcao")}`,
      `--remote-debugging-port=${PORTA}`,
      "--window-size=1500,900",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let alvo = null;
  for (let i = 0; i < 40 && !alvo; i++) {
    await espera(300);
    try {
      const r = await fetch(`http://127.0.0.1:${PORTA}/json/new?${encodeURIComponent(URL_APP)}`, { method: "PUT" });
      alvo = await r.json();
    } catch {
      /* o Chrome ainda está subindo */
    }
  }
  if (!alvo) throw new Error("Chrome não respondeu na porta de depuração.");

  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let seq = 0;
  const pendentes = new Map();
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pendentes.has(m.id)) {
      pendentes.get(m.id)(m.result);
      pendentes.delete(m.id);
    }
  });
  const call = (metodo, params = {}) =>
    new Promise((resolve) => {
      const id = ++seq;
      pendentes.set(id, resolve);
      ws.send(JSON.stringify({ id, method: metodo, params }));
    });

  await call("Page.enable");
  await call("Runtime.enable");

  const avaliar = async (expressao) => {
    const r = await call("Runtime.evaluate", { expression: expressao, returnByValue: true, awaitPromise: true });
    if (r?.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "erro no script");
    return r?.result?.value;
  };
  const esperarApp = async () => {
    for (let i = 0; i < 60; i++) {
      await espera(300);
      if (await avaliar("!!document.getElementById('busca-input') && getComputedStyle(document.getElementById('busca')).display === 'flex'")) return true;
    }
    return false;
  };
  const limpar = async () => {
    await avaliar(`
      (async () => {
        try { indexedDB.deleteDatabase('mdc-disco'); } catch (e) {}
        localStorage.clear();
        const root = await navigator.storage.getDirectory();
        for await (const [nome] of root.entries()) {
          try { await root.removeEntry(nome, { recursive: true }); } catch (e) {}
        }
        return true;
      })()
    `);
  };
  /** Fecha qualquer convite/modal que esteja na frente (o backup pode aparecer atrasado). */
  const fecharModais = async () => {
    for (let i = 0; i < 4; i++) {
      await avaliar("document.querySelectorAll('.modal [data-nao]').forEach((b) => b.click())");
      await espera(250);
      if (!(await avaliar("!!document.querySelector('.modal-backdrop')"))) return;
    }
  };
  const recomecar = async () => {
    await limpar();
    await call("Page.reload");
    await espera(1500);
    await esperarApp();
    await espera(1000);
    await fecharModais();
    await espera(400);
  };
  const concederPasta = async () => {
    await fecharModais();
    await avaliar(`
      (async () => {
        const root = await navigator.storage.getDirectory();
        window.showDirectoryPicker = async () => root;
        document.getElementById('proj-add')?.click();
        await new Promise((r) => setTimeout(r, 800));
        return true;
      })()
    `);
  };
  const novoDocumento = async (texto) => {
    await fecharModais();
    await avaliar("document.querySelector('button[title^=\"Novo documento\"]')?.click()");
    // o convite de backup pode reaparecer: espera a aba existir e fecha o que estiver na frente
    for (let i = 0; i < 30; i++) {
      await espera(150);
      await fecharModais();
      if (await avaliar("(window.__mdoffice?.app?.tabs?.length ?? 0) > 0")) break;
    }
    await avaliar("document.querySelector('.cm-content')?.focus()");
    await espera(250);
    await call("Input.insertText", { text: texto });
    // confere que o texto entrou (o editor pode ainda estar terminando de montar)
    for (let i = 0; i < 20; i++) {
      const t = await textoAtual();
      if (t.trim()) break;
      if (i === 19) {
        const d = await avaliar(`(() => ({
          abas: window.__mdoffice?.app?.tabs?.length ?? -1,
          home: window.__mdoffice?.app?.showingHome ?? null,
          modal: document.querySelector('.modal h2')?.textContent || null,
          cm: !!document.querySelector('.cm-content'),
          foco: document.activeElement?.className || null
        }))()`);
        console.log("DEBUG novoDocumento sem texto:", JSON.stringify(d));
      }
      await espera(150);
      await avaliar("document.querySelector('.cm-content')?.focus()");
      await call("Input.insertText", { text: texto });
    }
  };
  const textoAtual = () => avaliar("window.__mdoffice?.app?.editor?.getText() || ''");
  const estado = () =>
    avaliar(`(() => ({
      texto: window.__mdoffice?.app?.editor?.getText() || '',
      toasts: Array.from(document.querySelectorAll('.toast')).map((e) => e.textContent)
    }))()`);

  // a aba pode ter aberto em about:blank antes do app: navega e espera a página
  await call("Page.navigate", { url: URL_APP });
  await espera(1500);
  await esperarApp();

  await recomecar();
  await concederPasta();

  // ------------------------------------------------------------------ 1
  // Correção automática depois da pausa (o timer real do app): título, primeiro
  // parágrafo, vírgula de "pois" e o ponto do parágrafo concluído.
  await novoDocumento(TEXTO);
  // 3,5 s é o ritmo inicial de pausa; 4,5 s dá folga para a gravação e o render.
  await espera(4500);
  const auto = await textoAtual();
  ok("auto: título com maiúscula", auto.includes("# Melhorias de interface"), auto.split("\n")[0]);
  ok("auto: primeiro parágrafo com maiúscula", auto.includes("Quero uma melhoria"), auto.split("\n")[1]?.slice(0, 40));
  ok("auto: vírgula antes de “pois”", auto.includes("conforme escrevo, pois"), auto.split("\n")[1]?.slice(0, 100));
  ok("auto: vírgula antes de “e ele” (outro sujeito)", auto.includes("dentro do programa, e ele tem"), auto.split("\n")[1]?.slice(-80));
  ok("auto: primeiro parágrafo fechado com ponto", auto.includes("salvar o documentos abertos."), auto.split("\n")[1]?.slice(-40));
  ok("auto: não inventou uma quebra no meio do “pois”", !auto.includes(", pois. Eu") && !auto.includes(", pois ."));
  ok("auto: não mexeu na contração “tava” (registro é escolha)", auto.includes("tava"));

  // ------------------------------------------------------------------ 2
  // "Formatar texto": a ação explícita fecha também o ÚLTIMO parágrafo (mesmo com o
  // cursor nele) e não duplica ponto nem vírgula.
  await avaliar("window.__mdoffice.app.formatarTexto()");
  await espera(800);
  const formato = await textoAtual();
  ok("Formatar: último parágrafo fechado com ponto", formato.trimEnd().endsWith("preview do app."), formato.trimEnd().slice(-40));
  ok("Formatar: sem ponto duplicado", !formato.includes(".."));
  ok("Formatar: sem espaço antes da vírgula", !/ ,/.test(formato));
  ok("Formatar: a vírgula de “pois” continua uma só", (formato.match(/, pois/g) ?? []).length === 1);

  // ------------------------------------------------------------------ 3
  // Texto curto: título de nível 2, parágrafo concluído, e o último parágrafo terminando
  // em "app" — a palavra que antes perdia o ponto por causa do aviso de internetês.
  await novoDocumento(CURTO);
  await avaliar("window.__mdoffice.app.runIdleFix()");
  await espera(500);
  const curtoAuto = await textoAtual();
  ok("curto: título com maiúscula", curtoAuto.includes("## Objetivos do projeto"), curtoAuto.split("\n")[0]);
  ok("curto: vírgula antes de “pois”", curtoAuto.includes("longa, pois"), curtoAuto.split("\n")[1]);
  ok("curto: o parágrafo concluído ganhou ponto", curtoAuto.includes("pendente."), curtoAuto.split("\n")[1]?.slice(-30));

  // Ctrl+S simulado com o cursor no fim: fecha o último parágrafo e o aviso de internetês
  // na mesma palavra não pode engolir o ponto.
  await avaliar("window.__mdoffice.app.applySaveFixes()");
  await espera(500);
  const curtoSalvo = await textoAtual();
  ok("Ctrl+S: último parágrafo terminado em “app” ganha ponto", curtoSalvo.trimEnd().endsWith("app."), curtoSalvo.trimEnd().slice(-30));
  ok("Ctrl+S: o ponto não foi duplicado", !curtoSalvo.includes("app.."));

  // ------------------------------------------------------------------ 4
  // Texto que já está certo não é tocado (sem vírgula duplicada, sem ponto duplicado).
  await novoDocumento("A reunião foi longa, pois muita coisa estava pendente.\n\nO sistema abriu o app.");
  await avaliar("window.__mdoffice.app.runIdleFix()");
  await espera(400);
  const jaCerto = await textoAtual();
  ok("já certo: a vírgula existente não é duplicada", (jaCerto.match(/, pois/g) ?? []).length === 1, JSON.stringify(jaCerto));
  ok("já certo: o ponto existente não é duplicado", !jaCerto.includes(".."), JSON.stringify(jaCerto));

  const e = await estado();
  ok("nenhum toast de erro", !e.toasts.some((t) => /erro|não foi possível/i.test(t)), JSON.stringify(e.toasts.slice(-3)));

  console.log("");
  console.log(falhas ? `${falhas} FALHA(S)` : "Tudo certo.");
  try {
    ws.close();
  } catch {}
  proc.kill();
  process.exit(falhas ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
