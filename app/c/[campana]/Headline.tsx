"use client";

/**
 * Wraps one word or phrase of a headline without hardcoding word order per
 * language — the marked text is looked up in the string, so Spanish and English
 * can put it wherever they naturally put it.
 *
 * Two treatments, because the two things being emphasised are not the same kind
 * of thing:
 *   · `mark`  — the yellow highlighter. The system's own way of stressing a
 *               phrase, and what the threshold campaign's headline uses.
 *   · `brand` — the tenant's colour. For the client's name, or the noun the
 *               campaign is about. A highlighter would flatten that into
 *               Supergana yellow, which is exactly the distinction the theme
 *               exists to keep (see lib/tickets/theme.ts).
 */
export function Headline({
  text,
  mark,
  as = "mark",
}: {
  text: string;
  mark: string;
  as?: "mark" | "brand";
}) {
  const at = text.indexOf(mark);
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <span className={as === "brand" ? "tk-brandword" : "tk-mark"}>{mark}</span>
      {text.slice(at + mark.length)}
    </>
  );
}
