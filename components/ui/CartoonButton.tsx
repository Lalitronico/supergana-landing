import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "yellow" | "ink" | "cream" | "green" | "blue";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  yellow: "bg-yellow text-ink",
  // Ink buttons only appear on the yellow band, where an ink shadow would be
  // invisible — btn-cartoon-oncream swaps it for cream.
  ink: "bg-ink text-yellow btn-cartoon-oncream",
  cream: "bg-cream text-ink",
  green: "bg-green text-ink",
  blue: "bg-blue text-cream",
};

const SIZES: Record<Size, string> = {
  sm: "rounded-[14px] px-6 py-3 text-base",
  md: "rounded-2xl px-[30px] py-4 text-[17px]",
  lg: "btn-cartoon-lg rounded-[18px] px-[34px] py-[18px] text-[19px]",
};

type Props = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<typeof Link>, "className" | "children">;

/**
 * The canonical Supergana button: 3px ink border, hard shadow with no blur,
 * and a hover that lifts it up-left while the shadow grows.
 *
 * Shadow sizing comes from the unlayered `btn-cartoon*` classes in globals.css
 * rather than Tailwind `shadow-*` utilities — unlayered CSS wins the cascade
 * against anything Tailwind emits, so a utility here would silently lose.
 *
 * Always renders as a link: every button on the landing navigates somewhere
 * (anchor, module URL, or mailto).
 */
export function CartoonButton({
  variant = "yellow",
  size = "md",
  className = "",
  children,
  ...linkProps
}: Props) {
  return (
    <Link
      {...linkProps}
      className={`btn-cartoon inline-block font-extrabold ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </Link>
  );
}
