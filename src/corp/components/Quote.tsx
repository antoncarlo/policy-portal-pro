// La richiesta di preventivo: i recapiti diretti. Il modulo si aggiunge qui accanto.
import { Mail, Phone } from "lucide-react";
import { COMPANY } from "../config";
import { GlassCard } from "./GlassCard";
import { SectionHead, type PageProps } from "./Layout";

export const Quote = ({ content }: PageProps) => {
  const { quote } = content.home;
  return (
    <section className="section quote" id="preventivo" aria-labelledby="preventivo-titolo">
      <div className="container">
        <SectionHead title={quote.title} id="preventivo-titolo" />
        <div className="quote__grid">
          <GlassCard className="quote__contacts" data-reveal>
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
