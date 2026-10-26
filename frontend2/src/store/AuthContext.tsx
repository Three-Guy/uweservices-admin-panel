import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../lib/api';
import { registerAdminPush, getCurrentFcmToken } from '../lib/firebase';
import { fcmApi } from '../lib/dispatchClient';

// ==================== TYPES ====================
interface Admin {
  _id: string;
  email: string;
  name: string;
  role: string;
  permissions?: string[];
  isActive?: boolean;
  lastLogin?: string;
}

interface AuthContextType {
  admin: Admin | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

// ==================== CONTEXT ====================
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ==================== FCM HELPER ====================
/**
 * Registers FCM token with backend after successful auth.
 * NEVER throws — failures are logged but silently ignored
 * so they never block login or session restore.
 */
async function registerFcmAfterAuth(adminEmail: string): Promise<void> {
  try {
    console.log('\n[Auth] 🔔 ===== FCM REGISTRATION START =====');
    console.log('[Auth] Admin email:', adminEmail);

    // Step 1: Request permission + get FCM token from Firebase
    const fcmToken = await registerAdminPush();

    if (!fcmToken) {
      console.warn('[Auth] ⚠️ No FCM token obtained.');
      console.warn('[Auth] 💡 If permission is "denied", click the 🔒 lock icon');
      console.warn('[Auth]    in the address bar → Site settings → Notifications → Allow');
      console.log('[Auth] 🔔 ===== FCM REGISTRATION SKIPPED =====\n');
      return;
    }

    console.log('[Auth] ✅ FCM token obtained:', fcmToken.substring(0, 30) + '...');

    // Step 2: Send token to backend to save in MongoDB
    console.log('[Auth] 📤 Registering FCM token with backend...');
    try {
      const result = await fcmApi.register(fcmToken, adminEmail);
      console.log('[Auth] ✅ FCM token registered with backend:', result);
    } catch (regErr: any) {
      console.error('[Auth] ⚠️ Backend FCM registration failed:', regErr?.message || regErr);
      // Non-critical — token is still in localStorage, will retry next login
    }

    console.log('[Auth] 🔔 ===== FCM REGISTRATION DONE =====\n');
  } catch (err: any) {
    // ABSOLUTELY NEVER block auth flow on FCM failure
    console.error('[Auth] ⚠️ FCM registration error (non-critical):', err?.message || err);
  }
}

/**
 * Extracts the access token from the login result and stores it
 * under 'admin_token' so dispatchClient.ts can find it.
 */
function storeAccessToken(result: any): void {
  try {
    // Try every possible location the token might be in the login response
    const token =
      result?.tokens?.accessToken ||
      result?.tokens?.token ||
      result?.accessToken ||
      result?.token ||
      result?.data?.tokens?.accessToken ||
      result?.data?.accessToken ||
      null;

    if (token && typeof token === 'string' && token.length > 10) {
      localStorage.setItem('admin_token', token);
      console.log('[Auth] ✅ Access token stored as admin_token for dispatchClient');
    } else {
      console.warn('[Auth] ⚠️ Could not extract access token from login result');
      console.log('[Auth] Result keys:', Object.keys(result || {}));

      // Last resort: scan localStorage for any JWT-like token that api.ts might have stored
      const jwtKeys = ['token', 'accessToken', 'access_token', 'authToken', 'adminToken', 'jwt', 'auth_token'];
      for (const key of jwtKeys) {
        const val = localStorage.getItem(key);
        if (val && val.startsWith('eyJ') && val.length > 20) {
          localStorage.setItem('admin_token', val);
          console.log(`[Auth] ✅ Found JWT in localStorage key "${key}", copied to admin_token`);
          return;
        }
      }
    }
  } catch (err: any) {
    console.error('[Auth] ⚠️ storeAccessToken error:', err?.message);
  }
}

// ==================== PROVIDER ====================
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state + restore FCM
  useEffect(() => {
    console.log('🔄 AuthContext: Initializing...');

    const storedAdmin = authApi.getStoredAdmin();
    const isAuth = authApi.isAuthenticated();

    console.log('📦 Stored Admin:', storedAdmin?.email || 'none');
    console.log('🔐 Is Authenticated:', isAuth);

    if (storedAdmin && isAuth) {
      setAdmin(storedAdmin);

      // Also ensure admin_token exists for dispatchClient (session restore)
      const existingToken = localStorage.getItem('admin_token');
      if (!existingToken || existingToken === 'null' || existingToken === 'undefined') {
        // Scan for JWT in other keys
        const jwtKeys = ['token', 'accessToken', 'access_token', 'authToken', 'adminToken', 'jwt', 'auth_token'];
        for (const key of jwtKeys) {
          const val = localStorage.getItem(key);
          if (val && val.startsWith('eyJ') && val.length > 20) {
            localStorage.setItem('admin_token', val);
            console.log(`[Auth] ✅ Session restore: copied JWT from "${key}" to admin_token`);
            break;
          }
        }
      }

      // Register FCM for restored session (fire and forget — never blocks UI)
      registerFcmAfterAuth(storedAdmin.email);
    }

    setLoading(false);
  }, []);

  // Login function
  const login = useCallback(async (email: string, password: string): Promise<void> => {
    console.log('\n🔐 AuthContext: Login called');
    console.log('Email:', email);

    setError(null);
    setLoading(true);

    try {
      const result = await authApi.login(email, password);

      console.log('✅ AuthContext: Login successful');
      console.log('👤 Admin:', result.admin.email);

      setAdmin(result.admin);
      setError(null);

      // Store access token explicitly so dispatchClient.ts can find it
      storeAccessToken(result);

      // Register FCM after successful login (fire and forget — never blocks login)
      registerFcmAfterAuth(result.admin.email);

    } catch (err: any) {
      console.error('❌ AuthContext: Login failed:', err.message);

      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      setAdmin(null);

      throw err; // Re-throw so component can catch it
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(() => {
    console.log('🚪 AuthContext: Logout called');

    // Unregister FCM token from backend (fire and forget)
    const fcmToken = getCurrentFcmToken();
    if (fcmToken) {
      fcmApi.unregister(fcmToken).catch((err: any) => {
        console.warn('[Auth] ⚠️ FCM unregister failed (non-critical):', err?.message);
      });
    }

    // Clean up FCM from localStorage
    localStorage.removeItem('admin_fcm_token');
    localStorage.removeItem('admin_token');

    setAdmin(null);
    setError(null);
    authApi.logout();
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: AuthContextType = {
    admin,
    isAuthenticated: !!admin,
    loading,
    error,
    login,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ==================== HOOK ====================
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};

export default AuthContext;