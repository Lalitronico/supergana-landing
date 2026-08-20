// Turning a phone number into a Supabase account, and back.
//
// WHY THIS EXISTS AT ALL. `participants.auth_user_id` is NOT NULL and every RLS
// policy in the platform is written against `auth.uid()`. A module whose door is
// a phone number still needs a row in `auth.users` and a real session, or every
// policy would have to be rewritten to trust something else — which is the one
// change nobody should make to get a nicer login screen.
//
// Supabase identifies an account by email, so a phone identity is given a
// synthetic one. It is DERIVED, never stored and never looked up: the same
// number always produces the same address, so `admin.createUser` +
// `admin.generateLink` can mint or find the account without `admin.listUsers`
// (which is O(n) paginated and would get slower with every participant).
//
// STRUCTURAL, NOT CONFIGURABLE. The domain below is half the primary key of
// every phone account ever created. Changing it does not migrate anybody — it
// orphans them, silently, because the next sign-in mints a brand new account
// with no points on it. That is exactly why it is a constant in the source and
// not an environment variable: moving it has to be a commit with a migration
// next to it, not a setting somebody edits in a dashboard at 11pm.

/**
 * Deliberately a subdomain of a domain we own and have verified with Meta, and
 * deliberately one that receives no mail. Nothing is ever sent here: the
 * accounts are created with `email_confirm: true` and their code arrives by
 * WhatsApp. A domain we did not own would be worse than useless — it would mean
 * password-reset mail for our participants landing in a stranger's inbox.
 */
const PHONE_EMAIL_DOMAIN = "wa.supergana.fun";

/** E.164 in, synthetic address out. `+526561112233` → `526561112233@wa.supergana.fun`. */
export const phoneAuthEmail = (phoneE164: string): string =>
  `${phoneE164.replace(/^\+/, "")}@${PHONE_EMAIL_DOMAIN}`;

/**
 * The inverse, and the reason this module is worth having.
 *
 * Every screen that used to print `user.email` would print
 * `526561112233@wa.supergana.fun` the moment a phone campaign existed. One
 * function decides what a phone identity is, `resolveParticipant` is the only
 * caller, and everything downstream sees either a real address or a real phone
 * number — never the plumbing.
 *
 * Returns null for anything that is not one of ours, including a real address
 * at a lookalike domain: the check is the whole domain, anchored, lowercased.
 */
export const phoneFromAuthEmail = (email: string | null | undefined): string | null => {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at <= 0) return null;
  if (email.slice(at + 1).toLowerCase() !== PHONE_EMAIL_DOMAIN) return null;

  const digits = email.slice(0, at);
  // Anchored, and length-bounded exactly like the `phone` CHECK constraint on
  // `participants` (0015). An address at our domain whose local part is not a
  // number is not a phone identity — it is something nobody meant to create.
  if (!/^[0-9]{10,15}$/.test(digits)) return null;
  return `+${digits}`;
};

/** Whether this session's address is plumbing rather than a way to reach anyone. */
export const isPhoneIdentity = (email: string | null | undefined): boolean =>
  phoneFromAuthEmail(email) !== null;
