// L'ossatura di ogni pagina pubblica: salto al contenuto, barra, contenuto, pie' di pagina, avviso della lingua e,
// se sono impostati gli strumenti di Google, banner dei cookie.
import type { ReactNode } from "react";
import type { SiteContent } from "../content";
import type { PageRef } from "../routes";
import { CookieBanner, type MeasurementTools } from "./CookieBanner";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { LangNotice } from "./LangNotice";

export interface PageProps {
  page: PageRef;
  content: SiteContent;
}

export const Layout = ({ page, content, tools, children }: PageProps & { tools: MeasurementTools; children: ReactNode }) => (
  <>
    <a className="skip-link" href="#contenuto">
      {content.nav.skip}
    </a>
    <div className="scroll-progress" aria-hidden="true" />
    <Header page={page} content={content} />
    <main id="contenuto">{children}</main>
    <Footer page={page} content={content} />
    <LangNotice page={page} />
    {tools.statistics || tools.marketing ? <CookieBanner page={page} content={content} /> : null}
  </>
);

/** Intestazione di una sezione: il solo titolo H2, senza scritte sopra ne' sottotitoli sotto. */
export const SectionHead = ({ title }: { title: string }) => (
  <header className="section__head" data-reveal>
    <h2 className="section__title">{title}</h2>
  </header>
);
