import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Log API base URL in development mode
if (import.meta.env.DEV) {
  const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3002/api';
  console.log(`API URL: ${apiUrl}`);
  console.log(`Mode: ${import.meta.env.MODE}`);
}

// Initialize the app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
); 