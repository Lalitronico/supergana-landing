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
