import type { ReactNode } from "react";

type Tone = "cream" | "ink" | "yellow" | "pink" | "blue" | "red" | "green";

const TONES: Record<Tone, string> = {
  cream: "bg-cream text-ink",
  ink: "bg-ink text-cream",
  yellow: "bg-yellow text-ink",
  pink: "bg-pink text-ink",
  blue: "bg-blue text-cream",
  red: "bg-red text-cream",
  green: "bg-green text-ink",
};

type Props = {
  tone?: Tone;
  /** Hand-made tilt, in degrees. Kept in the -2..3 range per brand rules. */
  rotate?: number;
  bordered?: boolean;
  shadow?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * The eyebrow / kicker pill that opens most sections ("EL PROCESO",
 * "EL CATÁLOGO", "ÚNICO EN LA CATEGORÍA").
 *
 * The ink tone is used borderless — an ink border on an ink fill reads as a
 * thicker pill rather than a bordered one.
 */
export function Pill({
  tone = "cream",
  rotate = 0,
  bordered = true,
  shadow = false,
  className = "",
  children,
}: Props) {
  return (
    <span
      className={`inline-block rounded-full px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] ${
        TONES[tone]
      } ${bordered ? "cartoon-border" : ""} ${
        shadow ? "shadow-[3px_3px_0_0_var(--color-ink)]" : ""
      } ${className}`}
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
    >
      {children}
    </span>
  );
}
