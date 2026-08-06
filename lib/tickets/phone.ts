// Moved to lib/platform/phone.ts on 2026-08-05, when the pick'em module needed
// the same rules and importing them out of a sibling module would have been a
// module depending on another module's internals.
//
// This file stays as a re-export rather than being deleted: three live call
// sites in the tickets console and its registration screen import from here,
// and rewriting their imports is a change to a running campaign five days
// before its client meeting, for no behavioural gain. Nothing here is a copy —
// there is one implementation and both modules read it.
//
// The imports can be repointed whenever tickets is next touched for its own
// reasons, and then this file goes.

export { normalizeMxPhone, formatMxPhone } from "@/lib/platform/phone";
