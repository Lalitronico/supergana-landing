import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getProgram, isVisible } from "@/lib/pickem/program";
import { themeCssVars } from "@/lib/tickets/theme";
import { PickemHeader } from "./PickemHeader";
import "@/styles/module-shell.css";
import "./pickem.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ programa: string }>;
}): Promise<Metadata> {
  const { programa } = await params;
  const program = await getProgram(programa);
  if (!program) return { title: "Supergana" };
  return {
    title: `${program.name} — ${program.orgName}`,
    // The programme lives behind a QR on a restaurant table. It has no business
    // competing with the marketing site in search results, and a draft one must
    // not be indexable at all.
    robots: { index: false, follow: false },
  };
}

export default async function PickemLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ programa: string }>;
}) {
  const { programa } = await params;
  const program = await getProgram(programa);
  if (!program || !isVisible(program)) notFound();

  // The theme's whole reach over the stylesheet: two custom properties, both
  // validated as hex by parseOrgTheme before they get here. `organizations.theme`
  // is editable from the console and by hand in the Supabase dashboard, and
  // this is the path from that row into a <style> attribute — so what arrives
  // is what the parser allowed, never what the row said.
  const style = themeCssVars(program.theme) as React.CSSProperties;

  return (
    <div className="sg-app pk-app" style={style}>
      <div className="sg-phone">
        <PickemHeader
          programSlug={program.slug}
          programName={program.name}
          orgName={program.orgName}
          orgSlug={program.orgSlug}
          logoUrl={program.theme.logoUrl}
          logoAlt={program.theme.logoAlt ?? program.orgName}
          poweredBy={program.theme.poweredBy}
          status={program.status}
        />
        {children}
      </div>
    </div>
  );
}
