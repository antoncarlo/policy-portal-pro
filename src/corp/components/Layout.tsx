// L'ossatura di ogni pagina: salto al contenuto, barra, contenuto, pie' di pagina, avviso della lingua e, se e'
// impostato uno strumento di misurazione, banner dei cookie.
import type { ReactNode } from "react";
import type { CorpContent } from "../content";
import type { CorpPage } from "../routes";
import { CookieBanner } from "./CookieBanner";
import { Footer } from "./Footer";
import { Header } from "./Header";
import { LangNotice } from "./LangNotice";

export interface PageProps {
  page: CorpPage;
  content: CorpContent;
}

export const Layout = ({ page, content, measurement, children }: PageProps & { measurement: boolean; children: ReactNode }) => (
  <>
    <a className="skip-link" href="#contenuto">
      {content.nav.skip}
    </a>
    <div className="scroll-progress" aria-hidden="true" />
    <Header page={page} content={content} />
    <main id="contenuto">{children}</main>
    <Footer page={page} content={content} />
    <LangNotice page={page} />
    {measurement ? <CookieBanner page={page} content={content} /> : null}
  </>
);

/** Intestazione di una sezione: il solo titolo H2, senza scritte sopra ne' sottotitoli sotto. */
export const SectionHead = ({ title, id }: { title: string; id?: string }) => (
  <header className="section__head" data-reveal>
    <h2 className="section__title" id={id}>
      {title}
    </h2>
  </header>
);
