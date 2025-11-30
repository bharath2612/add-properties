import React, { useState, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

const ACCESS_CODE = import.meta.env.VITE_PROPERTY_ENTRY_ACCESS_CODE || 'admin123';

interface DashboardAuthProps {
  children: React.ReactNode;
}

const DashboardAuth: React.FC<DashboardAuthProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    // Check if already authenticated in session
    const authStatus = sessionStorage.getItem('dashboard_auth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code === ACCESS_CODE) {
      setError('');
      setIsAuthenticated(true);
      sessionStorage.setItem('dashboard_auth', 'true');
    } else {
      setError('Invalid access code. Please try again.');
    }
  };

  if (isAuthenticated) {
    return <>{children}</>;
  }

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
          <p className="text-gray-600 dark:text-zinc-400 text-sm">Enter your access code to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="access-code" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
              Access Code
            </label>
            <input
              id="access-code"
              type="password"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError('');
              }}
              className="w-full px-4 py-3 bg-white dark:bg-black border border-gray-300 dark:border-zinc-800 rounded-lg focus:ring-2 focus:ring-gray-400 dark:focus:ring-zinc-600 focus:border-gray-400 dark:focus:border-zinc-600 outline-none transition-all text-black dark:text-white"
              placeholder="Enter your access code"
              autoFocus
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
            className="w-full bg-black dark:bg-white text-white dark:text-black py-3 rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors font-medium"
          >
            Access Dashboard
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500 dark:text-zinc-500">
          <p>🔒 Secure access required</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardAuth;

