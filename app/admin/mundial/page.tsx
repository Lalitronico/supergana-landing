import type { Metadata } from "next";
import { MundialAdminClient } from "./MundialAdminClient";

export const metadata: Metadata = {
  title: "Admin - Quiniela Mundial x Rotary",
  robots: { index: false, follow: false },
};

export default function MundialAdminPage() {
  return <MundialAdminClient />;
}
