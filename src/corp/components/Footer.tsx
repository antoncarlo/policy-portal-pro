// Pie' di pagina: chi e' l'intermediario (ragione sociale, RUI, P.IVA, sedi, recapiti), le pagine legali, la
// vigilanza, i reclami e l'avvertenza sulla pubblicita' dei prodotti assicurativi.
import { COMPANY, PORTAL_LOGIN_URL, PORTAL_URL, RUI_CHECK_URL } from "../config";
import { sectionHref } from "../links";
import { pathOf } from "../routes";
import type { PageProps } from "./Layout";

const seat = (address: { street: string; postalCode: string; city: string; region: string }) => `${address.street} - ${address.postalCode} ${address.city} (${address.region})`;

export const Footer = ({ page, content }: PageProps) => {
  const { footer } = content;
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand">
            <img className="footer__logo" src="/brand/tecno-mga-logo-chiaro.svg" alt={COMPANY.name} width={1030} height={376} loading="lazy" decoding="async" />
            <p>{footer.about}</p>
          </div>
          <nav className="footer__col" aria-label={footer.site}>
            <p className="footer__title">{footer.site}</p>
            <ul>
              {content.nav.items.map((item) => (
                <li key={item.anchor}>
                  <a href={sectionHref(page, item.anchor)}>{item.label}</a>
                </li>
              ))}
              <li>
                <a href={PORTAL_URL}>{content.nav.portal}</a>
              </li>
              <li>
                <a href={PORTAL_LOGIN_URL}>{content.nav.clientArea}</a>
              </li>
            </ul>
          </nav>
          <div className="footer__col">
            <p className="footer__title">{footer.legal}</p>
            <ul>
              <li>
                <a href={pathOf("privacy", page.lang)}>{footer.privacy}</a>
              </li>
              <li>
                <a href={pathOf("cookie", page.lang)}>{footer.cookie}</a>
              </li>
              <li hidden data-cookie-preferences-item>
                <button type="button" className="footer__button" data-cookie-preferences>
                  {footer.cookiePreferences}
                </button>
              </li>
              <li>
                <a href={RUI_CHECK_URL} target="_blank" rel="noopener noreferrer">
                  {footer.ruiCheck}
                </a>
              </li>
            </ul>
          </div>
          <address className="footer__col">
            <p className="footer__title">{footer.contacts}</p>
            <ul>
              <li>
                <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
              </li>
              <li>
                <a href={`tel:${COMPANY.phoneE164}`}>{COMPANY.phone}</a>
              </li>
              <li>
                {footer.pec}: <a href={`mailto:${COMPANY.pec}`}>{COMPANY.pec}</a>
              </li>
              <li>
                {footer.legalSeat}: {seat(COMPANY.legalSeat)}
              </li>
              <li>
                {footer.office}: {seat(COMPANY.office)}
              </li>
            </ul>
          </address>
        </div>
        <div className="footer__legal">
          <p>
            <strong>{COMPANY.name}</strong> · {footer.rui} {COMPANY.rui} · {footer.vat} {COMPANY.vat}. {footer.supervision}
          </p>
          <p>
            <strong>{footer.complaintsTitle}.</strong> {footer.complaints}
          </p>
          <p className="footer__notice">{content.legalNotice}</p>
          <p>
            © {new Date().getUTCFullYear()} {COMPANY.name}. {footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
};
