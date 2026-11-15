// La fascia di fiducia: solo fatti verificabili (iscrizione al RUI, vigilanza, controllo dei documenti, firma digitale).
import { ArrowUpRight, BadgeCheck, FileSignature, Landmark, ScanSearch } from "lucide-react";
import { RUI_CHECK_URL } from "../config";
import type { PageProps } from "./Layout";

const ICONS = [BadgeCheck, Landmark, ScanSearch, FileSignature];

export const TrustStrip = ({ content }: PageProps) => (
  <section className="trust" aria-label={content.trust.label}>
    <div className="container">
      <ul className="trust__list glass-strong" data-reveal>
        {content.trust.items.map((item, index) => {
          const Icon = ICONS[index % ICONS.length];
          return (
            <li key={item.title} className="trust__item">
              <span className="icon-badge">
                <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <div>
                <p className="trust__title">{item.title}</p>
                <p className="trust__text">{item.text}</p>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="trust__check" data-reveal>
        <a className="link-arrow" href={RUI_CHECK_URL} target="_blank" rel="noopener noreferrer">
          {content.trust.ruiCheck}
          <ArrowUpRight size={16} strokeWidth={1.8} aria-hidden="true" />
        </a>
      </p>
    </div>
  </section>
);
