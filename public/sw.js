// Service worker do PWA. Só guarda arquivos estáticos (JS/CSS do build,
// fontes e imagens). Páginas e dados NUNCA vão para o cache: são números
// financeiros por usuário e ficariam no aparelho mesmo depois de sair da conta.
const CACHE = 'smashkings-v2';

const estatico = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith('/_next/static/') || /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname));

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  // apaga o cache da versão anterior, que guardava páginas com dados
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || !estatico(new URL(e.request.url))) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
