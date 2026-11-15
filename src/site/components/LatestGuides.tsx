// Le guide in homepage: tre riquadri e il link all'indice del blog.
import { ArrowRight } from "lucide-react";
import { ARTICLES } from "../blog";
import { pathOf } from "../routes";
import { GuideCards } from "./GuideCards";
import { SectionHead, type PageProps } from "./Layout";

export const LatestGuides = ({ page, content }: PageProps) => {
  const entries = ARTICLES.slice(0, 3);
  if (entries.length === 0) return null;
  return (
    <section className="section section--tint" id="guide">
      <div className="container">
        <SectionHead title={content.blog.latestTitle} />
        <GuideCards entries={entries} lang={page.lang} />
        <a className="link-arrow guides__all" href={pathOf("blog", page.lang)}>
          {content.blog.allGuides}
          <ArrowRight size={16} strokeWidth={1.8} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
};
