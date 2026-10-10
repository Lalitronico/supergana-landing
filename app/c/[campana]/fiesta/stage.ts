import type { CastMember, OrgTheme } from "@/lib/tickets/theme";

/**
 * Who stands where on the hero stage.
 *
 * Slots, not names: the platform does not know which character a tenant calls
 * the host. The host is the member who holds no brand (the one that belongs to
 * the client itself); the rest keep the order the tenant listed them, and the
 * stage takes as many as it has room for. An empty cast returns an empty
 * stage, which the caller replaces with the mascot.
 */
export const stageCast = (
  theme: OrgTheme,
  max = 4,
): { host: CastMember | null; others: CastMember[] } => {
  if (theme.cast.length === 0) return { host: null, others: [] };
  const host = theme.cast.find((m) => m.brand === null) ?? theme.cast[0];
  const others = theme.cast.filter((m) => m.id !== host.id).slice(0, max - 1);
  return { host, others };
};
