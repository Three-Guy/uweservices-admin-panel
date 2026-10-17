import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../lib/api';

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

// ==================== PROVIDER ====================
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize auth state
  useEffect(() => {
    console.log('🔄 AuthContext: Initializing...');
    
    const storedAdmin = authApi.getStoredAdmin();
    const isAuth = authApi.isAuthenticated();
    
    console.log('📦 Stored Admin:', storedAdmin?.email || 'none');
    console.log('🔐 Is Authenticated:', isAuth);
    
    if (storedAdmin && isAuth) {
      setAdmin(storedAdmin);
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