// «Il portale»: cosa fa lo spazio riservato. L'interfaccia a destra e' ridisegnata con dati inventati: mai una
// schermata o un nome reale.
import { ArrowRight, CalendarClock, FileSignature, Layers, Plug, ReceiptText, ScanSearch } from "lucide-react";
import { API_DOCS_PATH } from "../config";
import { SectionHead, type PageProps } from "./Layout";

const ICONS = [ScanSearch, Layers, FileSignature, ReceiptText, CalendarClock, Plug];

export const PortalShowcase = ({ content }: PageProps) => {
  const { portal } = content;
  return (
    <section className="section section--dark" id="portale">
      <div className="section__glow section__glow--a" aria-hidden="true" />
      <div className="section__glow section__glow--b" aria-hidden="true" />
      <div className="container">
        <SectionHead eyebrow={portal.eyebrow} title={portal.title} intro={portal.intro} light />
        <div className="portal">
          <ul className="features stagger">
            {portal.features.map((feature, index) => {
              const Icon = ICONS[index % ICONS.length];
              return (
                <li key={feature.title} className="feature glass-dark" data-reveal data-glow>
                  <span className="icon-badge icon-badge--bronze">
                    <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <h3 className="feature__title">{feature.title}</h3>
                  <p>{feature.text}</p>
                </li>
              );
            })}
          </ul>
          <figure className="mock glass-dark" data-reveal data-tilt>
            <div className="mock__bar" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="mock__head">
              <strong>{portal.mock.title}</strong>
              <span className="pill">{portal.mock.lot}</span>
            </div>
            <table className="mock__table">
              <thead>
                <tr>
                  <th scope="col">{portal.mock.columns.company}</th>
                  <th scope="col">{portal.mock.columns.documents}</th>
                  <th scope="col">{portal.mock.columns.status}</th>
                </tr>
              </thead>
              <tbody>
                {portal.mock.rows.map((row) => (
                  <tr key={row.company}>
                    <th scope="row">{row.company}</th>
                    <td>{row.documents}</td>
                    <td>
                      <span className={`pill pill--${row.tone}`}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <figcaption>{portal.mock.note}</figcaption>
          </figure>
        </div>
        <p className="portal__api" data-reveal>
          {portal.api.text}{" "}
          <a className="link-arrow link-arrow--light" href={API_DOCS_PATH}>
            {portal.api.cta}
            <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
          </a>
        </p>
      </div>
    </section>
  );
};
