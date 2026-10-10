/**
 * The cartoon fuel pump the whole campaign stands around.
 *
 * The readout lives in the big round dial at the TOP, on purpose: characters
 * stand in front of the lower body, so a display on the body gets hidden behind
 * the cast. Up here it is always visible, and it shows `digits` (the points a
 * dollar earns, passed by the caller from the campaign's data). Decorative:
 * aria-hidden, the numbers are said in words everywhere it is used.
 */
export function GasPump({
  digits,
  height = 230,
  className,
}: {
  digits: string;
  height?: number | string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 132 230"
      style={{ height, width: "auto" }}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* hose and nozzle, behind the body */}
      <path
        d="M98 128c26 0 30 26 28 50-1 12-1 20-6 24"
        fill="none"
        stroke="#0A0A0A"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M114 196h14v18a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4z" fill="#FFD93D" stroke="#0A0A0A" strokeWidth="3.5" strokeLinejoin="round" />
      {/* neck and dial */}
      <rect x="46" y="64" width="40" height="12" rx="3" fill="#0A0A0A" />
      <circle cx="66" cy="36" r="33" fill="#FAF7F0" stroke="#0A0A0A" strokeWidth="4.5" />
      <circle cx="66" cy="36" r="26" fill="#0A0A0A" />
      <text
        x="66"
        y="46"
        textAnchor="middle"
        fontFamily="var(--font-bricolage), system-ui, sans-serif"
        fontWeight="800"
        fontSize="29"
        fill="#2ECC71"
      >
        {digits}
      </text>
      <path d="M44 22c4-8 12-12 20-11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".5" />
      {/* body */}
      <rect x="20" y="72" width="92" height="146" rx="14" fill="#FF4757" stroke="#0A0A0A" strokeWidth="4" />
      <path d="M28 82h76" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".5" />
      <rect x="32" y="96" width="68" height="28" rx="6" fill="#1E90FF" stroke="#0A0A0A" strokeWidth="3.5" />
      <g fill="#fff" opacity=".9">
        <rect x="38" y="101" width="8" height="7" />
        <rect x="54" y="101" width="8" height="7" />
        <rect x="70" y="101" width="8" height="7" />
        <rect x="86" y="101" width="8" height="7" />
        <rect x="46" y="108" width="8" height="7" />
        <rect x="62" y="108" width="8" height="7" />
        <rect x="78" y="108" width="8" height="7" />
      </g>
      <rect x="20" y="168" width="92" height="20" fill="#FFD93D" stroke="#0A0A0A" strokeWidth="3.5" />
      <rect x="10" y="214" width="112" height="14" rx="5" fill="#0A0A0A" />
    </svg>
  );
}
