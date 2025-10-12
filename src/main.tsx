
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./index.css";

  // Global error handler to suppress non-critical Firestore connection errors
  // These are typically caused by browser extensions blocking Firebase requests
  window.addEventListener('unhandledrejection', (event) => {
    const error = event.reason;
    // Suppress ERR_BLOCKED_BY_CLIENT errors from Firestore
    if (error?.message?.includes('ERR_BLOCKED_BY_CLIENT') || 
        error?.message?.includes('net::ERR_BLOCKED_BY_CLIENT')) {
      console.warn('⚠️ Firebase request blocked by browser extension - ignoring non-critical error');
      event.preventDefault(); // Prevent the error from being logged to console
    }
  });

  createRoot(document.getElementById("root")!).render(<App />);
  