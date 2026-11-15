// Pagina di testo (privacy, cookie): titolo, introduzione e sezioni.
import type { ReactNode } from "react";
import type { PageProps } from "../components/Layout";

export const LegalPage = ({ page, content, children }: PageProps & { children?: ReactNode }) => {
  const meta = content.meta[page.id];
  return (
    <article className="legal">
      <header className="legal__hero">
        <div className="container container--narrow">
          <p className="eyebrow eyebrow--light">{meta.label}</p>
          <h1 className="legal__title">{meta.h1}</h1>
          <p className="legal__lead">{meta.description}</p>
        </div>
      </header>
      <div className="container container--narrow legal__body">{children}</div>
    </article>
  );
};
