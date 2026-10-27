// src/App.tsx
import React, { useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './store/StoreContext';
import { AuthProvider, useAuth } from './store/AuthContext';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import Dashboard from './components/pages/Dashboard';
import ProvidersModule from "./components/pages/ProviderModule";
import ProviderDetails from "./pages/ProviderDetails";
import VerificationModule from './components/pages/VerificationModule';
import CategoriesModule from './components/pages/CategoriesModule';
import PricingModule from './components/pages/PricingModule';
import RevenueAnalytics from './components/pages/RevenueAnalytics';
import UsersModule from './components/pages/UsersModule';

// ==================== CHECKOUT PAGES ====================
import CouponManagement from './pages/checkout/CouponManagement';
import CheckoutSettingsPage from './pages/checkout/CheckoutSettings';

// ==================== NOTIFICATION PAGES ====================
import NotificationSender from './pages/SDUI/NotificationSender';
import NotificationsPage from './pages/SDUI/NotificationsPage';

// ==================== LOCATION MANAGEMENT ====================
import CitiesModule from './components/pages/CitiesModule';
import ZonesModule from './components/pages/ZonesModule';

// ==================== SDUI PAGES ====================
import SDUIDashboard from './pages/SDUI/SDUIDashboard';
import CategoriesPage from './pages/SDUI/CategoriesPage';
import ServicesPage from './pages/SDUI/ServicesPage';
import SubservicesPage from './pages/SDUI/SubservicesPage';
import BannersPage from './pages/SDUI/BannersPage';
import TrendingPage from './pages/SDUI/TrendingPage';
import LayoutEditorPage from './pages/SDUI/LayoutEditorPage';
import FeatureFlagsPage from './pages/SDUI/FeatureFlagsPage';
import ASAPSectionManager from './pages/SDUI/ASAPSectionManager';
import BookingsManager from './pages/BookingsManager';

// ==================== LIVE TRACKING ====================
import LiveTracking from './pages/LiveTracking';

// ==================== DISPATCH & ALERTS ====================
import DispatchMonitor from './pages/DispatchMonitor';
import ProviderOfferHistory from './pages/ProviderOfferHistory';
import NotificationCenter from './pages/NotificationCenter';

// ✅ ==================== MANUAL DISPATCH (NEW) ====================
import ManualDispatch from './pages/ManualDispatch';

// ==================== REALTIME BELL (CRITICAL FIX) ====================
import RealtimeAlertBell from './components/RealtimeAlertBell';

import { Toaster } from 'react-hot-toast';
import { getSocket, disconnectSocket } from './lib/socket';

import LoginPage from './pages/LoginPage';
import './index.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const initialized = useRef(false);

  // ── Initialize Socket.IO on login (Firebase handled by RealtimeAlertBell) ──
  useEffect(() => {
    if (!isAuthenticated || initialized.current) return;
    initialized.current = true;

    try {
      // Connect Socket.IO (auto-registers admin with email from localStorage)
      getSocket();

      // Firebase/FCM initialization happens inside RealtimeAlertBell
      // when user clicks "Allow Notifications" button
    } catch (err) {
      console.warn('[Init] Non-critical initialization error:', err);
    }

    return () => {
      disconnectSocket();
      initialized.current = false;
    };
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header already renders <RealtimeAlertBell /> internally */}
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <Router>
          {/* ── Global Toast Notifications ── */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 5000,
              style: {
                borderRadius: '12px',
                background: '#1f2937',
                color: '#f9fafb',
                fontSize: '13px',
                padding: '12px 16px',
              },
              success: { iconTheme: { primary: '#10b981', secondary: '#f9fafb' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#f9fafb' } },
            }}
          />

          <Routes>
            {/* ==================== AUTH ROUTES ==================== */}
            <Route path="/login" element={<LoginPage />} />

            {/* ==================== DASHBOARD ==================== */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Dashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* ==================== PROVIDERS & USERS ==================== */}
            <Route
              path="/providers"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProvidersModule />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/providers/:id"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProviderDetails />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/verifications"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <VerificationModule />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <UsersModule />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* ==================== LOCATION MANAGEMENT ==================== */}
            <Route
              path="/locations/cities"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CitiesModule />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/locations/zones"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ZonesModule />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* ==================== LIVE TRACKING ==================== */}
            <Route
              path="/tracking"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <LiveTracking />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* ==================== DISPATCH SYSTEM ==================== */}
            <Route
              path="/dispatch"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <DispatchMonitor />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* ✅ ==================== MANUAL DISPATCH (NEW ROUTE) ==================== */}
            <Route
              path="/manual-dispatch"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ManualDispatch />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/provider-offers"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ProviderOfferHistory />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <NotificationCenter />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* ==================== CATEGORIES & PRICING ==================== */}
            <Route
              path="/categories"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CategoriesModule />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/pricing"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <PricingModule />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* ==================== ANALYTICS ==================== */}
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <RevenueAnalytics />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* ==================== SDUI MANAGER ==================== */}
            <Route
              path="/sdui"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SDUIDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sdui/categories"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CategoriesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sdui/services"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ServicesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sdui/subservices"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <SubservicesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sdui/banners"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <BannersPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sdui/trending"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <TrendingPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sdui/layout-editor"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <LayoutEditorPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sdui/feature-flags"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <FeatureFlagsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sdui/asap-sections"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <ASAPSectionManager />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* ==================== NOTIFICATIONS ROUTES ==================== */}
            <Route
              path="/sdui/notifications"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <NotificationsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/sdui/notifications/send"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <NotificationSender />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* ==================== BOOKINGS ==================== */}
            <Route
              path="/bookings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <BookingsManager />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* ==================== CHECKOUT MANAGEMENT ==================== */}
            <Route
              path="/checkout/coupons"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CouponManagement />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/checkout/settings"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <CheckoutSettingsPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* ==================== CATCH ALL ==================== */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </StoreProvider>
    </AuthProvider>
  );
}

export default App;