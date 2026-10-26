// frontend2/public/firebase-messaging-sw.js
// ✅ Firebase Cloud Messaging Service Worker

/* eslint-disable no-undef */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAM_PICFJ9BwbfOwrsByFgxMpgWWLWs1NI',
  authDomain: 'uwe-services-web.firebaseapp.com',
  projectId: 'uwe-services-web',
  storageBucket: 'uwe-services-web.firebasestorage.app',
  messagingSenderId: '916113283904',
  appId: '1:916113283904:web:321f07b50caf75b60cb8a5',
});

const messaging = firebase.messaging();

/**
 * Background message handler.
 * If payload has `notification` field → browser auto-displays, we skip.
 * If data-only → we display manually.
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] 📩 Background message:', payload);

  if (payload.notification) {
    // Browser auto-displays — do nothing to avoid duplicate
    return;
  }

  const title = (payload.data && payload.data.title) || '🔔 UWE Admin';
  const options = {
    body: (payload.data && payload.data.body) || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: (payload.data && (payload.data.bookingId || payload.data.type)) || 'admin-alert',
    requireInteraction: (payload.data && payload.data.type) === 'no_provider_found',
    data: payload.data || {},
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let urlToOpen = '/';

  if (data.actionUrl && typeof data.actionUrl === 'string' && data.actionUrl.startsWith('/')) {
    urlToOpen = data.actionUrl;
  } else if (data.click_action && typeof data.click_action === 'string' && data.click_action.startsWith('/')) {
    urlToOpen = data.click_action;
  } else if (data.bookingId) {
    urlToOpen = `/bookings?open=${encodeURIComponent(data.bookingId)}`;
  }

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            if ('navigate' in client) {
              try { await client.navigate(urlToOpen); } catch (_) {}
            }
            return;
          }
        } catch (_) {}
      }

      if (clients.openWindow) {
        await clients.openWindow(urlToOpen);
      }
    })()
  );
});

self.addEventListener('install', () => {
  console.log('[SW] 🔧 Installing');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] ✅ Activated');
  event.waitUntil(clients.claim());
});