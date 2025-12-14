import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Polyfills for otplib (needed for crypto operations)
// MUST be imported before any code that uses otplib
import { Buffer } from 'buffer';
import process from 'process';

// Make Buffer and process available globally
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
  (window as any).global = window;
  (window as any).process = process;
}
if (typeof global !== 'undefined') {
  (global as any).Buffer = Buffer;
  (global as any).process = process;
}

// Error boundary for debugging
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Check if environment variables are loaded
console.log('Environment check:', {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ? '✓ Set' : '✗ Missing',
  supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing',
  accessCode: import.meta.env.VITE_PROPERTY_ENTRY_ACCESS_CODE ? '✓ Set' : '✗ Missing',
});

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

try {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} catch (error) {
  console.error('Failed to render app:', error);
  root.innerHTML = `
    <div style="padding: 20px; font-family: system-ui;">
      <h1>Failed to Load App</h1>
      <p>Error: ${error instanceof Error ? error.message : 'Unknown error'}</p>
      <p style="font-size: 12px; color: #666; margin-top: 20px;">
        Check the browser console (F12) for more details
      </p>
    </div>
  `;
}

