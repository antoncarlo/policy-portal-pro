// Contatti: il modulo in vetro e i recapiti. Il modulo si invia dal browser (src/site/client/contact.ts); senza
// JavaScript resta l'indirizzo email, scritto in chiaro.
import { ArrowRight, Building2, Lock, Mail, MapPin, Phone } from "lucide-react";
import { COMPANY } from "../config";
import { CONTACT_ROLES } from "../content/types";
import { pathOf } from "../routes";
import { SectionHead, type PageProps } from "./Layout";

const seat = (address: { street: string; postalCode: string; city: string; region: string }) => `${address.street} - ${address.postalCode} ${address.city} (${address.region})`;

export const Contact = ({ page, content }: PageProps) => {
  const { form, details } = content.contact;
  const [beforeLink, afterLink] = form.consent.split("{privacy}");
  const optional = <span className="field__optional">({form.optional})</span>;
  return (
    <section className="section section--dark" id="contatti">
      <div className="section__glow section__glow--a" aria-hidden="true" />
      <div className="section__glow section__glow--b" aria-hidden="true" />
      <div className="container">
        <SectionHead eyebrow={content.contact.eyebrow} title={content.contact.title} intro={content.contact.intro} light />
        <div className="contact">
          <form className="contact-form glass-dark" method="post" action="/api/contact" noValidate data-contact-form data-lang={page.lang} data-reveal>
            <div className="field">
              <label htmlFor="contact-name">{form.name}</label>
              <input id="contact-name" name="name" type="text" autoComplete="name" maxLength={120} required />
            </div>
            <div className="field">
              <label htmlFor="contact-company">{form.company}</label>
              <input id="contact-company" name="company" type="text" autoComplete="organization" maxLength={120} required />
            </div>
            <div className="field">
              <label htmlFor="contact-role">{form.role}</label>
              <select id="contact-role" name="role" defaultValue="" required>
                <option value="" disabled>
                  {form.rolePlaceholder}
                </option>
                {CONTACT_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {form.roles[role]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="contact-country">{form.country}</label>
              <input id="contact-country" name="country" type="text" autoComplete="country-name" maxLength={80} required />
            </div>
            <div className="field">
              <label htmlFor="contact-email">{form.email}</label>
              <input id="contact-email" name="email" type="email" autoComplete="email" inputMode="email" maxLength={200} required />
            </div>
            <div className="field">
              <label htmlFor="contact-phone">
                {form.phone} {optional}
              </label>
              <input id="contact-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} />
            </div>
            <div className="field field--wide">
              <label htmlFor="contact-volume">
                {form.volume} {optional}
              </label>
              <input id="contact-volume" name="volume" type="text" maxLength={40} placeholder={form.volumeHint} />
            </div>
            <div className="field field--wide">
              <label htmlFor="contact-message">{form.message}</label>
              <textarea id="contact-message" name="message" rows={5} minLength={10} maxLength={4000} required />
            </div>
            {/* Campo trappola: le persone non lo vedono, i programmi che compilano tutto si'. */}
            <div className="field--trap" aria-hidden="true">
              <label htmlFor="contact-website">Website</label>
              <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="field field--wide field--check">
              <input id="contact-consent" name="consent" type="checkbox" value="yes" required />
              <label htmlFor="contact-consent">
                {beforeLink}
                <a href={pathOf("privacy", page.lang)}>{form.privacyLink}</a>
                {afterLink}
              </label>
            </div>
            <div className="contact-form__foot field--wide">
              <button type="submit" className="btn btn--bronze btn--lg" data-label={form.submit} data-sending={form.sending}>
                <span data-submit-label>{form.submit}</span>
                <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
              </button>
              <p className="form-status" role="status" aria-live="polite" data-form-status data-success={form.success} data-error={form.error} data-invalid={form.invalid} />
            </div>
            <noscript>
              <p className="form-noscript field--wide">{form.noscript}</p>
            </noscript>
          </form>

          <address className="details" data-reveal>
            <h3 className="details__title">{details.title}</h3>
            <ul className="details__list">
              <li>
                <span className="icon-badge icon-badge--bronze">
                  <Mail size={18} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <div>
                  <span className="details__label">{details.email}</span>
                  <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
                </div>
              </li>
              <li>
                <span className="icon-badge icon-badge--bronze">
                  <Phone size={18} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <div>
                  <span className="details__label">{details.phone}</span>
                  <a href={`tel:${COMPANY.phoneE164}`}>{COMPANY.phone}</a>
                </div>
              </li>
              <li>
                <span className="icon-badge icon-badge--bronze">
                  <Lock size={18} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <div>
                  <span className="details__label">{details.pec}</span>
                  <a href={`mailto:${COMPANY.pec}`}>{COMPANY.pec}</a>
                </div>
              </li>
              <li>
                <span className="icon-badge icon-badge--bronze">
                  <Building2 size={18} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <div>
                  <span className="details__label">{details.legalSeat}</span>
                  <span>{seat(COMPANY.legalSeat)}</span>
                </div>
              </li>
              <li>
                <span className="icon-badge icon-badge--bronze">
                  <MapPin size={18} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <div>
                  <span className="details__label">{details.office}</span>
                  <span>{seat(COMPANY.office)}</span>
                </div>
              </li>
            </ul>
          </address>
        </div>
      </div>
    </section>
  );
};
