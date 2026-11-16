// Il documento HTML di una pagina: testata e corpo composti come testo, con escape.

export const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface HtmlDocumentInput {
  /** Valore di `lang`, per esempio "it" o "zh-Hans". */
  lang: string;
  siteId: string;
  pageId: string;
  /** Le righe della testata, gia' con escape. */
  head: string;
  /** Il corpo, gia' reso come HTML. */
  body: string;
  bodyClass: string;
  /** Attributi in piu' sull'elemento radice: un valore assente non viene scritto. */
  attrs?: Record<string, string | undefined>;
}

export const htmlDocument = ({ lang, siteId, pageId, head, body, bodyClass, attrs = {} }: HtmlDocumentInput): string => {
  const extra = Object.entries(attrs)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([name, value]) => ` ${name}="${escapeHtml(value)}"`)
    .join("");
  return `<!doctype html>\n<html lang="${escapeHtml(lang)}" data-site="${escapeHtml(siteId)}" data-page="${escapeHtml(pageId)}"${extra}>\n<head>\n${head}\n</head>\n<body class="${escapeHtml(bodyClass)}">\n${body}\n</body>\n</html>\n`;
};
