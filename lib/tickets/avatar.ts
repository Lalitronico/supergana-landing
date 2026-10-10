// The character a participant picks as themselves ("elige tu personaje").
//
// `participants.avatar` stores a cast id from the campaign's org theme. The
// column only bounds the SHAPE of the value (0043); whether the id is a member
// of THIS campaign's cast is decided here, on the server, from the theme — a
// browser that posts "oso" to a campaign with no bear gets refused rather than
// storing a key nothing can draw.
//
// Three-way result on purpose. A profile save that does not mention `avatar`
// (an older client, a campaign without a cast) must leave the stored choice
// alone, which is different from the participant explicitly choosing none.

import type { CastMember } from "./theme.ts";

export type AvatarChoice =
  | { kind: "unchanged" }
  | { kind: "clear" }
  | { kind: "set"; id: string }
  | { kind: "invalid" };

export const parseAvatarChoice = (
  cast: Pick<CastMember, "id">[],
  raw: unknown,
): AvatarChoice => {
  if (raw === undefined) return { kind: "unchanged" };
  if (raw === null) return { kind: "clear" };
  if (typeof raw !== "string") return { kind: "invalid" };
  const id = raw.trim();
  return cast.some((member) => member.id === id) ? { kind: "set", id } : { kind: "invalid" };
};

// ---------------------------------------------------------------------------
// One answer to "which character is this participant?", everywhere
// ---------------------------------------------------------------------------
//
// A participant who never picked (older profiles, a skipped screen, a choice
// whose character was later removed from the cast) still has to be somebody on
// the panel, the leaderboard and the room's live screen. If each screen decided
// for itself, the same person would be a bear on one and a zebra on another —
// which is exactly what happened. So the decision lives here and is made once,
// on the server, from the participant's id: stable across reloads, devices and
// screens, and needing no stored state.

/** FNV-1a, 32 bit: tiny, dependency-free and identical on every runtime. */
const stableHash = (key: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i += 1) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

/**
 * The cast id to draw for a participant.
 *
 *   - the participant's own choice, when it is still a member of the cast;
 *   - otherwise a deterministic pick from the cast, by a stable hash of
 *     `participantKey` (use the participant id);
 *   - null when the campaign has no cast at all.
 */
export const resolveAvatar = (
  avatar: string | null | undefined,
  participantKey: string,
  cast: Pick<CastMember, "id">[],
): string | null => {
  if (cast.length === 0) return null;
  if (avatar && cast.some((member) => member.id === avatar)) return avatar;
  return cast[stableHash(participantKey) % cast.length].id;
};
