// Pagine pubbliche generate come HTML completo: il sito VIES del portale e il sito aziendale usano lo stesso plugin
// con opzioni diverse (staticSitePlugin); publicSitePlugin e' la configurazione del portale.
//
// - In sviluppo un middleware rende la pagina a ogni richiesta (stesso HTML della build), cosi' anche i test nel
//   browser vedono il documento vero e non una pagina disegnata da JavaScript.
// - Nella build: il guscio del portale riservato (index.html) diventa app.html e ogni pagina pubblica viene scritta
//   in dist/<percorso>/index.html, con i fogli di stile e lo script dell'ingresso "site".
//
// Le pagine sono moduli del sito (src/site, src/corp): si caricano con il caricatore SSR di Vite, senza una seconda build.
import fs from "node:fs";
import path from "node:path";
import { createServer, loadEnv, type Plugin } from "vite";

export interface StaticSiteOptions {
  /** Nome del plugin di Vite. */
  name: string;
  /** Modulo che esporta renderPage, renderAll e renderExtraFiles. */
  renderModule: string;
  /** Modulo che esporta la funzione `envReader`. */
  configModule: string;
  /** Nome della funzione che legge le impostazioni del sito dalle variabili d'ambiente. */
  envReader: string;
  /** Prefisso delle variabili d'ambiente passate a `envReader`. */
  envPrefix: string;
  /** Ingresso JavaScript del sito nel browser. */
  clientEntry: string;
  /**
   * "rename-to-app": la build ha anche il guscio di un'applicazione (index.html), che diventa app.html per lasciare
   * la radice alla homepage pubblica. "none": il sito e' fatto solo di pagine statiche.
   */
  shell: "rename-to-app" | "none";
  /** Inizio del nome dei file dei caratteri della prima schermata, da chiedere subito al browser. */
  fonts?: { heading: string; body: string };
}

interface SiteAssets {
  css: string[];
  js: string;
  fonts?: { heading?: string; body?: string };
}
interface RenderModule {
  renderPage: (path: string, assets: SiteAssets, env: unknown) => string | null;
  renderAll: (assets: SiteAssets, env: unknown) => Array<{ path: string; html: string }>;
  renderExtraFiles?: (env: unknown) => Array<{ file: string; content: string }>;
}
type ConfigModule = Record<string, (env: Record<string, string | undefined>) => unknown>;
interface ManifestEntry {
  file: string;
  css?: string[];
}

export const staticSitePlugin = (options: StaticSiteOptions): Plugin => {
  const RENDER_MODULE = options.renderModule;
  const CONFIG_MODULE = options.configModule;
  const CLIENT_ENTRY = options.clientEntry;
  const readEnv = (module: ConfigModule, env: Record<string, string>) => {
    const reader = module[options.envReader];
    if (typeof reader !== "function") throw new Error(`${options.name}: ${options.configModule} non esporta ${options.envReader}`);
    return reader(env);
  };
  let root = process.cwd();
  let mode = "production";
  let outDir = path.resolve(root, "dist");

  return {
    name: options.name,
    config() {
      const input: Record<string, string> = options.shell === "rename-to-app" ? { main: "index.html", site: CLIENT_ENTRY } : { site: CLIENT_ENTRY };
      return { build: { manifest: true, rollupOptions: { input } } };
    },
    configResolved(config) {
      root = config.root;
      mode = config.mode;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        const url = (req.url ?? "/").split("?")[0];
        // File, moduli e API non sono pagine: si lasciano a Vite senza caricare i moduli del sito.
        if (/\.[a-z0-9]+$/i.test(url) && !/\.(xml|txt)$/i.test(url)) return next();
        if (url.startsWith("/api/") || url.startsWith("/@") || url.startsWith("/src/") || url.startsWith("/node_modules/")) return next();
        try {
          const render = (await server.ssrLoadModule(RENDER_MODULE)) as RenderModule;
          const env = readEnv((await server.ssrLoadModule(CONFIG_MODULE)) as ConfigModule, loadEnv(mode, root, options.envPrefix));
          const extra = render.renderExtraFiles?.(env).find((item) => `/${item.file}` === url);
          if (extra) {
            res.statusCode = 200;
            res.setHeader("Content-Type", extra.file.endsWith(".xml") ? "application/xml; charset=utf-8" : "text/plain; charset=utf-8");
            return res.end(extra.content);
          }
          const html = render.renderPage(url, { css: [], js: `/${CLIENT_ENTRY}` }, env);
          if (html === null) return next();
          res.statusCode = 200;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(await server.transformIndexHtml(url, html));
        } catch (error) {
          server.ssrFixStacktrace(error as Error);
          next(error);
        }
      });
    },
    async closeBundle() {
      if (this.meta.watchMode) return;
      const manifestPath = path.join(outDir, ".vite", "manifest.json");
      const shell = path.join(outDir, "index.html");
      // Una build non riuscita o una build senza l'ingresso del sito non ha nulla da scrivere.
      if (!fs.existsSync(manifestPath)) return;
      if (options.shell === "rename-to-app" && !fs.existsSync(shell)) return;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Record<string, ManifestEntry>;
      const entry = manifest[CLIENT_ENTRY];
      if (!entry) throw new Error(`${options.name}: l'ingresso ${CLIENT_ENTRY} manca dal manifest della build`);
      // I caratteri della prima schermata (titolo e testo), per chiederli al browser prima del foglio di stile.
      const built = fs.existsSync(path.join(outDir, "assets")) ? fs.readdirSync(path.join(outDir, "assets")) : [];
      const font = (name: string) => {
        const file = built.find((item) => item.startsWith(`${name}-`) && item.endsWith(".woff2"));
        return file ? `/assets/${file}` : undefined;
      };
      const assets = {
        css: (entry.css ?? []).map((file) => `/${file}`),
        js: `/${entry.file}`,
        fonts: options.fonts ? { heading: font(options.fonts.heading), body: font(options.fonts.body) } : undefined,
      };

      // Un caricatore a parte, senza i plugin del progetto: nella build React non ha il runtime di sviluppo (jsxDEV),
      // quindi il JSX delle pagine va compilato con il runtime di produzione.
      const server = await createServer({
        root,
        mode,
        configFile: false,
        logLevel: "error",
        appType: "custom",
        resolve: { alias: { "@": path.resolve(root, "src") } },
        esbuild: { jsx: "automatic", jsxDev: false },
        server: { middlewareMode: true, hmr: false, watch: null },
        optimizeDeps: { noDiscovery: true, include: [] },
      });
      try {
        const render = (await server.ssrLoadModule(RENDER_MODULE)) as RenderModule;
        const env = readEnv((await server.ssrLoadModule(CONFIG_MODULE)) as ConfigModule, loadEnv(mode, root, options.envPrefix));
        // Il guscio del portale riservato lascia la radice alla homepage pubblica.
        if (options.shell === "rename-to-app") fs.renameSync(shell, path.join(outDir, "app.html"));
        for (const page of render.renderAll(assets, env)) {
          const dir = path.join(outDir, page.path);
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, "index.html"), page.html);
        }
        for (const item of render.renderExtraFiles?.(env) ?? []) {
          const target = path.join(outDir, item.file);
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, item.content);
        }
        fs.rmSync(path.join(outDir, ".vite"), { recursive: true, force: true });
      } finally {
        await server.close();
      }
    },
  };
};

/** Il sito VIES del portale: pagine pubbliche accanto al guscio dell'area riservata. */
export const publicSitePlugin = (): Plugin =>
  staticSitePlugin({
    name: "policy-portal-public-site",
    renderModule: "/src/site/render.tsx",
    configModule: "/src/site/config.ts",
    envReader: "readSiteEnv",
    envPrefix: "VITE_",
    clientEntry: "src/site/client/main.ts",
    shell: "rename-to-app",
    fonts: { heading: "lora-latin-600-normal", body: "inter-latin-400-normal" },
  });
