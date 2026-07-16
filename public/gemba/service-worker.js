// Bu servis çalışanı kasıtlı olarak hiçbir şeyi önbelleğe almaz.
// Tek işlevi PWA kurulabilirliğini sağlamaktır (telefonda "Ana ekrana ekle").
// Önceki sürümlerde uygulanan önbellekleme, güncellemelerin telefonlarda
// gecikmeli/tutarsız görünmesine yol açtığı için tamamen kaldırıldı — artık
// her istek doğrudan ağa gider, tarayıcının normal davranışıyla aynıdır.

const OLD_CACHE_NAMES = ['gemba-shell-v1', 'gemba-shell-v2'];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => OLD_CACHE_NAMES.includes(n)).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});
