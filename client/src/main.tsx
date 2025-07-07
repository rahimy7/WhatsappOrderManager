import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handler for unhandled promise rejections (especially WebSocket errors in dev)
window.addEventListener('unhandledrejection', (event) => {
  // Check if it's a development WebSocket-related error that we can safely ignore
  const errorMessage = event.reason?.message || '';
  const errorStack = event.reason?.stack || '';
  
  if (errorMessage.includes('WebSocket') || 
      errorMessage.includes('wss://') ||
      errorMessage.includes('localhost:undefined') ||
      errorStack.includes('@vite/client') ||
      errorStack.includes('setupWebSocket') ||
      (event.reason?.name === 'SyntaxError' && errorMessage.includes('invalid'))) {
    // Silently handle development WebSocket errors
    event.preventDefault();
    return;
  }
  
  // Log other unhandled rejections for debugging
  console.error('Unhandled promise rejection:', event.reason);
});

// Global error handler for regular errors
window.addEventListener('error', (event) => {
  // Ignore WebSocket and Vite development errors
  if (event.message?.includes('WebSocket') || 
      event.message?.includes('localhost:undefined') ||
      event.filename?.includes('@vite/client')) {
    event.preventDefault();
    return;
  }
});

createRoot(document.getElementById("root")!).render(<App />);
