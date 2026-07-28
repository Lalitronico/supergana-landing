"use client";

import { useEffect } from "react";

/**
 * Keeps `<html lang>` in step with the page's language.
 *
 * The site has a single root layout shared by every route, and a server
 * component cannot know which path rendered it — so the root element ships
 * with the Spanish default in the HTML and this corrects it on the English
 * landing. That covers browser translation prompts, `:lang()` rules and
 * anything reading `documentElement.lang` at runtime.
 *
 * What it does NOT cover is a crawler that only reads the initial HTML: for
 * those, the `hreflang` alternates in each page's metadata and the `lang` on
 * `<main>` are the signals that matter. Making the root element correct
 * server-side would mean either moving every route under an `app/[lang]`
 * segment or splitting the site across two root layouts in route groups —
 * worth doing when a second page gets translated, not for one attribute.
 *
 * Renders nothing.
 */
export function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = lang;
    return () => {
      document.documentElement.lang = previous;
    };
  }, [lang]);

  return null;
}
