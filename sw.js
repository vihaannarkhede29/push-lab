var CACHE = "push-lab-v1";
var ASSETS = [
  "index.html",
  "styles.css",
  "engine.js",
  "app.js",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS.map(function (path) {
        return new URL(path, self.registration.scope).href;
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) { return key !== CACHE; }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async function () {
    var cache = await caches.open(CACHE);
    try {
      var res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      var cached = await cache.match(req);
      if (cached) return cached;
      if (req.mode === "navigate") {
        return cache.match(new URL("index.html", self.registration.scope).href);
      }
      throw err;
    }
  })());
});
