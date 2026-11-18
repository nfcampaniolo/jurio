import React from "react";

/**
 * Rendering minimo e sicuro del testo dei modelli: paragrafi, elenchi puntati/numerati e **grassetto**.
 * Nessun HTML interpretato: tutto passa come testo React.
 */
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
        <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
      ) : (
        <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>
      )
    );
}

export const RichText: React.FC<{ text: string }> = ({ text }) => {
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => (
      <li key={i}>{inline(it, `li${blocks.length}-${i}`)}</li>
    ));
    blocks.push(
      list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>
    );
    list = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flush();
    if (!line) continue;
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    blocks.push(
      heading ? (
        <p key={blocks.length} className="rich-heading">
          {inline(heading[1], `h${blocks.length}`)}
        </p>
      ) : (
        <p key={blocks.length}>{inline(line, `p${blocks.length}`)}</p>
      )
    );
  }
  flush();
  return <div className="rich-text">{blocks}</div>;
};
