// I blocchi di un articolo o di una pagina per pubblico: paragrafi, elenchi, passi numerati, tabelle, avvertenze.
import type { Block } from "../blog/types";
import type { Lang } from "../config";
import { Inline } from "./Inline";

const BlockView = ({ block, lang }: { block: Block; lang: Lang }) => {
  if (block.type === "p")
    return (
      <p>
        <Inline text={block.text} lang={lang} />
      </p>
    );
  if (block.type === "note")
    return (
      <p className="article-note">
        <Inline text={block.text} lang={lang} />
      </p>
    );
  if (block.type === "list")
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item}>
            <Inline text={item} lang={lang} />
          </li>
        ))}
      </ul>
    );
  if (block.type === "steps")
    return (
      <ol className="article-steps">
        {block.items.map((item) => (
          <li key={item.title}>
            <strong>{item.title}</strong>
            <span>
              <Inline text={item.text} lang={lang} />
            </span>
          </li>
        ))}
      </ol>
    );
  return (
    <div className="table-wrap glass">
      <table className="compare">
        <thead>
          <tr>
            {block.columns.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={index} scope="row">
                    <Inline text={cell} lang={lang} />
                  </th>
                ) : (
                  <td key={index} data-label={block.columns[index]}>
                    <Inline text={cell} lang={lang} />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const Blocks = ({ blocks, lang }: { blocks: Block[]; lang: Lang }) => (
  <>
    {blocks.map((block, index) => (
      <BlockView key={index} block={block} lang={lang} />
    ))}
  </>
);
