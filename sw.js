const APP_VERSION = "financeiro-v1.15-dev-6";
const CACHE_PREFIX = `meu-controle-${self.registration.scope}-`;
const CACHE_NAME = `${CACHE_PREFIX}${APP_VERSION}`;
const APP_SHELL = ["./", "./index.html", "./config.js", "./auth.js", "./sync-store.js", "./vendor/supabase.js", "./about.js", "./manifest.json", "./logo.png"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener("message", event => { if(event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", event => {
  const request=event.request;
  if(request.method!=="GET") return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;
  // Serve HTML and scripts from the same installed release; no partial upgrades.
  event.respondWith(caches.open(CACHE_NAME).then(async cache=>{
    const cached=await cache.match(request.mode==='navigate'?'./index.html':request);
    return cached||fetch(request);
  }));
});
