// Testa a imagem RECÉM-COLADA no preview.
//
// O problema que este teste prende: colar uma imagem grava o arquivo em `assets/` e o
// preview pedia o arquivo de VOLTA ao disco para exibir. Se essa leitura falhasse (permissão
// pendente, registro sem o arquivo, documento ainda sem pasta), a imagem já gravada não
// aparecia. Agora o app entrega ao preview os mesmos bytes que gravou (`seedAsset`), então a
// imagem aparece na hora — e continua aparecendo mesmo que o arquivo seja removido do disco
// logo depois (prova de que veio do seed, não de uma leitura de volta).
//
// Precisa do app rodando (npm run dev) — o roteiro usa o Chrome headless pelo DevTools.
// Uso: node scripts/testar-imagem-preview.mjs   (MDOFICE_URL aponta para outro lugar se preciso)
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const raiz = process.cwd();
const temp = join(raiz, "temp");
mkdirSync(temp, { recursive: true });

const URL_APP = process.env.MDOFICE_URL || "http://localhost:1432/";
const PORTA = Number(process.env.MDOFFICE_PORTA_CHROME || 9336);
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  if (!cond) falhas++;
  console.log(`${cond ? "OK   " : "FALHA"} ${nome}${detalhe ? "  " + detalhe : ""}`);
};

async function main() {
  const proc = spawn(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      // perfil limpo: a sessão do app não muda de uma rodada para outra
      `--user-data-dir=${join(temp, "chrome-imagem-preview")}`,
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
    // apaga o registro de handles, a sessão e os arquivos do OPFS
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
  const recomecar = async () => {
    await limpar();
    await call("Page.reload");
    await espera(1500);
    await esperarApp();
    await espera(1000);
    // a sessão limpa abre o convite de backup: ele é um modal do app e cobre a tela
    await avaliar("document.querySelector('.modal [data-nao]')?.click()");
    await espera(400);
  };
  const concederPasta = async () => {
    // o OPFS é um disco de verdade no navegador e serve de "pasta concedida"
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
  const novoDocumento = async () => {
    await avaliar("document.querySelector('button[title^=\"Novo documento\"]')?.click()");
    await espera(500);
    // digita de verdade para o autosave criar o rascunho (o documento precisa de arquivo
    // para a imagem ir para uma `assets/` de verdade)
    await avaliar("document.querySelector('.cm-content')?.focus()");
    await espera(200);
    await call("Input.insertText", { text: "# Imagem colada\n\n" });
    // espera o rascunho ganhar caminho (pausa de 900 ms do autosave + gravação)
    for (let i = 0; i < 30; i++) {
      await espera(200);
      if (await avaliar("!!window.__mdoffice?.app?.tab?.path")) break;
    }
  };

  // a aba pode ter aberto em about:blank antes do app: navega e espera a página
  await call("Page.navigate", { url: URL_APP });
  await espera(1500);
  await esperarApp();

  await recomecar();
  await concederPasta();
  await novoDocumento();

  const antes = await avaliar(`(() => ({
    path: window.__mdoffice?.app?.tab?.path || null,
    texto: document.querySelector('.cm-content')?.innerText || ''
  }))()`);
  ok("o documento novo ganhou um rascunho (tem onde gravar a imagem)", !!antes.path, JSON.stringify(antes.path));

  // cola um PNG grande de verdade (canvas → File → ClipboardEvent), como o Ctrl+V faz
  const colado = await avaliar(`
    (async () => {
      const app = window.__mdoffice.app;
      const c = document.createElement('canvas');
      c.width = 900; c.height = 600;
      const g = c.getContext('2d');
      g.fillStyle = '#2b5fa8'; g.fillRect(0, 0, c.width, c.height);
      g.fillStyle = '#fff'; g.font = '56px sans-serif'; g.fillText('imagem colada', 80, 120);
      const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'clipboard.png', { type: 'image/png' }));
      app.editor.view.contentDOM.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
      );
      await new Promise((r) => setTimeout(r, 600));
      const md = app.editor.getText();
      const rel = /!\\[[^\\]]*\\]\\((assets\\/[^)]+)\\)/.exec(md)?.[1] || null;
      const img = document.querySelector('#preview img');
      const src = img ? img.getAttribute('src') || '' : '';
      return {
        md,
        rel,
        img: img ? {
          srcInicio: src.slice(0, 30),
          data: src.startsWith('data:image/'),
          raw: img.dataset.rawSrc || null,
          classe: img.className,
          natural: img.naturalWidth,
        } : null,
      };
    })()
  `);
  ok("a imagem colada entrou no Markdown", /!\[imagem\]\(assets\/imagem-[^)]+\.png\)/.test(colado.md), JSON.stringify(colado.md));
  ok("a referência da imagem é o arquivo gravado em assets/", !!colado.rel && colado.rel.startsWith("assets/imagem-"), String(colado.rel));
  ok("a imagem aparece no preview", !!colado.img, colado.img ? "sim" : "não");
  ok("o preview usa os bytes recém-gravados (data URL)", !!colado.img?.data, colado.img?.data ? "data:" : String(colado.img?.srcInicio));
  ok("a imagem não fica marcada como ausente", !!colado.img && !/img-missing/.test(colado.img.classe), String(colado.img?.classe));
  ok("a imagem tem tamanho de verdade (não é um retângulo vazio)", (colado.img?.natural || 0) > 0, String(colado.img?.natural));

  // Remove o arquivo do disco e força um render: se a imagem continuar, veio do seed (e não
  // de uma leitura de volta do disco). O documento continua no editor, com o cache do preview.
  const depois = await avaliar(`
    (async () => {
      const app = window.__mdoffice.app;
      const rel = ${JSON.stringify(colado.rel)};
      const partes = rel.split('/');
      const root = await navigator.storage.getDirectory();
      const partesPasta = (app.tab.path || '').split('/').slice(0, -1);
      let pasta = root;
      for (const parte of partesPasta) pasta = await pasta.getDirectoryHandle(parte);
      for (const parte of partes.slice(0, -1)) pasta = await pasta.getDirectoryHandle(parte);
      await pasta.removeEntry(partes[partes.length - 1]);
      await app.preview.render(app.editor.getText());
      await new Promise((r) => setTimeout(r, 700));
      const img = document.querySelector('#preview img');
      const src = img ? img.getAttribute('src') || '' : '';
      return {
        img: img ? {
          srcInicio: src.slice(0, 30),
          data: src.startsWith('data:image/'),
          classe: img.className,
          natural: img.naturalWidth,
        } : null,
      };
    })()
  `);
  ok(
    "sem o arquivo no disco, a imagem recém-colada continua visível (veio do seed)",
    !!depois.img?.data && !/img-missing/.test(depois.img?.classe || ""),
    depois.img ? `data=${depois.img.data} · classe=${depois.img.classe || "(vazia)"}` : "sem img"
  );

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
