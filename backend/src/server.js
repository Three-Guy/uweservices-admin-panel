// src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

require('dotenv').config();

const connectDB = require('./config/database');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '0.0.0.0';
}

const LOCAL_IP = getLocalIP();

const buildAllowedOrigins = () => {
  const origins = [
    'http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173',
    'http://localhost:5002', 'http://localhost:8081', 'http://localhost:8080',
    `http://${LOCAL_IP}:3000`, `http://${LOCAL_IP}:3001`,
    `http://${LOCAL_IP}:5002`, `http://${LOCAL_IP}:5173`,
  ];
  if (process.env.ALLOWED_ORIGINS) {
    origins.push(...process.env.ALLOWED_ORIGINS.split(','));
  }
  return [...new Set(origins)];
};

const ALLOWED_ORIGINS = buildAllowedOrigins();
console.log('📋 Allowed Origins:', ALLOWED_ORIGINS);

const io = new Server(server, {
  cors: {
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  allowEIO3: true,
});

app.set('io', io);

app.set('trust proxy', true);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (process.env.NODE_ENV !== 'production') {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma, ' +
    'X-App-Version, X-Platform, X-Device-Id, X-Device-Model, X-OS-Version, X-Push-Token, X-Timezone, X-Locale, X-Network-Type, X-App-Build'
  );
  res.setHeader('Access-Control-Expose-Headers',
    'X-Total-Count, X-Page, X-Per-Page, X-Total-Pages, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Content-Disposition'
  );
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  const userAgent = req.get('user-agent') || '';
  const platform = req.get('x-platform')?.toLowerCase() || '';
  req.isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|webOS|Windows Phone|Expo|ReactNative|Dart|Flutter|okhttp|CFNetwork/i.test(userAgent);
  req.isNativeApp = platform === 'ios' || platform === 'android' ||
                    /Expo|ReactNative|Dart|Flutter|okhttp|CFNetwork/i.test(userAgent);
  req.clientPlatform = platform || (req.isNativeApp ? 'native' : (req.isMobile ? 'mobile-web' : 'web'));
  req.appVersion = req.get('x-app-version') || null;
  req.deviceId = req.get('x-device-id') || null;
  next();
});

app.use((req, res, next) => {
  console.log(`\n📨 ${req.method} ${req.path}`);
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    try { console.log('📦 Body:', JSON.stringify(req.body, null, 2)); } catch(e) {}
  }
  next();
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  const { getAdminConnection, getProviderConnection, getUserConnection, getBookingConnection, isDbConnected } = require('./config/database');
  const { isProviderFirebaseReady, isAdminWebFirebaseReady } = require('./config/firebase');

  let redisStatus = 'not_configured';
  try {
    const { isRedisConnected } = require('./config/redis');
    redisStatus = isRedisConnected() ? 'connected' : 'disconnected';
  } catch (e) {}

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'admin-panel-backend',
    connections: {
      adminDb: getAdminConnection()?.readyState === 1 ? 'connected' : 'disconnected',
      providerDb: getProviderConnection()?.readyState === 1 ? 'connected' : 'disconnected',
      userDb: getUserConnection()?.readyState === 1 ? 'connected' : 'disconnected',
      bookingDb: getBookingConnection()?.readyState === 1 ? 'connected' : 'disconnected',
      redis: redisStatus,
      providerFirebase: isProviderFirebaseReady() ? 'ready' : 'not_initialized',
      adminWebFirebase: isAdminWebFirebaseReady() ? 'ready' : 'not_initialized',
      dispatchEngine: process.env.DISPATCH_ENABLED === 'true' ? 'enabled' : 'disabled',
      overall: isDbConnected() ? 'connected' : 'disconnected',
    },
    environment: process.env.NODE_ENV || 'development',
    version: '2.2.0',
    serverIP: LOCAL_IP,
  });
});

app.get('/api/v1/mobile/version-check', (req, res) => {
  res.json({ success: true, data: { minimumVersion: '1.0.0', currentVersion: '1.0.0', updateRequired: false } });
});

app.post('/api/v1/mobile/register-device', (req, res) => {
  res.json({ success: true, message: 'Device registered', data: { registered: true } });
});

// ===== SOCKET.IO =====
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  socket.join('admins');

  socket.on('admin:register', (data) => {
    logger.info(`Admin socket registered: ${socket.id}`, data);
    if (data?.email) socket.join(`admin:${data.email}`);
  });

  socket.on('mobile:register', (data) => {
    if (data?.deviceId) socket.join(`device:${data.deviceId}`);
  });

  socket.on('mobile:heartbeat', () => {
    socket.emit('mobile:heartbeat:ack', { timestamp: Date.now() });
  });

  socket.on('disconnect', (reason) => {
    logger.info(`Client disconnected: ${socket.id}, reason: ${reason}`);
  });

  socket.on('layout:preview', (data) => {
    socket.broadcast.to('admins').emit('layout:preview', data);
  });
});

const PORT = process.env.PORT || 5002;
const HOST = '0.0.0.0';

async function startServer() {
  try {
    logger.info('Starting Admin Panel Backend Server v2.2 ...');
    console.log('\n🔌 Connecting to databases...');
    await connectDB();
    console.log('✅ All databases connected successfully\n');

    try {
      const { connectRedis } = require('./config/redis');
      await connectRedis();
    } catch (e) {
      console.warn('⚠️ Redis not available');
    }

    try {
      const { initializeFirebase } = require('./config/firebase');
      initializeFirebase();
    } catch (fbErr) {
      logger.warn(`Firebase init warning: ${fbErr.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('🔄 Initializing routes...');

    const authRoutes = require('./routes/auth.routes');
    const verificationRoutes = require('./routes/verification.routes');
    const providerRoutes = require('./routes/provider.routes');
    const dashboardRoutes = require('./routes/dashboard.routes');
    const userRoutes = require('./routes/user.routes');
    const cityRoutes = require('./routes/city.routes');
    const zoneRoutes = require('./routes/zone.routes');
    const categoryRoutes = require('./routes/category.routes');
    const serviceRoutes = require('./routes/service.routes');
    const subserviceRoutes = require('./routes/subservice.routes');
    const bannerRoutes = require('./routes/banner.routes');
    const layoutRoutes = require('./routes/layout.routes');
    const featureFlagRoutes = require('./routes/featureFlag.routes');
    const systemRoutes = require('./routes/system.routes');
    const trendingRoutes = require('./routes/trendingRoutes');
    const sduiRoutes = require('./routes/sdui.routes');
    const asapSectionRoutes = require('./routes/asapSection.routes');
    const notificationRoutes = require('./routes/notification.routes');
    const couponRoutes = require('./routes/couponRoutes');
    const checkoutRoutes = require('./routes/checkoutRoutes');
    const bookingRoutes = require('./routes/booking.routes');
    const trackingRoutes = require('./routes/tracking.routes');

    const dispatchRoutes = require('./routes/dispatch.routes');
    const providerOfferRoutes = require('./routes/providerOffer.routes');
    const adminNotificationRoutes = require('./routes/adminNotification.routes');
    const adminFcmTokenRoutes = require('./routes/adminFcmToken.routes'); // ✅ NEW

    app.use('/api/v1/admin/auth', authRoutes);
    app.use('/api/v1/admin/verifications', verificationRoutes);
    app.use('/api/v1/admin/providers', providerRoutes);
    app.use('/api/v1/admin/dashboard', dashboardRoutes);
    app.use('/api/v1/admin/users', userRoutes);
    app.use('/api/v1/admin/cities', cityRoutes);
    app.use('/api/v1/admin/zones', zoneRoutes);
    app.use('/api/v1/admin/tracking', trackingRoutes);
    app.use('/api/v1/admin/bookings', bookingRoutes);
    app.use('/api/v1/admin/dispatch', dispatchRoutes);
    app.use('/api/v1/admin/provider-offers', providerOfferRoutes);
    app.use('/api/v1/admin/admin-notifications', adminNotificationRoutes);

    // ✅ NEW: Admin FCM token registration (handles /admin/fcm/register, /admin/fcm/unregister)
    app.use('/api/v1/admin/fcm', adminFcmTokenRoutes);
    console.log('✓ /api/v1/admin/fcm routes mounted');

    app.use('/api/v1/admin/categories', categoryRoutes);
    app.use('/api/v1/admin/services', serviceRoutes);
    app.use('/api/v1/admin/subservices', subserviceRoutes);
    app.use('/api/v1/admin/banners', bannerRoutes);
    app.use('/api/v1/admin/layouts', layoutRoutes);
    app.use('/api/v1/admin/feature-flags', featureFlagRoutes);
    app.use('/api/v1/admin/trending', trendingRoutes);
    app.use('/api/v1/admin/sdui', sduiRoutes);
    app.use('/api/v1/admin/notifications', notificationRoutes);
    app.use('/api/v1/admin/asap-sections', asapSectionRoutes);
    app.use('/api/v1/admin/coupons', couponRoutes);
    app.use('/api/v1/admin/checkout', checkoutRoutes);
    app.use('/api/v1/system', systemRoutes);

    logger.info('✓ All routes initialized successfully');

    const errorHandler = require('./middleware/error.middleware');
    app.use(errorHandler);

    app.use((req, res) => {
      console.log(`\n⚠️ 404: ${req.method} ${req.path}`);
      res.status(404).json({ success: false, message: 'Route not found', path: req.path });
    });

    try {
      const connectRabbitMQ = require('./config/rabbitmq');
      connectRabbitMQ(io).catch(err => logger.warn('RabbitMQ failed:', err.message));
    } catch (err) {}

    // ===== START DISPATCH ENGINE =====
    try {
      const { setIo } = require('./services/adminAlertService');
      setIo(io);

      // ✅ FIX: use correct exports from bookingPoller
      const { startBookingPoller } = require('./workers/bookingPoller');
      const { startWatcher } = require('./workers/dispatchWorker');
      startBookingPoller();
      startWatcher();
      logger.info('✅ Dispatch engine started');
    } catch (dispatchErr) {
      logger.error(`Dispatch engine failed to start: ${dispatchErr.message}`);
      logger.error(dispatchErr.stack);
    }

    server.listen(PORT, HOST, () => {
      const { isProviderFirebaseReady, isAdminWebFirebaseReady } = require('./config/firebase');
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║  🚀 Admin Panel Backend v2.2 (FCM + DISPATCH + CHANGE STREAM)  ║
╠════════════════════════════════════════════════════════════════╣
║  Port:                  ${PORT.toString().padEnd(39)}║
║  Database:              ✅ Connected                            ║
║  Provider Firebase:     ${isProviderFirebaseReady() ? '✅ Ready    ' : '⚠️  Not Ready'}                            ║
║  Admin Web Firebase:    ${isAdminWebFirebaseReady() ? '✅ Ready    ' : '⚠️  Not Ready'}                            ║
║  Dispatch:              ${process.env.DISPATCH_ENABLED === 'true' ? '✅ RUNNING  ' : '⚠️  DISABLED '}                            ║
║  Socket.IO:             ✅ Ready                                ║
╠════════════════════════════════════════════════════════════════╣
║  LOCAL:   http://localhost:${PORT}                                 ║
║  NETWORK: http://${LOCAL_IP}:${PORT}                               ║
╚════════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

const gracefulShutdown = async (signal) => {
  logger.info(`\n${signal} received, shutting down gracefully...`);
  try {
    const { stopBookingPoller } = require('./workers/bookingPoller');
    const { stopWatcher } = require('./workers/dispatchWorker');
    stopBookingPoller();
    stopWatcher();
  } catch (e) {}

  io.close(() => logger.info('Socket.IO closed'));
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

startServer();

module.exports = app;