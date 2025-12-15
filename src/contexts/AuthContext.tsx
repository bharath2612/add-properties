import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: () => boolean;
  logout: () => void;
  checkAuth: () => boolean;
  updateActivity: () => void; // Update last activity time (replaces extendSession)
  getRemainingTime: () => number; // Returns seconds remaining until idle timeout
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'dashboard_auth_session';
const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes of inactivity

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState<number | null>(null);

  // Logout function (defined early for use in useEffect)
  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setIsAuthenticated(false);
    setLastActivityTime(null);
  }, []);

  // Initialize auth state from session storage
  useEffect(() => {
    const sessionData = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionData) {
      try {
        const { lastActivity } = JSON.parse(sessionData);
        const now = Date.now();
        const timeSinceActivity = now - lastActivity;
        
        if (timeSinceActivity < IDLE_TIMEOUT_MS) {
          // Still within idle timeout, restore session
          setIsAuthenticated(true);
          setLastActivityTime(lastActivity);
        } else {
          // Idle timeout exceeded
          logout();
        }
      } catch (error) {
        console.error('Error parsing session data:', error);
        logout();
      }
    }
  }, [logout]);

  // Save session to storage
  const saveSession = useCallback((activityTime: number) => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ lastActivity: activityTime }));
    setLastActivityTime(activityTime);
  }, []);

  // Login function
  const login = useCallback((): boolean => {
    // Token is already verified in DashboardAuth component
    const now = Date.now();
    saveSession(now);
    setIsAuthenticated(true);
    return true;
  }, [saveSession]);

  // Update last activity time on user interaction
  const updateActivity = useCallback(() => {
    if (isAuthenticated) {
      const now = Date.now();
      saveSession(now);
    }
  }, [isAuthenticated, saveSession]);

  // Check if still authenticated (not idle)
  const checkAuth = useCallback((): boolean => {
    if (!isAuthenticated || !lastActivityTime) {
      return false;
    }
    
    const now = Date.now();
    const timeSinceActivity = now - lastActivityTime;
    
    if (timeSinceActivity >= IDLE_TIMEOUT_MS) {
      // Idle timeout exceeded
      logout();
      return false;
    }
    
    return true;
  }, [isAuthenticated, lastActivityTime, logout]);

  // Get remaining time in seconds
  const getRemainingTime = useCallback((): number => {
    if (!lastActivityTime) return 0;
    const timeSinceActivity = Date.now() - lastActivityTime;
    const remaining = Math.max(0, Math.floor((IDLE_TIMEOUT_MS - timeSinceActivity) / 1000));
    return remaining;
  }, [lastActivityTime]);

  // Activity tracking - update last activity time on user interaction
  useEffect(() => {
    if (!isAuthenticated) return;

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'keydown', 'scroll', 'touchstart', 'click', 'focus'];
    
    const handleActivity = () => {
      updateActivity();
    };

    // Throttle activity updates to avoid excessive storage writes
    let activityTimeout: NodeJS.Timeout;
    const throttledActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(handleActivity, 1000); // Update at most once per second
    };

    activityEvents.forEach(event => {
      window.addEventListener(event, throttledActivity, { passive: true });
    });

    // Also track visibility changes (tab focus)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateActivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(activityTimeout);
      activityEvents.forEach(event => {
        window.removeEventListener(event, throttledActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, updateActivity]);

  // Idle timeout check - run every 5 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      if (!checkAuth()) {
        // Idle timeout exceeded, logout will be called by checkAuth
        console.log('User logged out due to inactivity');
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated, checkAuth]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        login,
        logout,
        checkAuth,
        updateActivity,
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

