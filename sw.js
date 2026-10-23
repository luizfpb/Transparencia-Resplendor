// Modo offline: arquivos do app em cache; dados sempre buscados na rede primeiro.
const VERSAO = 'v2-2026-10';
const APP = [
  './', 'index.html', 'css/style.css', 'manifest.webmanifest', 'assets/icon.svg',
  'js/main.js', 'js/util.js', 'js/model.js', 'js/charts.js', 'js/sankey.js', 'js/ui.js', 'js/glossario.js',
  'js/views/visao.js', 'js/views/fluxo.js', 'js/views/receitas.js', 'js/views/despesas.js', 'js/views/gastos.js',
  'js/views/calculadora.js', 'js/views/lrf.js', 'js/views/historico.js', 'js/views/vizinhos.js', 'js/views/metodologia.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const ehDado = url.pathname.endsWith('.json');

  if (ehDado) {
    // Rede primeiro, para nunca exibir números desatualizados quando há conexão.
    e.respondWith(
      fetch(request).then((resp) => {
        const copia = resp.clone();
        caches.open(VERSAO).then((c) => c.put(request, copia));
        return resp;
      }).catch(() => caches.match(request)),
    );
    return;
  }
  e.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).then((resp) => {
      if (resp.ok && (url.origin === location.origin || url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com'))) {
        const copia = resp.clone();
        caches.open(VERSAO).then((c) => c.put(request, copia));
      }
      return resp;
    })),
  );
});
