"use client";

/**
 * "This is what you will get": a small mock chat.
 *
 * Why it exists: Meta's authentication template is fixed, unbranded text and
 * arrives from a number people have not saved. Showing the message BEFORE it
 * arrives is what stops careful people from ignoring it as spam. It is an
 * illustration: nothing in it is a button or focusable. Styles: ./race-bib.css.
 */
export interface WhatsAppPreviewProps {
  /** "Así te va a llegar" */
  label: string;
  /** Who it seems to come from ("Un número que quizá no tengas guardado"). */
  from: string;
  /** Message text with an EXAMPLE code already interpolated. */
  body: string;
  /** The template's copy-code button label ("Copiar código"). */
  copy: string;
  /** One line under the bubble ("Es nuestro. Cópialo y vuelve aquí."). */
  note: string;
}

/** Splits the text around the first 4-digit run so the code can be bold. */
function renderBody(body: string) {
  const match = /\b\d{4}\b/.exec(body);
  if (!match) return body;
  const end = match.index + match[0].length;
  return (
    <>
      {body.slice(0, match.index)}
      <strong>{match[0]}</strong>
      {body.slice(end)}
    </>
  );
}

export function WhatsAppPreview({ label, from, body, copy, note }: WhatsAppPreviewProps) {
  return (
    <div className="wa-preview">
      <span className="tk-eyebrow wa-preview-label">{label}</span>

      <div className="wa-preview-chat">
        <div className="wa-preview-head">
          <svg className="wa-preview-avatar" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <circle cx="12" cy="12" r="12" fill="#c5cbc9" />
            <circle cx="12" cy="9.5" r="4" fill="#fff" />
            <path d="M4.5 20c.8-4 3.8-6 7.5-6s6.7 2 7.5 6z" fill="#fff" />
          </svg>
          <span className="wa-preview-from">{from}</span>
        </div>

        <div className="wa-preview-wall">
          <div className="wa-preview-bubble">
            <p className="wa-preview-text">{renderBody(body)}</p>
            {/* Real authentication templates carry a copy-code button; here it
                is a painted imitation, so it is deliberately not a <button>. */}
            <div className="wa-preview-copy">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <rect x="8.5" y="8.5" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
                <path
                  d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </svg>
              <span>{copy}</span>
            </div>
          </div>
        </div>
      </div>

      <p className="wa-preview-note">{note}</p>
    </div>
  );
}
