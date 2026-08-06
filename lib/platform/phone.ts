// Mexican mobile numbers, for campaigns whose prizes arrive on a phone.
//
// The rules are lifted from the Chapa NFL Pick'em handoff
// (handoff/02-IDENTIDAD-Y-AUTH.md, "Normalización — no negociable"), where the
// number is the primary key of an 18-week season. Nothing else from that
// document is here: no WhatsApp, no OTP, no verification. This module only
// answers "what did this person actually type", because the reason the rules
// exist survives the loss of the rest — the same person typing their number
// two different ways must not become two rows the operator tops up twice.
//
// One country. `+52` is hardcoded because the campaign that needs this is
// Mexican and a country picker is a question with no right answer until a
// second country asks it. When one does, the country belongs in the campaign's
// config next to `profile_fields`, not in a select the participant has to read.

/** The five ways a Mexican number gets typed, and what they all mean. */
const MX_COUNTRY = "52";

/**
 * "656 111 2233", "+52 656 111 2233", "044 656 111 2233" → "+526561112233".
 * Returns null when what is left is not a 10-digit national number, because a
 * half-understood number is worse than a rejected one: it looks stored.
 */
export const normalizeMxPhone = (raw: string): string | null => {
  const typed = String(raw ?? "").trim();

  // One rule the handoff does not need and this campaign does: a written-out
  // country code that is not Mexico's is a different country, not a spelling
  // of a Mexican number. Without this, "+1 915 555 0134" loses its plus, looks
  // like the legacy 1-marker below, and becomes +52 915 555 0134 — a real
  // number belonging to somebody else, which is where the recarga would land.
  // Ciudad Juárez is a border market; US numbers get typed into this box.
  if (typed.startsWith("+") && !/^\+\s*52/.test(typed)) return null;

  let digits = typed.replace(/\D/g, "");

  // "52 656 111 2233" — country code typed without the plus.
  if (digits.length === 12 && digits.startsWith(MX_COUNTRY)) {
    digits = digits.slice(2);
  }
  // "521 656 111 2233" — the 1 is the pre-2019 mobile marker. It still shows up
  // in old address books and in how people recite their own number, so it gets
  // absorbed rather than rejected.
  if (digits.length === 13 && digits.startsWith(`${MX_COUNTRY}1`)) {
    digits = digits.slice(3);
  }
  // "044 …" / "045 …" — the national long-distance prefixes retired in the same
  // 2019 change, and still printed on plenty of business cards.
  if (digits.length === 13 && (digits.startsWith("044") || digits.startsWith("045"))) {
    digits = digits.slice(3);
  }
  // "1 656 111 2233" — the marker with the country code already stripped above.
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }

  return digits.length === 10 ? `+${MX_COUNTRY}${digits}` : null;
};

/**
 * "+526561112233" → "+52 656 111 2233". Shown back to the participant before
 * they commit, so the number they see confirmed is the number we will dial —
 * silently reformatting somebody's phone number is how a recarga goes nowhere.
 */
export const formatMxPhone = (e164: string): string =>
  e164.replace(/^\+52(\d{3})(\d{3})(\d{4})$/, "+52 $1 $2 $3");
