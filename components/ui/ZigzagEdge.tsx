type Props = {
  /** The colour of the teeth — i.e. the band being entered or exited. */
  color: string;
  /**
   * `down` points the teeth into the section below (used entering a colour
   * band); `up` points them into the section above (used leaving it).
   */
  direction: "down" | "up";
  /** Fill behind the teeth. Needed when exiting onto a non-cream section. */
  background?: string;
};

/**
 * The torn-paper transition between a cream section and a colour band. Brand
 * rule: colour bands are never entered or left on a flat horizontal cut.
 *
 * Built from a repeating conic-gradient rather than an SVG so it scales to any
 * width with no rasterisation and costs one element.
 */
export function ZigzagEdge({ color, direction, background }: Props) {
  const gradient =
    direction === "down"
      ? `conic-gradient(from -45deg at 50% 100%, ${color} 90deg, transparent 0) 0 100%/28px 22px repeat-x`
      : `conic-gradient(from 135deg at 50% 0, ${color} 90deg, transparent 0) 0 0/28px 22px repeat-x`;

  return (
    <div
      aria-hidden
      className="h-[22px]"
      style={{ background: gradient, backgroundColor: background }}
    />
  );
}
