import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: () => boolean;
  logout: () => void;
  checkAuth: () => boolean;
  extendSession: () => void;
  getRemainingTime: () => number; // Returns seconds remaining
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'dashboard_auth_session';
const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);

  // Logout function (defined early for use in useEffect)
  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setIsAuthenticated(false);
    setSessionExpiry(null);
  }, []);

  // Initialize auth state from session storage
  useEffect(() => {
    const sessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionData) {
      try {
        const { expiry } = JSON.parse(sessionData);
        const now = Date.now();
        if (expiry > now) {
          setIsAuthenticated(true);
          setSessionExpiry(expiry);
        } else {
          // Session expired
          logout();
        }
      } catch (error) {
        console.error('Error parsing session data:', error);
        logout();
      }
    }
  }, [logout]);

  // Save session to storage
  const saveSession = useCallback((expiry: number) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ expiry }));
    setSessionExpiry(expiry);
  }, []);

  // Login function
  const login = useCallback((): boolean => {
    // Token is already verified in DashboardAuth component
    const expiry = Date.now() + SESSION_TIMEOUT_MS;
    saveSession(expiry);
    setIsAuthenticated(true);
    return true;
  }, [saveSession]);

  // Extend session on activity
  const extendSession = useCallback(() => {
    if (isAuthenticated) {
      const newExpiry = Date.now() + SESSION_TIMEOUT_MS;
      saveSession(newExpiry);
    }
  }, [isAuthenticated, saveSession]);

  // Check if still authenticated
  const checkAuth = useCallback((): boolean => {
    if (!isAuthenticated || !sessionExpiry) {
      return false;
    }
    
    const now = Date.now();
    if (now >= sessionExpiry) {
      logout();
      return false;
    }
    
    return true;
  }, [isAuthenticated, sessionExpiry, logout]);

  // Get remaining time in seconds
  const getRemainingTime = useCallback((): number => {
    if (!sessionExpiry) return 0;
    const remaining = Math.max(0, Math.floor((sessionExpiry - Date.now()) / 1000));
    return remaining;
  }, [sessionExpiry]);

  // Activity tracking - extend session on user interaction
  useEffect(() => {
    if (!isAuthenticated) return;

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      extendSession();
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isAuthenticated, extendSession]);

  // Session expiry check - run every 10 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      if (!checkAuth()) {
        // Session expired, logout will be called by checkAuth
        console.log('Session expired');
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        login,
        logout,
        checkAuth,
        extendSession,
        getRemainingTime,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

