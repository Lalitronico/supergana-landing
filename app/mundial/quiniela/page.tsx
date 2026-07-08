import type { Metadata } from "next";
import { Suspense } from "react";
import { MundialQuinielaClient } from "./MundialQuinielaClient";

export const metadata: Metadata = {
  title: "Llena tu quiniela - Mundial x Rotary - Supergana",
  description:
    "Registra tus predicciones de cuartos, semifinales y final del Mundial 2026.",
  robots: { index: false },
};

export default function MundialQuinielaPage() {
  return (
    <Suspense fallback={null}>
      <MundialQuinielaClient />
    </Suspense>
  );
}
