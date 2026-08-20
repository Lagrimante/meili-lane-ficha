/* Service worker da Ficha Meili Lane.
   Objetivo: depois da primeira abertura, a ficha funciona SEM internet.

   Estratégia em duas vias:
   · a PÁGINA tenta a rede primeiro e cai no cache se não houver internet,
     de modo que uma correção publicada entra já na abertura seguinte;
   · os demais arquivos vêm do cache na hora e se atualizam em segundo plano.

   Dois cuidados que parecem detalhe e não são:
   · toda escrita no cache vai dentro de waitUntil — sem isso o navegador
     encerra o worker logo depois da resposta e a gravação se perde,
     deixando a cópia offline velha para sempre;
   · a página é guardada sempre na mesma chave (./index.html e ./), e URLs
     com query nunca são guardadas, senão o cache enche de duplicatas. */
var V = 'meili-ficha-v3';
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

function guardavel(req, resp) {
  if (!resp || resp.status !== 200 || resp.type !== 'basic') return false;
  try { if (new URL(req.url).search) return false; } catch (err) { return false; }
  return true;
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var ehPagina = req.mode === 'navigate' ||
                 (req.headers.get('accept') || '').indexOf('text/html') > -1;

  if (ehPagina) {
    e.respondWith(
      fetch(req).then(function (r) {
        if (r && r.status === 200 && r.type === 'basic') {
          var a = r.clone(), b = r.clone();
          e.waitUntil(caches.open(V).then(function (c) {
            return Promise.all([c.put('./index.html', a), c.put('./', b)]);
          }).catch(function () {}));
        }
        return r;
      }).catch(function () {
        return caches.match('./index.html').then(function (hit) {
          return hit || caches.match('./');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (r) {
        if (guardavel(req, r)) {
          var cp = r.clone();
          e.waitUntil(caches.open(V).then(function (c) { return c.put(req, cp); })
                            .catch(function () {}));
        }
        return r;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
