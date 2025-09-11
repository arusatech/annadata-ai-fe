import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Disable Capacitor native bridge logs
if (typeof window !== 'undefined') {
  // Override console methods to filter out Capacitor bridge logs
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.log = (...args) => {
    const message = args.join(' ');
    // Filter out Capacitor native bridge logs
    if (!message.includes('native Filesystem.') && 
        !message.includes('result Filesystem.') &&
        !message.includes('native Http.') &&
        !message.includes('result Http.') &&
        !message.includes('native Preferences.') &&
        !message.includes('result Preferences.')) {
      originalLog.apply(console, args);
    }
  };
  
  console.warn = (...args) => {
    const message = args.join(' ');
    if (!message.includes('native Filesystem.') && 
        !message.includes('result Filesystem.') &&
        !message.includes('native Http.') &&
        !message.includes('result Http.') &&
        !message.includes('native Preferences.') &&
        !message.includes('result Preferences.')) {
      originalWarn.apply(console, args);
    }
  };
  
  console.error = (...args) => {
    const message = args.join(' ');
    if (!message.includes('native Filesystem.') && 
        !message.includes('result Filesystem.') &&
        !message.includes('native Http.') &&
        !message.includes('result Http.') &&
        !message.includes('native Preferences.') &&
        !message.includes('result Preferences.')) {
      originalError.apply(console, args);
    }
  };
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);