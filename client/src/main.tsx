import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global error handler for unhandled promise rejections (especially WebSocket errors in dev)
window.addEventListener('unhandledrejection', (event) => {
  // Check if it's a WebSocket-related error that we can safely ignore
  if (event.reason?.message?.includes('WebSocket') || 
      event.reason?.message?.includes('wss://') ||
      event.reason?.name === 'SyntaxError' && event.reason?.message?.includes('localhost:undefined')) {
    console.warn('Development WebSocket error (safe to ignore):', event.reason.message);
    event.preventDefault(); // Prevent the error from showing in console
    return;
  }
  
  // Log other unhandled rejections for debugging
  console.error('Unhandled promise rejection:', event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
