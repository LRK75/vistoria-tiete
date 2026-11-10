/* Service worker: guarda o aplicativo no tablet para funcionar sem internet.
 * Ao publicar uma nova versão, altere VERSAO para que os tablets atualizem. */
const VERSAO = "vistoria-campo-v3";
const ARQUIVOS = [
  "./", "index.html", "estilo.css", "app.js", "catalogo.js", "glifos.js", "manifest.webmanifest",
  "icones/icone-192.png", "icones/icone-512.png", "icones/icone-180.png",
];
// Bibliotecas e fontes externas: guardadas na primeira vez que são usadas
const EXTERNOS = ["fonts.googleapis.com", "fonts.gstatic.com", "unpkg.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO && k !== "externos").map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Páginas: sempre a cópia local do app (funciona sem rede); atualiza em segundo plano
  if (req.mode === "navigate") {
    e.respondWith(
      caches.match("index.html").then((cache) => {
        const rede = fetch(req).then((r) => {
          if (r.ok) caches.open(VERSAO).then((c) => c.put("index.html", r.clone()));
          return r;
        }).catch(() => cache);
        return cache || rede;
      }),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((cache) => {
        const rede = fetch(req).then((r) => {
          if (r.ok) caches.open(VERSAO).then((c) => c.put(req, r.clone()));
          return r;
        }).catch(() => cache);
        return cache || rede;
      }),
    );
    return;
  }

  if (EXTERNOS.includes(url.hostname)) {
    e.respondWith(
      caches.open("externos").then((c) => c.match(req).then((cache) =>
        cache || fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }))),
    );
  }
  // Demais endereços (mapa do OpenStreetMap): direto da rede
});
