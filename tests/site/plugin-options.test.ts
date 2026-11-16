// Il plugin che genera le pagine pubbliche serve due siti: quello del portale (con il guscio dell'area riservata)
// e quello aziendale (solo pagine statiche). La generalizzazione non deve cambiare cio' che fa per il portale.
import { describe, expect, it } from "vitest";
import { publicSitePlugin, staticSitePlugin } from "../../vite/public-site-plugin";

type ConfigHook = () => { build: { manifest: boolean; rollupOptions: { input: Record<string, string> } } };
const inputs = (plugin: { config?: unknown }) => (plugin.config as ConfigHook)().build.rollupOptions.input;

describe("plugin delle pagine pubbliche", () => {
  it("per il portale tiene il guscio dell'area riservata e l'ingresso del sito VIES", () => {
    const plugin = publicSitePlugin();
    expect(plugin.name).toBe("policy-portal-public-site");
    expect(inputs(plugin)).toEqual({ main: "index.html", site: "src/site/client/main.ts" });
  });

  it("per un sito solo statico non dichiara il guscio", () => {
    const plugin = staticSitePlugin({
      name: "tecnomga-corporate-site",
      renderModule: "/src/corp/render.tsx",
      configModule: "/src/corp/config.ts",
      envReader: "readCorpEnv",
      envPrefix: "VITE_CORP_",
      clientEntry: "src/corp/client/main.ts",
      shell: "none",
    });
    expect(plugin.name).toBe("tecnomga-corporate-site");
    expect(inputs(plugin)).toEqual({ site: "src/corp/client/main.ts" });
  });
});
