import Image from "next/image";
import { teamOf } from "@/lib/pickem/teams";

/**
 * A club, as a light tile carrying its crest, with its colour underneath.
 *
 * The crest is the mark since 2026-08-08, when the product owner decided the
 * programme ships with the official art (see lib/pickem/teams.ts). Before that
 * the tile carried the three-letter abbreviation and nothing else.
 *
 * THAT TILE IS STILL HERE, as the fallback: a club with no `crest` — anything
 * the table does not know, which is what an externally ingested schedule
 * eventually hands us — renders the abbreviation over the colour exactly as it
 * did before. Nothing about the tile, its size or its underline changed, so
 * both renderings sit at the same weight in a row of matches.
 *
 * The tile is 34px (see `.pk-mark` in pickem.css) and the art is 160px, which
 * carries it past 4x DPR. `next/image` is the repo's component for static
 * assets under public/ and `images.unoptimized` is on, so this emits a plain
 * <img> with no loader in the way.
 *
 * The bottom padding is not decoration: `.pk-mark::after` paints the club's
 * 4px underline over the tile, and without the clearance the crest would sit
 * under it.
 */
export function TeamMark({ abbr }: { abbr: string }) {
  const team = teamOf(abbr);
  return (
    <span
      className="pk-mark"
      style={{ "--team": team.color } as React.CSSProperties}
      aria-hidden="true"
    >
      {team.crest ? (
        <Image
          src={team.crest}
          alt=""
          width={160}
          height={160}
          style={{
            width: "100%",
            height: "100%",
            padding: "1px 1px 5px",
            boxSizing: "border-box",
            objectFit: "contain",
          }}
        />
      ) : (
        abbr
      )}
    </span>
  );
}
