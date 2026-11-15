// Un paragrafo delle pagine di testo: «{privacy}», «{cookie}» e «{notice}» diventano link alle pagine, gli
// indirizzi email e gli indirizzi web si collegano da soli. Il testo e' quello dei contenuti del sito, mai di chi visita.
import { COMPANY } from "../config";
import { pathOf } from "../routes";
import type { PageProps } from "./Layout";

const TOKENS = /(\{privacy\}|\{cookie\}|\{notice\}|https?:\/\/[^\s)）]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/;

export const Rich = ({ text, page, content }: PageProps & { text: string }) => (
  <>
    {text.split(TOKENS).map((part, index) => {
      if (index % 2 === 0) return part;
      if (part === "{privacy}") return <a key={index} href={pathOf("privacy", page.lang)}>{content.meta.privacy.label}</a>;
      if (part === "{cookie}") return <a key={index} href={pathOf("cookie", page.lang)}>{content.meta.cookie.label}</a>;
      if (part === "{notice}")
        return (
          <a key={index} href={COMPANY.privacyNoticeUrl} target="_blank" rel="noopener noreferrer">
            {content.legal.noticeLabel}
          </a>
        );
      if (part.includes("@")) return <a key={index} href={`mailto:${part}`}>{part}</a>;
      return (
        <a key={index} href={part} target="_blank" rel="noopener noreferrer">
          {part.replace(/^https?:\/\//, "").replace(/\/$/, "")}
        </a>
      );
    })}
  </>
);
