// L'indice del blog: il titolo e un riquadro per ogni guida, nell'ordine del progetto.
import { ARTICLES } from "../blog";
import { GuideCards } from "../components/GuideCards";
import type { PageProps } from "../components/Layout";
import { metaOf } from "../meta";

export const BlogIndex = ({ page }: PageProps) => (
  <article className="legal blog-index">
    <header className="legal__hero">
      <div className="container">
        <h1 className="legal__title">{metaOf(page).h1}</h1>
      </div>
    </header>
    <div className="container blog-index__body">
      <GuideCards entries={ARTICLES} lang={page.lang} heading="h2" />
    </div>
  </article>
);
