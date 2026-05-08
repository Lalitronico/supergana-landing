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
        hideEventTypeDetails: false,
        layout: "month_view",
      });
    })();
  }, []);

  return null;
}
