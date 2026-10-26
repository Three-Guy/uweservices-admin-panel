// frontend2/src/lib/firebase.ts
import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, Messaging, isSupported } from 'firebase/messaging';

/* ─── CONFIG (admin web project) ─── */
const firebaseConfig = {
  apiKey: 'AIzaSyAM_PICFJ9BwbfOwrsByFgxMpgWWLWs1NI',
  authDomain: 'uwe-services-web.firebaseapp.com',
  projectId: 'uwe-services-web',
  storageBucket: 'uwe-services-web.firebasestorage.app',
  messagingSenderId: '916113283904',
  appId: '1:916113283904:web:321f07b50caf75b60cb8a5',
};

const VAPID_KEY =
  (import.meta.env.VITE_FIREBASE_VAPID_KEY as string) ||
  'BFK6-OITm7_xC7TYHSmjwd_rYZQutNhnGAgYUPxnEDrwYToUy7MqGXzKes2DAYc7BouKJtBZeM4jNjuxBIjWH0w';

/* ─── STATE ─── */
let firebaseApp: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;
let currentToken: string | null = null;
let foregroundListenerSetup = false;

/* ─── INIT ─── */
function initFirebaseApp(): FirebaseApp {
  if (firebaseApp) return firebaseApp;
  if (getApps().length > 0) {
    firebaseApp = getApps()[0];
    return firebaseApp;
  }
  firebaseApp = initializeApp(firebaseConfig);
  console.log('[Firebase] ✅ App initialized');
  return firebaseApp;
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance;
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('[Firebase] ⚠️ Messaging not supported in this browser');
      return null;
    }
    const app = initFirebaseApp();
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch (err) {
    console.error('[Firebase] getMessaging failed:', err);
    return null;
  }
}

/* ─── SERVICE WORKER REGISTRATION ─── */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Firebase] ⚠️ Service Worker not supported');
    return null;
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (existing) {
      console.log('[Firebase] ✅ SW already registered');
      return existing;
    }
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    console.log('[Firebase] ✅ SW registered fresh');
    // Wait until active
    if (reg.installing) {
      await new Promise<void>((resolve) => {
        const sw = reg.installing!;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') resolve();
        });
      });
    }
    return reg;
  } catch (err) {
    console.error('[Firebase] ❌ SW register failed:', err);
    return null;
  }
}

/* ─── GET FCM TOKEN ─── */
export async function getAdminFcmToken(): Promise<string | null> {
  try {
    const isSecure =
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';

    if (!isSecure) {
      console.warn('[Firebase] ⚠️ FCM requires HTTPS or localhost. Current:', window.location.origin);
      return null;
    }

    if (!('Notification' in window)) {
      console.warn('[Firebase] ⚠️ Notifications API not supported');
      return null;
    }

    if (Notification.permission === 'denied') {
      console.error('[Firebase] 🚫 Permission is DENIED!');
      console.error('[Firebase] 💡 To fix: Click 🔒 lock icon (left of URL)');
      console.error('[Firebase]    → Site settings → Notifications → Allow → Reload page');
      return null;
    }

    if (Notification.permission !== 'granted') {
      console.warn('[Firebase] ⚠️ Permission not granted:', Notification.permission);
      return null;
    }

    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    const swReg = await registerServiceWorker();
    if (!swReg) return null;

    console.log('[Firebase] 🔑 Requesting FCM token...');
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    });

    if (token) {
      currentToken = token;
      localStorage.setItem('admin_fcm_token', token);
      console.log('[Firebase] ✅ FCM token acquired:', token.substring(0, 30) + '...');
      setupForegroundListener(messaging);
      return token;
    }

    console.warn('[Firebase] ⚠️ getToken returned empty');
    return null;
  } catch (err: any) {
    console.error('[Firebase] ❌ getAdminFcmToken error:', err?.message || err);
    return null;
  }
}

/* ─── REQUEST PERMISSION + GET TOKEN ─── */
export async function requestAdminPushPermission(): Promise<string | null> {
  try {
    if (!('Notification' in window)) {
      console.warn('[Firebase] ⚠️ Notification API unavailable');
      return null;
    }

    console.log('[Firebase] 🔔 Current permission:', Notification.permission);

    if (Notification.permission === 'denied') {
      console.error('[Firebase] 🚫 Permission is DENIED — cannot request again!');
      console.error('[Firebase] 💡 To fix: Click 🔒 lock icon (left of URL)');
      console.error('[Firebase]    → Site settings → Notifications → Change to Allow');
      console.error('[Firebase]    → Close tab → Reopen → Reload page (F5)');
      return null;
    }

    if (Notification.permission === 'default') {
      console.log('[Firebase] 🙋 Requesting permission from user...');
      const result = await Notification.requestPermission();
      console.log('[Firebase] 🙋 User responded:', result);
      if (result !== 'granted') {
        console.warn('[Firebase] ⚠️ Permission not granted:', result);
        return null;
      }
    }

    if (Notification.permission !== 'granted') {
      console.warn('[Firebase] ⚠️ Permission still not granted');
      return null;
    }

    return await getAdminFcmToken();
  } catch (err: any) {
    console.error('[Firebase] ❌ requestAdminPushPermission error:', err?.message || err);
    return null;
  }
}

/* ─── ALIAS ─── */
export async function registerAdminPush(): Promise<string | null> {
  return requestAdminPushPermission();
}

/* ─── CLEAR TOKEN (for logout) ─── */
export function clearFcmToken(): void {
  currentToken = null;
  localStorage.removeItem('admin_fcm_token');
  console.log('[Firebase] 🗑️ FCM token cleared from memory and localStorage');
}

/* ─── FOREGROUND LISTENER ─── */
function setupForegroundListener(messaging: Messaging) {
  if (foregroundListenerSetup) return;
  foregroundListenerSetup = true;

  onMessage(messaging, (payload) => {
    console.log('[Firebase] 📨 Foreground FCM message:', payload);
    // Dispatch — RealtimeAlertBell handles display + dedupe
    window.dispatchEvent(new CustomEvent('fcm-foreground-message', { detail: payload }));
  });

  console.log('[Firebase] ✅ Foreground listener setup');
}

export async function initForegroundListener(): Promise<void> {
  const messaging = await getMessagingInstance();
  if (messaging) setupForegroundListener(messaging);
}

export function getCurrentFcmToken(): string | null {
  return currentToken || localStorage.getItem('admin_fcm_token');
}

export { firebaseConfig, VAPID_KEY };
export default {
  getAdminFcmToken,
  requestAdminPushPermission,
  registerAdminPush,
  getCurrentFcmToken,
  clearFcmToken,
  initForegroundListener,
};