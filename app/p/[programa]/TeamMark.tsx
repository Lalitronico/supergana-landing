import { teamOf } from "@/lib/pickem/teams";

/**
 * A club, as a light tile with its abbreviation and its colour underneath.
 *
 * See lib/pickem/teams.ts for why there is no crest here. The short version:
 * the shield and the 32 club marks are trademarks, the programme has no licence
 * for them, and a coloured underline reads just as well from across a table.
 */
export function TeamMark({ abbr }: { abbr: string }) {
  const team = teamOf(abbr);
  return (
    <span
      className="pk-mark"
      style={{ "--team": team.color } as React.CSSProperties}
      aria-hidden="true"
    >
      {abbr}
    </span>
  );
}
