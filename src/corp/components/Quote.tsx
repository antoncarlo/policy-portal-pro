// La richiesta di preventivo: il modulo e, accanto, i recapiti diretti.
import { Mail, Phone } from "lucide-react";
import { COMPANY } from "../config";
import { GlassCard } from "./GlassCard";
import { SectionHead, type PageProps } from "./Layout";
import { QuoteForm } from "./QuoteForm";

export const Quote = ({ page, content, endpoint }: PageProps & { endpoint: string }) => {
  const { quote } = content.home;
  return (
    <section className="section quote" id="preventivo" aria-labelledby="preventivo-titolo">
      <div className="container">
        <SectionHead title={quote.title} id="preventivo-titolo" />
        <div className="quote__grid">
          <QuoteForm page={page} content={content} endpoint={endpoint} />
          <GlassCard as="aside" className="quote__contacts" data-reveal>
            <p className="quote__lead">{quote.lead}</p>
            <ul className="quote__list">
              <li>
                <Mail size={18} strokeWidth={1.7} aria-hidden="true" />
                <span>{quote.emailLabel}</span>
                <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
              </li>
              <li>
                <Phone size={18} strokeWidth={1.7} aria-hidden="true" />
                <span>{quote.phoneLabel}</span>
                <a href={`tel:${COMPANY.phoneE164}`}>{COMPANY.phone}</a>
              </li>
            </ul>
          </GlassCard>
        </div>
      </div>
    </section>
  );
};
