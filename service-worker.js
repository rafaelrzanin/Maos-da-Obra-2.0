
// service-worker.js

const CACHE_NAME = 'maos-da-obra-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/ze.png', // O ícone do Zé da Obra
  // Adicione aqui outros ativos estáticos críticos do seu app para cache offline
  // Ex: '/assets/app-bundle.js', '/assets/style.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// ======================================
// PUSH NOTIFICATIONS
// ======================================

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  console.log('Push received:', data);

  const title = data.title || 'Mãos da Obra';
  const options = {
    body: data.body || 'Você tem uma nova notificação da sua obra!',
    icon: data.icon || '/ze.png', // Ícone da notificação
    badge: data.badge || '/ze.png', // Ícone menor para Android
    data: {
      url: data.url || self.location.origin // URL para abrir ao clicar
    },
    // Vibrar para Android
    vibrate: [200, 100, 200], 
    // Ação para fechar notificações automaticamente após clique
    renotify: true,
    tag: data.tag || 'maos-da-obra-notification', // Agrupa notificações similares
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Fecha a notificação ao clicar

  const targetUrl = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Tenta encontrar uma janela existente do app e focá-la
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus().then(focusedClient => {
              // Se já está na página, apenas foque. Se não, navegue.
              if (focusedClient && focusedClient.url !== targetUrl) {
                return focusedClient.navigate(targetUrl);
              }
              return focusedClient;
            });
          }
        }
        // Se nenhuma janela do app for encontrada, abre uma nova
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
    