// What the model can report about a photo, in the operator's language.
//
// Shared by the review panel and the readings screen so a raw key such as
// `suspicious_text` never reaches a person. Unknown keys (a newer model may add
// one) fall back to the key itself rather than disappearing.

export const ISSUE_MESSAGE: Record<string, string> = {
  cut_off: "La foto corta parte del ticket",
  blurry: "La foto está borrosa",
  screen_photo: "Parece la foto de una pantalla, no del papel",
  handwritten: "Hay texto escrito a mano",
  no_total: "No se ve el total",
  no_date: "No se ve la fecha",
  not_a_receipt: "Esto no parece un ticket de compra",
  suspicious_text: "El ticket trae texto que intenta dar instrucciones — revísalo con cuidado",
};

export const issueMessage = (issue: string): string => ISSUE_MESSAGE[issue] ?? issue;
