import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import React from "react";


// Override WebSocket to prevent invalid URL construction in development
if (import.meta.env.DEV && typeof window !== 'undefined') {
  const OriginalWebSocket = window.WebSocket;
  window.WebSocket = class extends OriginalWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      // Fix invalid WebSocket URLs in development
      if (typeof url === 'string' && url.includes('localhost:undefined')) {
        const correctedUrl = url.replace('localhost:undefined', `${window.location.hostname}:${window.location.port}`);
        super(correctedUrl, protocols);
        return;
      }
      if (typeof url === 'string' && url.includes('wss://localhost:undefined')) {
        // Skip WebSocket creation for invalid URLs
        throw new Error('Skipping invalid WebSocket URL');
      }
      super(url, protocols);
    }
  };
}

// Comprehensive error handler for development environment issues
window.addEventListener('unhandledrejection', (event) => {
  const errorMessage = event.reason?.message || '';
  const errorStack = event.reason?.stack || '';
  const errorName = event.reason?.name || '';
  
  // Check if it's a development-related error that we can safely ignore
  const isDevelopmentError = 
    errorMessage.includes('WebSocket') || 
    errorMessage.includes('wss://') ||
    errorMessage.includes('localhost:undefined') ||
    errorMessage.includes('The URL') && errorMessage.includes('is invalid') ||
    errorMessage.includes('Skipping invalid WebSocket URL') ||
    errorStack.includes('@vite/client') ||
    errorStack.includes('setupWebSocket') ||
    errorStack.includes('fallback') ||
    errorStack.includes('eruda') ||
    (errorName === 'SyntaxError' && errorMessage.includes('construct')) ||
    (errorName === 'DOMException' && errorMessage.includes('WebSocket')) ||
    (errorName === 'Error' && errorMessage.includes('Skipping invalid'));
  
  if (isDevelopmentError) {
    // Completely suppress development-related errors
    event.preventDefault();
    return;
  }
  
  // Only log genuine application errors
  console.error('Application error:', event.reason);
});

// Global error handler for regular errors
window.addEventListener('error', (event) => {
  const isDevelopmentError = 
    event.message?.includes('WebSocket') || 
    event.message?.includes('localhost:undefined') ||
    event.message?.includes('wss://') ||
    event.message?.includes('Skipping invalid') ||
    event.filename?.includes('@vite/client') ||
    event.filename?.includes('eruda');
    
  if (isDevelopmentError) {
    event.preventDefault();
    return;
  }
});

createRoot(document.getElementById("root")!).render(<App />);
