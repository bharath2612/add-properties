import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

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

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

