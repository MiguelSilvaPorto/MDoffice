// Service worker do mdOffice (PWA).
//
// O app é local: o servidor é o seu próprio computador. O service worker existe para ele
// continuar abrindo quando o servidor não estiver no ar (ou sem rede) e para a janela
// instalada não depender de baixar tudo de novo a cada abertura.
//
// Regras de propósito:
// - só o que é do PRÓPRIO app entra no cache (nada de HuggingFace, MyMemory ou fontes de fora);
// - a navegação é rede-primeiro (uma versão nova do app aparece na primeira recarga);
// - os arquivos com hash do build são cache-primeiro (nunca mudam);
// - nunca guarda POST (o app grava direto no disco) nem as rotas de desenvolvimento.
//
// Ao mudar o app de forma incompatível, troque a VERSAO: os caches antigos são apagados na
// ativação seguinte.
const VERSAO = "mdoffice-1";
const CACHE = `${VERSAO}-app`;
const CASCA = ["/", "/index.html", "/manifest.webmanifest", "/icones/pwa-192.png", "/icones/pwa-512.png"];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CASCA))
      .catch(() => {}) // sem rede na primeira instalação: o app ainda abre quando houver
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => !k.startsWith(VERSAO)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Deixa no cache uma cópia da resposta (se ela for mesmo do app e tiver dado certo). */
function guardar(req, res) {
  if (!res || !res.ok || res.status !== 200) return res;
  const copia = res.clone();
  void caches.open(CACHE).then((cache) => cache.put(req, copia)).catch(() => {});
  return res;
}

self.addEventListener("fetch", (evento) => {
  const req = evento.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // só o próprio app: o modelo da tradução, o tradutor online e fontes externas passam direto
  if (url.origin !== self.location.origin) return;
  // rotas que só existem no servidor de desenvolvimento
  if (url.pathname.startsWith("/__")) return;
  // downloads por partes (o modelo offline) não podem ser cacheados
  if (req.headers.has("range")) return;

  // Abrir o app: rede primeiro (para pegar a versão nova) e o cache só se o servidor sumir.
  // Um 5xx também conta como "servidor fora": um servidor local que caiu (ou um proxy no
  // caminho) responde erro, não falha de rede — e a janela instalada precisa abrir mesmo assim.
  if (req.mode === "navigate") {
    evento.respondWith(
      fetch(req)
        .then((res) => {
          if (res.status >= 500) throw new Error("servidor fora do ar");
          return guardar(req, res);
        })
        .catch(async () => (await caches.match(req)) || (await caches.match("/index.html")) || (await caches.match("/")) || Response.error())
    );
    return;
  }

  // Estáticos do build (JS, CSS, wasm, ícones, fontes): o cache responde na hora.
  evento.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => guardar(req, res));
    })
  );
});
