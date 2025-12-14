import React, { useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { verifyTOTP } from '../../utils/auth2fa';
import { useTheme } from '../../contexts/ThemeContext';
import SessionWarningModal from './SessionWarningModal';

const DashboardAuth: React.FC = () => {
  const { isAuthenticated, login, checkAuth } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Check auth periodically
  React.useEffect(() => {
    if (isAuthenticated) {
      const interval = setInterval(() => {
        checkAuth();
      }, 10000); // Check every 10 seconds
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, checkAuth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Get the TOTP secret (from database or localStorage)
      const { getTOTPSecret } = await import('../../utils/auth2fa');
      const secret = await getTOTPSecret();
      if (!secret) {
        setError('2FA is not set up. Please go to /2fa-setup to set it up first.');
        setLoading(false);
        return;
      }

      // Trim and validate OTP
      const trimmedOtp = otp.trim();
      if (trimmedOtp.length !== 6) {
        setError('OTP must be exactly 6 digits');
        setLoading(false);
        return;
      }
      
      const isValid = await verifyTOTP(trimmedOtp, secret);
      
      if (isValid) {
        login();
        setOtp('');
      } else {
        setError('Invalid OTP code. Please make sure: 1) Your device time is synchronized, 2) You\'re entering the current code from your authenticator app, 3) The code hasn\'t expired (codes refresh every 30 seconds).');
      }
    } catch (err: any) {
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated) {
    return (
      <>
        <SessionWarningModal />
        <Outlet />
      </>
    );
  }

  // Show login form if not authenticated

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4">
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-zinc-900 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <svg className="w-5 h-5 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </div>

      <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-900 rounded-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gray-800 dark:bg-zinc-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white dark:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-black dark:text-white mb-2">Dashboard Access</h1>
          <p className="text-gray-600 dark:text-zinc-400 text-sm">Enter your 6-digit OTP code from authenticator app</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="otp-code" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              One-Time Password (OTP)
            </label>
            <input
              id="otp-code"
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                setOtp(value);
                setError('');
              }}
              onKeyDown={(e) => {
                // Allow: backspace, delete, tab, escape, enter, and numbers
                if ([46, 8, 9, 27, 13].indexOf(e.keyCode) !== -1 ||
                    // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                    (e.keyCode === 65 && e.ctrlKey === true) ||
                    (e.keyCode === 67 && e.ctrlKey === true) ||
                    (e.keyCode === 86 && e.ctrlKey === true) ||
                    (e.keyCode === 88 && e.ctrlKey === true) ||
                    // Allow: home, end, left, right
                    (e.keyCode >= 35 && e.keyCode <= 39)) {
                  return;
                }
                // Ensure that it is a number and stop the keypress
                if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                  e.preventDefault();
                }
              }}
              className="w-full px-4 py-3 bg-white dark:bg-black border border-gray-300 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-gray-400 dark:focus:ring-zinc-600 focus:border-gray-400 dark:focus:border-zinc-600 outline-none transition-all text-black dark:text-white text-center text-2xl font-mono tracking-widest"
              placeholder="000000"
              autoFocus
              disabled={loading}
              autoComplete="one-time-code"
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : otp.length === 6 ? 'Access Dashboard' : `Enter ${6 - otp.length} more digit${6 - otp.length > 1 ? 's' : ''}`}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500 dark:text-zinc-500 space-y-2">
          <p>🔒 Two-Factor Authentication Required</p>
          <p>Get the code from your authenticator app (Google Authenticator, Authy, etc.)</p>
          <Link 
            to="/2fa-setup" 
            className="inline-block mt-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
          >
            Need to set up 2FA? Click here
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DashboardAuth;

