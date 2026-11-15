// Il banner dei cookie: un solo consenso per tutti i cookie non tecnici, con «Accetta» e «Rifiuta» dello stesso
// peso; la chiusura vale rifiuto. E' nella pagina solo se sono impostati gli identificativi di Google, e resta
// nascosto finche' src/site/client/consent.ts non vede che manca una scelta.
import { X } from "lucide-react";
import { pathOf } from "../routes";
import type { PageProps } from "./Layout";

export interface MeasurementTools {
  statistics: boolean;
  marketing: boolean;
}

export const CookieBanner = ({ page, content }: PageProps) => {
  const banner = content.cookieBanner;
  return (
    <div className="cookie-banner glass-strong" data-cookie-banner role="region" aria-labelledby="cookie-banner-title" hidden>
      <button type="button" className="cookie-banner__close" data-consent="close" aria-label={banner.close}>
        <X size={18} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <p className="cookie-banner__title" id="cookie-banner-title">
        {banner.title}
      </p>
      <p className="cookie-banner__text">
        {banner.text} <a href={pathOf("cookie", page.lang)}>{banner.policyLink}</a>
      </p>
      <div className="cookie-banner__actions">
        <button type="button" className="btn btn--ghost" data-consent="accept">
          {banner.accept}
        </button>
        <button type="button" className="btn btn--ghost" data-consent="reject">
          {banner.reject}
        </button>
      </div>
    </div>
  );
};
