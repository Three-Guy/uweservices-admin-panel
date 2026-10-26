// src/lib/socket.ts
import { io, Socket } from 'socket.io-client';

/* ─────────────────────────────────────────────
   SOCKET URL — MUST match backend origin
   ───────────────────────────────────────────── */
function resolveSocketUrl(): string {
  // 1. Explicit env var takes priority
  const envUrl = import.meta.env.VITE_SOCKET_URL as string | undefined;
  if (envUrl && envUrl.length > 5) return envUrl.replace(/\/+$/, '');

  // 2. Derive from API base URL (strip /api/v1)
  const apiBase =
    (import.meta.env.VITE_API_URL as string) ||
    (import.meta.env.VITE_API_BASE_URL as string) ||
    '';

  if (apiBase && apiBase.length > 5) {
    const cleaned = apiBase.replace(/\/+$/, '').replace(/\/api\/v\d+$/, '');
    return cleaned;
  }

  // 3. Last resort: production fallback (NOT localhost!)
  return 'https://uweservices-admin-panel.onrender.com';
}

const SOCKET_URL = resolveSocketUrl();
console.log('🔌 Socket URL:', SOCKET_URL);

let socket: Socket | null = null;
let adminRegistered = false;

function getAdminEmail(): string {
  try {
    for (const k of ['admin_data', 'admin', 'user', 'adminUser']) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const o = JSON.parse(raw);
      if (o?.email) return o.email;
      if (o?.data?.email) return o.data.email;
    }
  } catch {}
  return '';
}

function getAuthToken(): string | null {
  const keys = [
    'admin_token', 'adminToken', 'token',
    'accessToken', 'access_token', 'authToken',
  ];
  for (const k of keys) {
    const v = localStorage.getItem(k);
    if (v && v.length > 10 && v !== 'undefined' && v !== 'null') {
      return v.replace(/^"|"$/g, '');
    }
  }
  // Scan for JWT
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key);
      if (val && val.startsWith('eyJ') && val.length > 20) return val;
    }
  } catch {}
  return null;
}

function registerAdmin(s: Socket) {
  if (adminRegistered) return;
  const email = getAdminEmail();
  const token = getAuthToken();

  // Try multiple event names (backend might listen for any of them)
  const payload = { email, token, role: 'admin' };
  s.emit('admin:register', payload);
  s.emit('admin:join', payload);
  s.emit('register:admin', payload);
  s.emit('join:admins', payload);
  s.emit('join', { room: 'admins', ...payload });

  adminRegistered = true;
  console.log('🔌 Admin registered on socket:', { email, hasToken: !!token });
}

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;

  // Cleanup old socket if it exists but disconnected
  if (socket && !socket.connected) {
    try { socket.disconnect(); } catch {}
    socket = null;
    adminRegistered = false;
  }

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true,
    withCredentials: true,
    auth: (cb) => {
      // Attach JWT so backend middleware can authenticate
      cb({
        token: getAuthToken() || '',
        email: getAdminEmail(),
        role: 'admin',
      });
    },
  });

  socket.on('connect', () => {
    console.log('🔌 ✅ Socket CONNECTED:', socket?.id);
    adminRegistered = false;
    if (socket) registerAdmin(socket);
  });

  socket.on('disconnect', (reason) => {
    console.warn('🔌 Socket DISCONNECTED:', reason);
    adminRegistered = false;
  });

  socket.on('connect_error', (err) => {
    console.error('🔌 ❌ Socket CONNECT ERROR:', err.message);
  });

  socket.on('reconnect', (attempt) => {
    console.log(`🔌 🔄 Socket RECONNECTED after ${attempt} attempt(s)`);
    adminRegistered = false;
    if (socket) registerAdmin(socket);
  });

  // Debug: log every event received
  socket.onAny((event, ...args) => {
    if (event !== 'ping' && event !== 'pong') {
      console.log(`🔌 📥 Socket event received: "${event}"`, args[0]);
    }
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
    adminRegistered = false;
  }
}

export function emitEvent(event: string, data: any): void {
  const s = getSocket();
  if (s.connected) s.emit(event, data);
}

export function onEvent(event: string, handler: (data: any) => void): () => void {
  const s = getSocket();
  s.on(event, handler);
  return () => s.off(event, handler);
}

export function isSocketConnected(): boolean {
  return !!(socket && socket.connected);
}