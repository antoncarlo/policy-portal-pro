// L'avviso della lingua: a chi ha il browser nell'altra lingua del sito si propone quella versione, scritta in
// quella lingua. Nascosto finche' src/site/client/lang.ts non decide di mostrarlo; mai un reindirizzamento.
import { CORP } from "../config";
import { contentFor } from "../content";
import { pathOf } from "../routes";
import { glassClass } from "./GlassCard";
import type { PageProps } from "./Layout";

export const LangNotice = ({ page }: Pick<PageProps, "page">) => (
  <>
    {CORP.langs
      .filter((lang) => lang !== page.lang)
      .map((lang) => {
        const notice = contentFor(lang).langNotice;
        return (
          <div key={lang} className={glassClass("dark", "lang-notice")} data-lang-notice={lang} lang={CORP.hreflang[lang]} role="region" aria-label={notice.action} hidden>
            <p>{notice.text}</p>
            <a className="btn btn--bronze btn--sm" href={pathOf(page.id, lang)}>
              {notice.action}
            </a>
            <button type="button" className="btn btn--ghost btn--sm" data-lang-dismiss>
              {notice.dismiss}
            </button>
          </div>
        );
      })}
  </>
);
