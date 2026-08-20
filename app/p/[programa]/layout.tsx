import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getProgram, isVisible } from "@/lib/pickem/program";
import { themeCssVars } from "@/lib/tickets/theme";
import { characterDir } from "./cast";
import { PickemHeader } from "./PickemHeader";
import { PickemTabs } from "./PickemTabs";
import { PickemTour } from "./PickemTour";
import { pickemTour } from "./tour";
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
          logoUrl={program.theme.logoUrl}
          logoAlt={program.theme.logoAlt ?? program.orgName}
          status={program.status}
        />
        {/* The tour wraps the children rather than sitting beside them, so it
            can hold state across a route change: a client component at a stable
            position in a layout is reconciled, not remounted, and a tour that
            walks four screens cannot live inside one of them. `{children}` is
            still server-rendered output — passing RSC through a client boundary
            does not make the pages client components. */}
        <PickemTour
          definition={pickemTour(program)}
          charDir={characterDir(program.theme.logoUrl)}
          hit={program.mechanics.hit}
          slug={program.slug}
        >
          {children}
        </PickemTour>
        {/* AFTER the children, so the flex column reads head → the child's
            scrolling screen → whatever contextual sticky the child adds → the
            tabs. Navigation belongs to the shell: twelve screens each writing
            their own dock is how a module ends up saying something different
            about where you can go on every screen. */}
        <PickemTabs slug={program.slug} openWeek={program.openWeek} />
      </div>
    </div>
  );
}
