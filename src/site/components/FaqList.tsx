// Le domande frequenti di un articolo o di una pagina per pubblico: ogni risposta e' nell'HTML anche da chiusa.
import { ChevronDown } from "lucide-react";
import type { Lang } from "../config";
import { Inline } from "./Inline";

export const FaqList = ({ items, lang }: { items: Array<{ q: string; a: string }>; lang: Lang }) => (
  <div className="faq">
    {items.map((item, index) => (
      <details key={item.q} className="faq__item glass" open={index === 0}>
        <summary>
          <h3 className="faq__q">{item.q}</h3>
          <ChevronDown className="faq__icon" size={20} strokeWidth={1.8} aria-hidden="true" />
        </summary>
        <p className="faq__a">
          <Inline text={item.a} lang={lang} />
        </p>
      </details>
    ))}
  </div>
);
