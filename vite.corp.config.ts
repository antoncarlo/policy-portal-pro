// Build del sito aziendale tecnomga.com: solo pagine statiche, generate dai moduli di src/corp.
// Uscita in sites/tecnomga/dist, che e' la cartella pubblicata dal progetto Vercel del sito aziendale.
import path from "path";
import { defineConfig } from "vite";
import { staticSitePlugin } from "./vite/public-site-plugin";

export default defineConfig(() => ({
  // Nessuna pagina di ripiego: un percorso che non e' del sito risponde «non trovato», non con il guscio del portale.
  appType: "custom" as const,
  publicDir: "sites/tecnomga/public",
  server: { host: "::", port: 5301 },
  build: { outDir: "sites/tecnomga/dist", emptyOutDir: true },
  // Vercel Web Analytics solo nelle build fatte su Vercel: in locale e nelle prove lo script non esiste.
  define: { __VERCEL_ANALYTICS__: JSON.stringify(process.env.VERCEL === "1") },
  plugins: [
    staticSitePlugin({
      name: "tecnomga-corporate-site",
      renderModule: "/src/corp/render.tsx",
      configModule: "/src/corp/config.ts",
      envReader: "readCorpEnv",
      envPrefix: "VITE_CORP_",
      clientEntry: "src/corp/client/main.ts",
      shell: "none",
      fonts: { heading: "lora-latin-600-normal", body: "inter-latin-400-normal" },
    }),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
}));
