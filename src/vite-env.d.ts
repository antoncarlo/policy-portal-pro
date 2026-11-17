/// <reference types="vite/client" />

/** Identificativo della build corrente (vedi vite.config.ts). */
declare const __BUILD_ID__: string;

/** Vero solo nelle build fatte su Vercel (VERCEL=1): accende Vercel Web Analytics (src/site-kit/client/analytics.ts). */
declare const __VERCEL_ANALYTICS__: boolean;

interface ImportMetaEnv {
  /** Indirizzo resiliente di Vercel Web Analytics, se Vercel lo fornisce alla build. */
  readonly VITE_VERCEL_OBSERVABILITY_BASEPATH?: string;
  readonly VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG?: string;
}
