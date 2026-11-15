// Il banner dei cookie: «Accetta», «Rifiuta» e «Personalizza» con lo stesso peso; la chiusura vale rifiuto.
// E' nella pagina solo se sono impostati gli identificativi di Google, e resta nascosto finche'
// src/site/client/consent.ts non vede che manca una scelta. Mostra solo le categorie che hanno un identificativo.
import { X } from "lucide-react";
import { pathOf } from "../routes";
import type { PageProps } from "./Layout";

export interface MeasurementTools {
  statistics: boolean;
  marketing: boolean;
}

export const CookieBanner = ({ page, content, tools }: PageProps & { tools: MeasurementTools }) => {
  const banner = content.cookieBanner;
  const option = (name: "statistics" | "marketing") => (
    <label className="cookie-option">
      <input type="checkbox" name={name} />
      <span>
        <strong>{banner.categories[name].title}</strong>
        <span>{banner.categories[name].text}</span>
      </span>
    </label>
  );
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
      <form className="cookie-banner__options" id="cookie-options" data-consent-options hidden>
        <label className="cookie-option">
          <input type="checkbox" checked disabled readOnly />
          <span>
            <strong>
              {banner.categories.necessary.title} · {banner.alwaysOn}
            </strong>
            <span>{banner.categories.necessary.text}</span>
          </span>
        </label>
        {tools.statistics ? option("statistics") : null}
        {tools.marketing ? option("marketing") : null}
      </form>
      <div className="cookie-banner__actions">
        <button type="button" className="btn btn--ghost" data-consent="accept">
          {banner.accept}
        </button>
        <button type="button" className="btn btn--ghost" data-consent="reject">
          {banner.reject}
        </button>
        <button type="button" className="btn btn--ghost" data-consent="customise" aria-expanded="false" aria-controls="cookie-options">
          {banner.customise}
        </button>
        <button type="button" className="btn btn--primary" data-consent="save" hidden>
          {banner.save}
        </button>
      </div>
    </div>
  );
};
