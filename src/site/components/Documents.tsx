// «Documenti necessari»: cosa preparare per la richiesta, come lo chiede il portale.
import { Building2, FileBadge, FileText, IdCard, ScrollText, UserCheck } from "lucide-react";
import { SectionHead, type PageProps } from "./Layout";

const ICONS = [Building2, IdCard, ScrollText, UserCheck, FileBadge, FileText];

export const Documents = ({ content }: PageProps) => {
  const { documents } = content;
  return (
    <section className="section" id="documenti">
      <div className="container">
        <SectionHead eyebrow={documents.eyebrow} title={documents.title} intro={documents.intro} />
        <ul className="documents stagger">
          {documents.items.map((item, index) => {
            const Icon = ICONS[index % ICONS.length];
            return (
              <li key={item.title} className="document glass" data-reveal data-glow>
                <span className="icon-badge">
                  <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="document__title">{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="note" data-reveal>
          {documents.note}
        </p>
      </div>
    </section>
  );
};
