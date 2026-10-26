// src/lib/socket.ts
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5002';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket && socket.connected) return socket;

  const adminDataStr = localStorage.getItem('admin_data');
  let adminEmail = '';
  try {
    if (adminDataStr) adminEmail = JSON.parse(adminDataStr).email || '';
  } catch (e) {}

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected:', socket?.id);
    socket?.emit('admin:register', { email: adminEmail });
  });

  socket.on('disconnect', (reason) => {
    console.warn('🔌 Socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('🔌 Socket connect error:', err.message);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
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