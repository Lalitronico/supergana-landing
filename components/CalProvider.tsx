"use client";

import { useEffect } from "react";
import { getCalApi } from "@calcom/embed-react";
import { SITE } from "@/lib/config";

export function CalProvider() {
  useEffect(() => {
    (async () => {
      const cal = await getCalApi({ namespace: SITE.bookingNamespace });
      cal("ui", {
        theme: "light",
        // Cal's default brand is a blue that reads as a foreign widget dropped
        // into the page. Ink matches the surrounding buttons and borders.
        // Both themes are required by the type even though the embed is pinned
        // to light — the brand has no dark mode.
        cssVarsPerTheme: {
          light: { "cal-brand": "#0A0A0A" },
          dark: { "cal-brand": "#0A0A0A" },
        },
        hideEventTypeDetails: false,
        layout: "month_view",
      });
    })();
  }, []);

  return null;
}
