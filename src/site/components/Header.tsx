// La barra in vetro: logo, sezioni, lingue, accesso all'area riservata. Sul telefono le voci stanno in un pannello
// aperto dal pulsante (src/site/client/menu.ts).
import { ArrowRight, LogIn } from "lucide-react";
import { COMPANY, HREFLANG, LANGS, LANG_NAMES, LANG_SHORT, PORTAL_LOGIN_PATH } from "../config";
import { sectionHref } from "../links";
import { pageKind, pathOf } from "../routes";
import type { PageProps } from "./Layout";

export const Header = ({ page, content }: PageProps) => {
  const kind = pageKind(page.id);
  return (
  <header className="site-header" data-site-header>
    <div className="site-header__bar glass-strong">
      <a className="site-header__logo" href={pathOf("home", page.lang)} aria-label={content.nav.home}>
        <img src="/logo.svg" alt={COMPANY.name} width={1030} height={376} decoding="async" />
      </a>
      <nav id="site-menu" className="site-nav" data-testid="site-nav" aria-label={content.footer.site}>
        <ul className="site-nav__list">
          {content.nav.items.map((item) => (
            <li key={item.anchor} className={`site-nav__item site-nav__item--${item.anchor}`}>
              <a href={sectionHref(page, item.anchor)}>{item.label}</a>
            </li>
          ))}
          <li className="site-nav__item site-nav__item--guide">
            <a href={pathOf("blog", page.lang)} aria-current={kind === "blog" || kind === "article" ? "page" : undefined}>
              {content.nav.guides}
            </a>
          </li>
        </ul>
        <div className="site-nav__cta">
          <a className="btn btn--ghost" href={PORTAL_LOGIN_PATH} data-testid="site-portal-link">
            <LogIn size={16} strokeWidth={1.8} aria-hidden="true" />
            {content.nav.portal}
          </a>
          <a className="btn btn--primary" href={sectionHref(page, "contatti")}>
            {content.nav.contact}
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </div>
      </nav>
      <ul className="lang-switch" aria-label={content.nav.languages}>
        {LANGS.map((lang) => (
          <li key={lang}>
            <a href={pathOf(page.id, lang)} data-testid={`site-lang-${lang}`} lang={HREFLANG[lang]} hrefLang={HREFLANG[lang]} title={LANG_NAMES[lang]} aria-current={lang === page.lang ? "page" : undefined}>
              {LANG_SHORT[lang]}
            </a>
          </li>
        ))}
      </ul>
      <button type="button" className="menu-toggle" data-testid="site-menu-toggle" aria-expanded="false" aria-controls="site-menu" aria-label={content.nav.menu}>
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
    </div>
  </header>
  );
};
