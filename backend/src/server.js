// src/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');

// Load environment variables FIRST
require('dotenv').config();

const connectDB = require('./config/database');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

// ===== HELPER FUNCTIONS =====
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '0.0.0.0';
}

const LOCAL_IP = getLocalIP();

const buildAllowedOrigins = () => {
  const origins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5002',
    'http://localhost:8081',
    'http://localhost:8080',
    'http://localhost:19000',
    'http://localhost:19001',
    'http://localhost:19002',
    'http://localhost:19006',
    `http://${LOCAL_IP}:3000`,
    `http://${LOCAL_IP}:3001`,
    `http://${LOCAL_IP}:5002`,
    `http://${LOCAL_IP}:5173`,
    `http://${LOCAL_IP}:8081`,
    'http://10.0.2.2:5002',
    'http://10.0.3.2:5002',
    'http://10.14.26.26:3000',
    'http://10.14.26.26:5002',
    'http://172.30.128.1:3000',
    'http://172.30.128.1:5002',
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

// ===== MIDDLEWARE =====
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
  if (req.isMobile || req.isNativeApp) {
    console.log(`📱 Mobile Request - Platform: ${req.clientPlatform}`);
  }
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    platform: req.clientPlatform,
  });
  next();
});

// ===== HEALTH CHECK =====
app.get('/health', (req, res) => {
  const { getAdminConnection, getProviderConnection, getUserConnection, isDbConnected } = require('./config/database');
  const { isFirebaseReady } = require('./config/firebase');

  let redisStatus = 'not_configured';
  try {
    const { isRedisConnected } = require('./config/redis');
    redisStatus = isRedisConnected() ? 'connected' : 'disconnected';
  } catch (e) { redisStatus = 'not_configured'; }

  const adminConn = getAdminConnection();
  const providerConn = getProviderConnection();
  const userConn = getUserConnection();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'admin-panel-backend',
    connections: {
      adminDb: adminConn?.readyState === 1 ? 'connected' : 'disconnected',
      providerDb: providerConn?.readyState === 1 ? 'connected' : 'disconnected',
      userDb: userConn?.readyState === 1 ? 'connected' : 'disconnected',
      redis: redisStatus,
      firebase: isFirebaseReady() ? 'ready' : 'not_initialized',
      dispatchEngine: process.env.DISPATCH_ENABLED === 'true' ? 'enabled' : 'disabled',
      overall: isDbConnected() ? 'connected' : 'disconnected',
    },
    environment: process.env.NODE_ENV || 'development',
    version: '2.1.0',
    serverIP: LOCAL_IP,
    mobileSupport: true,
    clientInfo: {
      platform: req.clientPlatform,
      isMobile: req.isMobile,
      isNativeApp: req.isNativeApp,
      origin: req.headers.origin || 'none',
    },
  });
});

// ===== MOBILE SPECIFIC ENDPOINTS =====
app.get('/api/v1/mobile/version-check', (req, res) => {
  res.json({
    success: true,
    data: { minimumVersion: '1.0.0', currentVersion: '1.0.0', updateRequired: false, updateRecommended: false, maintenanceMode: false },
  });
});

app.post('/api/v1/mobile/register-device', (req, res) => {
  const { pushToken, platform, deviceId } = req.body;
  logger.info('Mobile device registration', { platform, deviceId, hasPushToken: !!pushToken });
  res.json({ success: true, message: 'Device registered successfully', data: { registered: true, deviceId } });
});

// ===== ADMIN FCM TOKEN REGISTRATION (NEW) =====
// Store admin web-push FCM tokens so admin panel can receive browser push
const adminFcmTokens = new Map(); // adminEmail -> Set<token>

app.post('/api/v1/admin/fcm/register', (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const email = req.body?.adminEmail;
    const token = req.body?.fcmToken;
    if (!token || !email) {
      return res.status(400).json({ success: false, message: 'adminEmail and fcmToken required' });
    }
    if (!adminFcmTokens.has(email)) adminFcmTokens.set(email, new Set());
    adminFcmTokens.get(email).add(token);
    logger.info(`Admin FCM token registered: ${email}`);
    res.json({ success: true, message: 'Token registered' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/v1/admin/fcm/unregister', (req, res) => {
  const { adminEmail, fcmToken } = req.body;
  if (adminEmail && adminFcmTokens.has(adminEmail)) {
    adminFcmTokens.get(adminEmail).delete(fcmToken);
  }
  res.json({ success: true });
});

app.get('/api/v1/admin/fcm/tokens', (req, res) => {
  const result = {};
  adminFcmTokens.forEach((set, email) => { result[email] = Array.from(set); });
  res.json({ success: true, data: result });
});

// Expose for internal use
app.locals.getAdminFcmTokens = () => {
  const all = [];
  adminFcmTokens.forEach((set) => set.forEach((t) => all.push(t)));
  return all;
};

// ===== SOCKET.IO =====
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  socket.join('admins');

  socket.on('admin:register', (data) => {
    logger.info(`Admin socket registered: ${socket.id}`, data);
    if (data?.email) socket.join(`admin:${data.email}`);
  });

  socket.on('mobile:register', (data) => {
    logger.info(`Mobile device registered: ${socket.id}`, data);
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

// ===== START SERVER =====
const PORT = process.env.PORT || 5002;
const HOST = '0.0.0.0';

async function startServer() {
  try {
    logger.info('Starting Admin Panel Backend Server...');
    logger.info('═'.repeat(64));

    console.log('\n🔌 Connecting to databases...');
    await connectDB();
    console.log('✅ All databases connected successfully\n');

    try {
      const { connectRedis } = require('./config/redis');
      await connectRedis();
    } catch (redisError) {
      console.warn('⚠️ Redis not available - running without cache');
    }

    // ===== INITIALIZE FIREBASE =====
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

    // ===== NEW DISPATCH ROUTES =====
    const dispatchRoutes = require('./routes/dispatch.routes');
    const providerOfferRoutes = require('./routes/providerOffer.routes');
    const adminNotificationRoutes = require('./routes/adminNotification.routes');

    app.use('/api/v1/admin/auth', authRoutes);
    app.use('/api/v1/admin/verifications', verificationRoutes);
    app.use('/api/v1/admin/providers', providerRoutes);
    app.use('/api/v1/admin/dashboard', dashboardRoutes);
    app.use('/api/v1/admin/users', userRoutes);
    app.use('/api/v1/admin/cities', cityRoutes);
    app.use('/api/v1/admin/zones', zoneRoutes);
    app.use('/api/v1/admin/tracking', trackingRoutes);
    console.log('📍 Tracking routes loaded at /api/v1/admin/tracking');

    app.use('/api/v1/admin/bookings', bookingRoutes);
    console.log('✓ /api/v1/admin/bookings routes mounted');

    // ===== NEW ROUTES MOUNTED =====
    app.use('/api/v1/admin/dispatch', dispatchRoutes);
    app.use('/api/v1/admin/provider-offers', providerOfferRoutes);
    app.use('/api/v1/admin/admin-notifications', adminNotificationRoutes);
    console.log('✓ /api/v1/admin/dispatch routes mounted');
    console.log('✓ /api/v1/admin/provider-offers routes mounted');
    console.log('✓ /api/v1/admin/admin-notifications routes mounted');

    console.log('✓ /api/v1/admin/auth routes mounted');
    console.log('✓ /api/v1/admin/verifications routes mounted');
    console.log('✓ /api/v1/admin/providers routes mounted');
    console.log('✓ /api/v1/admin/dashboard routes mounted');
    console.log('✓ /api/v1/admin/users routes mounted');
    console.log('✓ /api/v1/admin/cities routes mounted');
    console.log('✓ /api/v1/admin/zones routes mounted');

    app.use('/api/v1/admin/categories', categoryRoutes);
    app.use('/api/v1/admin/services', serviceRoutes);
    app.use('/api/v1/admin/subservices', subserviceRoutes);
    app.use('/api/v1/admin/banners', bannerRoutes);
    app.use('/api/v1/admin/layouts', layoutRoutes);
    app.use('/api/v1/admin/feature-flags', featureFlagRoutes);
    app.use('/api/v1/admin/trending', trendingRoutes);
    app.use('/api/v1/admin/sdui', sduiRoutes);

    console.log('✓ /api/v1/admin/categories routes mounted');
    console.log('✓ /api/v1/admin/services routes mounted');
    console.log('✓ /api/v1/admin/subservices routes mounted');
    console.log('✓ /api/v1/admin/banners routes mounted');
    console.log('✓ /api/v1/admin/layouts routes mounted');
    console.log('✓ /api/v1/admin/feature-flags routes mounted');
    console.log('✓ /api/v1/admin/trending routes mounted');
    console.log('✓ /api/v1/admin/sdui routes mounted');

    app.use('/api/v1/admin/notifications', notificationRoutes);
    console.log('✓ /api/v1/admin/notifications routes mounted');

    app.use('/api/v1/admin/asap-sections', asapSectionRoutes);
    app.use('/api/v1/admin/coupons', couponRoutes);
    app.use('/api/v1/admin/checkout', checkoutRoutes);

    console.log('✓ /api/v1/admin/coupons routes mounted');
    console.log('✓ /api/v1/admin/checkout routes mounted');

    app.use('/api/v1/system', systemRoutes);
    console.log('✓ /api/v1/system routes mounted (PUBLIC - No Auth)');
    console.log('✓ /api/v1/mobile/* routes mounted (PUBLIC - Mobile)');

    logger.info('✓ All routes initialized successfully');

    const errorHandler = require('./middleware/error.middleware');
    app.use(errorHandler);

    app.use((req, res) => {
      console.log(`\n⚠️ 404 - Route not found: ${req.method} ${req.path}`);
      res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.path,
        method: req.method,
        error: { code: 'ROUTE_NOT_FOUND', statusCode: 404 },
      });
    });

    try {
      const connectRabbitMQ = require('./config/rabbitmq');
      connectRabbitMQ(io).catch(err => {
        logger.warn('RabbitMQ connection failed (non-critical):', err.message);
      });
    } catch (err) {
      logger.warn('RabbitMQ module not available');
    }

    // ===== START DISPATCH ENGINE =====
    try {
      const { setIo } = require('./services/adminAlertService');
      setIo(io);

      const { startPoller } = require('./workers/bookingPoller');
      const { startWatcher } = require('./workers/dispatchWorker');
      startPoller();
      startWatcher();
    } catch (dispatchErr) {
      logger.error(`Dispatch engine failed to start: ${dispatchErr.message}`);
    }

    server.listen(PORT, HOST, () => {
      let isRedisConnectedFn = () => false;
      try {
        const redis = require('./config/redis');
        isRedisConnectedFn = redis.isRedisConnected;
      } catch (e) {}

      const { isFirebaseReady } = require('./config/firebase');

      console.log(`
╔════════════════════════════════════════════════════════════════╗
║     🚀 Admin Panel Backend Server v2.1 (DISPATCH ENABLED)      ║
╠════════════════════════════════════════════════════════════════╣
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(47)}║
║  Port:        ${PORT.toString().padEnd(47)}║
╠════════════════════════════════════════════════════════════════╣
║  📦 Connections:                                               ║
║     Database:  ✅ Connected                                    ║
║     Redis:     ${isRedisConnectedFn() ? '✅ Connected' : '⚠️  Not Connected'}                                    ║
║     Firebase:  ${isFirebaseReady() ? '✅ Ready    ' : '⚠️  Not Ready'}                                     ║
║     Dispatch:  ${process.env.DISPATCH_ENABLED === 'true' ? '✅ RUNNING  ' : '⚠️  DISABLED '}                                    ║
║     Socket.IO: ✅ Ready                                        ║
╠════════════════════════════════════════════════════════════════╣
║  📡 Access URLs:                                               ║
║      LOCAL:   http://localhost:${PORT}                             ║
║      NETWORK: http://${LOCAL_IP}:${PORT}                           ║
╚════════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  }
}

const gracefulShutdown = async (signal) => {
  logger.info(`\n${signal} received, shutting down gracefully...`);
  try {
    const { stopPoller } = require('./workers/bookingPoller');
    const { stopWatcher } = require('./workers/dispatchWorker');
    stopPoller();
    stopWatcher();
  } catch (e) {}

  io.to('mobile-clients').emit('server:shutdown', { message: 'Server is restarting', reconnectDelay: 5000 });

  try {
    const { closeRedis } = require('./config/redis');
    await closeRedis();
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
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

startServer();

module.exports = app;