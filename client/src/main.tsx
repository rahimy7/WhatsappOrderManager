import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

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
    errorStack.includes('@vite/client') ||
    errorStack.includes('setupWebSocket') ||
    errorStack.includes('fallback') ||
    errorStack.includes('eruda') ||
    (errorName === 'SyntaxError' && errorMessage.includes('construct')) ||
    (errorName === 'DOMException' && errorMessage.includes('WebSocket'));
  
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
    event.filename?.includes('@vite/client') ||
    event.filename?.includes('eruda');
    
  if (isDevelopmentError) {
    event.preventDefault();
    return;
  }
});

createRoot(document.getElementById("root")!).render(<App />);
