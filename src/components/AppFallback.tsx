import React from 'react';

// Simple fallback component that should always render
export const AppFallback: React.FC = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h1>App is Loading...</h1>
      <p>If this message persists, check the browser console for errors.</p>
      <p style={{ fontSize: '12px', color: '#666', marginTop: '20px' }}>
        Open DevTools (F12) → Console tab to see error messages
      </p>
    </div>
  );
};

