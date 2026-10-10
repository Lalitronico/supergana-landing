/**
 * Supergana's wordmark as the brand draws it on supergana.fun: "Supergana" in
 * Bricolage 800 with a red full stop (components/landing/Navbar.tsx). Every
 * co-brand lockup in the module uses this, never a lowercase name with a dot
 * in another colour — that was a different logo.
 */
export function SuperganaWordmark({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={className ? `sg-wordmark ${className}` : "sg-wordmark"}
      style={{ fontSize: size }}
      role="img"
      aria-label="Supergana"
    >
      Supergana<span className="sg-dot" aria-hidden="true">.</span>
    </span>
  );
}
