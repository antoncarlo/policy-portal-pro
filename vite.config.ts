import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Identificativo univoco della build: viene incorporato nel bundle e scritto in
// /version.json, cosi' le schede aperte possono accorgersi di un nuovo deploy
// e proporre il ricaricamento (vedi src/components/UpdateNotifier.tsx).
const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const versionFilePlugin = (): Plugin => ({
  name: "policy-portal-version-file",
  apply: "build",
  generateBundle() {
    this.emitFile({
      type: "asset",
      fileName: "version.json",
      source: JSON.stringify({ buildId, builtAt: new Date().toISOString() }),
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [react(), versionFilePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
