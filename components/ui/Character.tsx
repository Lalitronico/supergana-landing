import Image from "next/image";
import { POSES, type PoseName } from "@/lib/characters";

type Bob = "bob" | "bob2" | "bob3" | "none";

type Props = {
  pose: PoseName;
  /** Rendered width in px. Height follows the art's aspect ratio. */
  size: number;
  bob?: Bob;
  /** Seconds for one bob cycle. Vary it per instance so they desync. */
  duration?: number;
  /** Seconds of animation delay. Same reason. */
  delay?: number;
  className?: string;
};

/**
 * A floating character.
 *
 * Animation runs on CSS keyframes rather than Framer Motion so it obeys the
 * `data-anim="off"` kill switch and the prefers-reduced-motion query without
 * any JS. bob2/bob3 bake their own rotation into the keyframes.
 *
 * Poses without art yet fall back to the design's labelled placeholder circle,
 * which keeps the layout honest instead of collapsing to nothing.
 */
export function Character({
  pose,
  size,
  bob = "bob",
  duration = 5,
  delay = 0,
  className = "",
}: Props) {
  const { src, alt, label, placeholderTone } = POSES[pose];

  const animation =
    bob === "none"
      ? undefined
      : `${bob} ${duration}s ease-in-out ${delay}s infinite`;

  if (!src) {
    return (
      <div className={className} style={{ animation }}>
        <div
          className={`cartoon-border flex items-center justify-center rounded-full p-4 text-center text-[10px] font-extrabold tracking-[0.08em] shadow-[5px_5px_0_0_var(--color-ink)] ${placeholderTone}`}
          style={{ width: size, height: size }}
        >
          {label}
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={{ animation }}>
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        draggable={false}
        aria-hidden={alt === "" || undefined}
        className="h-auto select-none drop-shadow-[6px_8px_0_rgba(10,10,10,0.18)]"
        style={{ width: size }}
      />
    </div>
  );
}
