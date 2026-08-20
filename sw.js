/* Service worker da Ficha Meili Lane.
   Objetivo: depois da primeira abertura, a ficha funciona SEM internet.

   Estratégia em duas vias:
   · a PÁGINA (index.html) tenta a rede primeiro e cai no cache se não houver
     internet — assim uma correção publicada entra já na abertura seguinte,
     sem precisar abrir duas vezes;
   · os demais arquivos (ícones, manifest) vêm do cache na hora e se atualizam
     em segundo plano. */
var V = 'meili-ficha-v2';
var ARQ = ['./', './index.html', './manifest.webmanifest',
           './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(V).then(function (c) { return c.addAll(ARQ); }).catch(function () {}));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (k) {
      return Promise.all(k.filter(function (n) { return n !== V; })
                          .map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function guarda(req, resp) {
  if (resp && resp.status === 200 && resp.type === 'basic') {
    var cp = resp.clone();
    caches.open(V).then(function (c) { c.put(req, cp); });
  }
  return resp;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var ehPagina = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').indexOf('text/html') > -1;

  if (ehPagina) {
    // rede primeiro; sem internet, serve a última versão guardada
    e.respondWith(
      fetch(req).then(function (r) { return guarda(req, r); })
                .catch(function () {
                  return caches.match(req).then(function (hit) {
                    return hit || caches.match('./index.html');
                  });
                })
    );
    return;
  }

  // demais arquivos: cache na hora, atualização em segundo plano
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (r) { return guarda(req, r); })
                          .catch(function () { return hit; });
      return hit || net;
    })
  );
});
