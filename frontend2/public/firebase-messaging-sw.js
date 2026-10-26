// frontend2/public/firebase-messaging-sw.js
// ✅ Firebase Cloud Messaging Service Worker — SHOWS SYSTEM NOTIFICATION BAR

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
 * ✅ Background message handler — ALWAYS show system notification
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] 📩 Background message received:', payload);

  const notif = payload.notification || {};
  const data = payload.data || {};

  const title = notif.title || data.title || '🔔 UWE Admin — New Booking';
  const body = notif.body || data.body || data.message || 'You have a new notification';

  const options = {
    body: body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    image: notif.image || data.image || undefined,
    tag: data.bookingId || data.type || `admin-alert-${Date.now()}`,
    requireInteraction: true,
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    data: {
      ...data,
      click_action: data.click_action || data.actionUrl || '/',
    },
    actions: [
      { action: 'view', title: 'View Booking' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  console.log('[SW] 🔔 Showing notification:', title);
  return self.registration.showNotification(title, options);
});

/**
 * ✅ Raw push event — fallback for web push not wrapped by FCM
 */
self.addEventListener('push', (event) => {
  console.log('[SW] 📬 Raw push event received');

  if (!event.data) {
    console.log('[SW] No data in push event');
    return;
  }

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    try {
      payload = { notification: { title: 'UWE Admin', body: event.data.text() } };
    } catch (e2) {
      payload = { notification: { title: 'UWE Admin', body: 'New alert' } };
    }
  }

  console.log('[SW] 📬 Push payload:', payload);

  const notif = payload.notification || {};
  const data = payload.data || {};

  const title = notif.title || data.title || '🔔 UWE Admin';
  const options = {
    body: notif.body || data.body || data.message || 'New notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: data.bookingId || data.type || `admin-${Date.now()}`,
    requireInteraction: true,
    renotify: true,
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * ✅ Notification click handler
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] 🖱️ Notification clicked:', event.notification.tag, 'action:', event.action);
  event.notification.close();

  if (event.action === 'dismiss') return;

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
  console.log('[SW] 🔧 Installing v3');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] ✅ Activated v3');
  event.waitUntil(clients.claim());
});