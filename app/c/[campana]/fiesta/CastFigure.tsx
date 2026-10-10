import type { CastMember } from "@/lib/tickets/theme";

/**
 * One cast member, standing. Sized by HEIGHT, not width: the art files have
 * different paddings and silhouettes, and matching widths makes a lanky lynx
 * look twice the size of a squat bear (feedback from the landing, 2026-05).
 *
 * `bob` adds the idle float every character has on stage; `delay` staggers it
 * so a group never moves in lockstep. Decoration only: the name is the alt,
 * and screens that already say who it is pass alt="".
 */
export function CastFigure({
  member,
  height,
  bob = true,
  delay = 0,
  className,
  alt,
}: {
  member: CastMember;
  height: number | string;
  bob?: boolean;
  delay?: number;
  className?: string;
  alt?: string;
}) {
  const classes = ["sg-cast", bob ? "sg-bob" : "", className ?? ""].filter(Boolean).join(" ");
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tenant art from /brands or https, already sized
    <img
      src={member.image}
      alt={alt ?? member.name}
      className={classes}
      style={{ height, animationDelay: `${delay}ms` }}
      decoding="async"
      draggable={false}
    />
  );
}
