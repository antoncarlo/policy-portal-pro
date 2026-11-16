// Il modulo di richiesta preventivo. Invia al portale (rotta /api/contact), che salva la richiesta e la inoltra
// alla casella aziendale. Senza lo script il pulsante resta spento: il server prende solo JSON.
import { ArrowRight } from "lucide-react";
import { PRODUCT_IDS } from "../products";
import { pathOf } from "../routes";
import { glassClass } from "./GlassCard";
import type { PageProps } from "./Layout";

export const QuoteForm = ({ page, content, endpoint }: PageProps & { endpoint: string }) => {
  const { form } = content.home.quote;
  const products = content.home.products.items;
  const optional = <span className="field__optional">({form.optional})</span>;
  const [beforeLink, afterLink] = form.consent.split("{privacy}");
  return (
    <form
      className={glassClass("dark", "quote-form")}
      method="post"
      action={endpoint}
      noValidate
      data-quote-form
      data-error-required={form.fieldErrors.required}
      data-error-email={form.fieldErrors.email}
      data-error-message={form.fieldErrors.message}
      data-error-consent={form.fieldErrors.consent}
      data-reveal
    >
      <div className="field">
        <label htmlFor="quote-name">{form.name}</label>
        <input id="quote-name" type="text" name="name" autoComplete="name" maxLength={120} required />
      </div>
      <div className="field">
        <label htmlFor="quote-company">
          {form.company} {optional}
        </label>
        <input id="quote-company" type="text" name="company" autoComplete="organization" maxLength={120} />
      </div>
      <div className="field">
        <label htmlFor="quote-email">{form.email}</label>
        <input id="quote-email" type="email" name="email" autoComplete="email" inputMode="email" maxLength={200} required />
      </div>
      <div className="field">
        <label htmlFor="quote-phone">
          {form.phone} {optional}
        </label>
        <input id="quote-phone" type="tel" name="phone" autoComplete="tel" maxLength={40} />
      </div>
      <div className="field field--wide">
        <label htmlFor="quote-product">
          {form.product} {optional}
        </label>
        <select id="quote-product" name="product" defaultValue="">
          <option value="">{form.productPlaceholder}</option>
          {PRODUCT_IDS.map((id) => (
            <option key={id} value={id}>
              {products[id].name}
            </option>
          ))}
          <option value="altro">{form.productOther}</option>
        </select>
      </div>
      <div className="field field--wide">
        <label htmlFor="quote-message">{form.message}</label>
        <textarea id="quote-message" name="message" rows={5} minLength={10} maxLength={4000} required />
      </div>
      {/* Campo trappola: le persone non lo vedono, i programmi che compilano tutto si'. */}
      <div className="field--trap" aria-hidden="true">
        <label htmlFor="quote-website">Website</label>
        <input id="quote-website" type="text" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="field field--wide field--check">
        <input id="quote-consent" type="checkbox" name="consent" value="yes" required />
        <label htmlFor="quote-consent">
          {beforeLink}
          <a href={pathOf("privacy", page.lang)}>{form.privacyLink}</a>
          {afterLink}
        </label>
      </div>
      <div className="quote-form__foot field--wide">
        <button type="submit" className="btn btn--bronze" data-label={form.submit} data-sending={form.sending} disabled>
          <span data-submit-label>{form.submit}</span>
          <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <p className="form-status" role="status" data-form-status aria-live="polite" data-success={form.success} data-error={form.error} data-invalid={form.invalid} />
      </div>
      <noscript>
        <p className="form-noscript field--wide">{form.noscript}</p>
      </noscript>
    </form>
  );
};
