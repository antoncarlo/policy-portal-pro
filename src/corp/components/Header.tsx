// Barra del sito: logo, sezioni della homepage, portale delle VIES, area clienti, richiesta di preventivo, lingua.
// Su telefono le voci stanno in un pannello aperto dal pulsante (src/site/client/menu.ts).
import { ArrowRight, LogIn } from "lucide-react";
import { COMPANY, CORP, PORTAL_LOGIN_URL, PORTAL_URL } from "../config";
import { sectionHref } from "../links";
import { pathOf } from "../routes";
import { glassClass } from "./GlassCard";
import type { PageProps } from "./Layout";

export const Header = ({ page, content }: PageProps) => (
  <header className="site-header" data-site-header>
    <div className={glassClass("dark", "site-header__bar")}>
      <a className="site-header__logo" href={pathOf("home", page.lang)} aria-label={content.nav.home}>
        <img src="/brand/tecno-mga-logo-chiaro.svg" alt={COMPANY.name} width={1030} height={376} decoding="async" />
      </a>
      <nav id="site-menu" className="site-nav" aria-label={content.nav.site}>
        <ul className="site-nav__list">
          {content.nav.items.map((item) => (
            <li key={item.anchor}>
              <a href={sectionHref(page, item.anchor)}>{item.label}</a>
            </li>
          ))}
          <li>
            <a href={PORTAL_URL}>{content.nav.portal}</a>
          </li>
        </ul>
        <div className="site-nav__cta">
          <a className="btn btn--ghost" href={PORTAL_LOGIN_URL}>
            <LogIn size={16} strokeWidth={1.8} aria-hidden="true" />
            {content.nav.clientArea}
          </a>
          <a className="btn btn--bronze" href={sectionHref(page, "preventivo")}>
            {content.nav.cta}
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </div>
      </nav>
      <ul className="lang-switch" aria-label={content.nav.language}>
        {CORP.langs.map((lang) => (
          <li key={lang}>
            <a href={pathOf(page.id, lang)} lang={CORP.hreflang[lang]} hrefLang={CORP.hreflang[lang]} title={CORP.langNames[lang]} aria-current={lang === page.lang ? "page" : undefined}>
              {CORP.langShort[lang]}
            </a>
          </li>
        ))}
      </ul>
      <button type="button" className="menu-toggle" aria-expanded="false" aria-controls="site-menu" aria-label={content.nav.menuToggle}>
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
    </div>
  </header>
);
