import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const WARNING_TIME_SECONDS = 60; // Show warning 1 minute before expiry

const SessionWarningModal: React.FC = () => {
  const { getRemainingTime, extendSession, logout, isAuthenticated } = useAuth();
  const [remainingSeconds, setRemainingSeconds] = useState(300);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowWarning(false);
      return;
    }

    const interval = setInterval(() => {
      const remaining = getRemainingTime();
      setRemainingSeconds(remaining);
      
      if (remaining <= WARNING_TIME_SECONDS && remaining > 0) {
        setShowWarning(true);
      } else if (remaining <= 0) {
        setShowWarning(false);
        logout();
      } else {
        setShowWarning(false);
      }
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [isAuthenticated, getRemainingTime, logout]);

  const handleStayLoggedIn = () => {
    extendSession();
    setShowWarning(false);
  };

  const handleLogout = () => {
    logout();
    setShowWarning(false);
  };

  if (!showWarning) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-black dark:text-white">Session Expiring Soon</h3>
            <p className="text-sm text-gray-600 dark:text-zinc-400">Your session will expire due to inactivity</p>
          </div>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-700 dark:text-zinc-300 mb-2">
            Your session will expire in:
          </p>
          <div className="text-3xl font-mono font-bold text-black dark:text-white">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-500 mt-2">
            Click "Stay Logged In" to extend your session, or you will be automatically logged out.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleStayLoggedIn}
            className="flex-1 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors font-medium"
          >
            Stay Logged In
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-200 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors font-medium"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionWarningModal;

