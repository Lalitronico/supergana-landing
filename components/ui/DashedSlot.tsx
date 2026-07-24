import type { ReactNode } from "react";

type Props = {
  /** Text shown while the slot is empty, e.g. "LOGO MARCA". */
  label: string;
  /** Real content once a campaign fills the slot. */
  children?: ReactNode;
  className?: string;
  rotate?: number;
};

/**
 * A white-label content slot.
 *
 * These are NOT design placeholders to be deleted before launch — they are
 * real holes in the product. `[ LOGO MARCA ]`, `[ FOTO PREMIO ]` and
 * `[ PREMIO ]` get filled per campaign from the tenant's configuration, so
 * they stay as a component fed by props rather than becoming hardcoded values.
 *
 * The dashed 3px border (vs. the solid 3px used everywhere else) is the
 * brand's signal for "configurable by campaign".
 */
export function DashedSlot({ label, children, className = "", rotate }: Props) {
  if (children) {
    return (
      <div className={className} style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-xl border-[3px] border-dashed border-ink px-4 py-3 text-center ${className}`}
      style={rotate ? { transform: `rotate(${rotate}deg)` } : undefined}
    >
      {/* Opacity sits on the label, not the box: dimming the whole element
          would let a coloured parent bleed through the slot's fill. */}
      <span className="font-mono text-xs font-bold tracking-[0.06em] opacity-60">
        [ {label} ]
      </span>
    </div>
  );
}
