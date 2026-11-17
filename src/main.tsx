import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { installGlobalErrorHandlers } from "./lib/errorReporting.ts";
import { initAnalytics } from "./site-kit/client/analytics";
import "./index.css";

installGlobalErrorHandlers();
// Statistiche delle pagine dell'area riservata, senza cookie: gli indirizzi partono senza identificativi di
// pratiche e clienti e senza i token dei link di accesso (src/site-kit/analytics.ts).
initAnalytics();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
