// Bilingual copy for the participant app. Transcreation, not translation —
// the brief is explicit that a US Hispanic campaign reads as two native
// experiences, not one translated into the other.
//
// Both dictionaries are forced to hold the same keys by the `Dict` type, so a
// forgotten string is a build error rather than a Spanish word on an English
// screen. Placeholders are `{name}`; run values through `fill()`.

import type { Locale } from "./config";

const es = {
  // ---- chrome -------------------------------------------------------------
  appName: "supergana",
  draftRibbon: "Borrador · campaña sin publicar",
  langLabel: "Idioma",
  navHome: "Inicio",
  navUpload: "Subir ticket",
  navPanel: "Mi panel",
  loading: "Cargando…",
  back: "Volver",
  close: "Cerrar",

  // ---- home ---------------------------------------------------------------
  heroEyebrow: "{org} te premia",
  heroTitle: "Tu compra te lleva más lejos",
  heroTitleMark: "más lejos",
  heroSub:
    "Compra {min} en productos participantes, sube tu ticket y recibe una recompensa digital de {reward}.",
  heroCta: "Subir mi ticket",
  heroCtaSignedIn: "Continuar",
  quotaLabel: "Recompensas disponibles esta semana",
  quotaLeft: "quedan {left} de {total}",
  quotaNote:
    "Se liberan nuevas recompensas cada lunes. Una recompensa por participante/hogar.",
  quotaEmpty: "Se agotaron las recompensas de esta semana",
  quotaEmptyNote:
    "Vuelve el lunes: se libera un nuevo bloque. Tu ticket sigue siendo válido dentro del periodo de la promoción.",
  howTitle: "¿Cómo funciona?",
  // Split lead/rest so the bold half is a real string in each language instead
  // of a substring the UI has to carve out of a longer sentence.
  how1Lead: "Compra {min}",
  how1Rest: "en productos participantes en una sola visita.",
  how2Lead: "Sube tu ticket",
  how2Rest: "con tu teléfono. Toma menos de un minuto.",
  how3Lead: "Recibe {reward}",
  how3Rest: "en recompensa digital cuando tu ticket sea validado.",
  brandsTitle: "Marcas participantes",
  brandsNote:
    "Lista ilustrativa. La lista final de marcas y presentaciones se define con {org}.",
  statesTitle: "Dónde aplica",
  statesNote: "Promoción válida para residentes de: {states}.",
  legalHome:
    "Aplican términos: compra mínima en una sola transacción, calculada después de descuentos y antes de impuestos. Recompensas semanales limitadas y sujetas al fondo disponible. Debes tener 18 años o más.",
  rulesLink: "Reglas oficiales",

  // ---- sign in ------------------------------------------------------------
  authTitle: "Entra con tu email",
  // Sin número de dígitos en el copy: la longitud del OTP es configuración de
  // Supabase (6 a 10) y prometer "6" en pantalla se vuelve mentira sola.
  authSub: "Te mandamos un código de un solo uso a tu correo.",
  authEmail: "Email",
  authSend: "Enviar código",
  authSending: "Enviando…",
  authCodeTitle: "Revisa tu correo",
  authCodeSub: "Escribimos a {email}. Escribe el código que te enviamos.",
  authCode: "Código",
  authVerify: "Entrar",
  authVerifying: "Verificando…",
  authResend: "Reenviar código",
  authWrongEmail: "Usar otro email",
  authSignOut: "Cerrar sesión",

  // ---- password auth ------------------------------------------------------
  authPwTitle: "Entra a tu cuenta",
  authPwSub: "Con tu correo y tu contraseña.",
  fPassword: "Contraseña",
  fPassword2: "Confirma tu contraseña",
  authSignIn: "Entrar",
  authSigningIn: "Entrando…",
  authForgot: "¿Olvidaste tu contraseña?",
  authOtpAlt: "Entrar con un código por correo",
  authPwAlt: "Entrar con contraseña",
  authHaveAccount: "¿Ya tienes cuenta? Entra",
  authNoAccount: "Crear una cuenta nueva",
  acTitle: "Crea tu cuenta",
  acSub: "Tu recompensa llega a este correo: escríbelo con cuidado.",
  acBtn: "Crear cuenta y continuar",
  acCreating: "Creando…",
  recTitle: "Recupera tu contraseña",
  recSub: "Te enviamos un enlace a tu correo para elegir una nueva.",
  recBtn: "Enviar enlace",
  recSent:
    "Si existe una cuenta con ese correo, el enlace ya va en camino. Revisa también tu carpeta de spam.",
  rsTitle: "Elige tu contraseña nueva",
  rsSub: "Mínimo 8 caracteres.",
  rsBtn: "Guardar contraseña",
  rsSaving: "Guardando…",
  rsDone: "Listo, tu contraseña quedó guardada.",
  pnChangePw: "Cambiar mi contraseña",

  // ---- points & prizes ----------------------------------------------------
  ptsTitle: "Mis puntos",
  ptsUnit: "puntos",
  ptsRate: "Ganas {rate} puntos por cada dólar elegible de tus tickets aprobados.",
  ptsNext: "Te faltan {points} puntos para: {prize}",
  ptsAllDone: "Alcanzaste todos los premios del catálogo. 🏆",
  ptsEmpty: "Sube un ticket y empieza a sumar puntos con cada compra aprobada.",
  przTitle: "Premios por puntos",
  przUnlocked: "¡Alcanzado!",
  przAt: "{points} pts",
  przNote:
    "Premios de acumulación: se alcanzan por puntos, sin sorteos. Canje con el equipo de la promoción.",

  // ---- email verification -------------------------------------------------
  veTitle: "Confirma tu correo",
  veBody:
    "Tu recompensa se envía a {email}. Confirma que este correo es tuyo para poder liberarla.",
  veSend: "Enviarme el código",
  veSent: "Te enviamos un código de 6 dígitos. Escríbelo aquí:",
  veConfirm: "Confirmar",
  veDone: "Correo verificado. Tu recompensa quedó liberada para envío.",
  errVeCode: "El código no es correcto.",
  errVeExpired: "El código venció. Pide uno nuevo.",
  errVeAttempts: "Demasiados intentos. Pide un código nuevo.",
  homeAccountQ: "¿Ya participas?",
  homeSignIn: "Entrar a mi cuenta",
  homeCreate: "Crear mi cuenta",
  homeGoPanel: "Ir a mi panel",

  // ---- register -----------------------------------------------------------
  regStep: "Paso {n} de 3",
  regTitle: "Completa tu perfil",
  regSub: "Solo pedimos lo necesario para validar tu recompensa.",
  fName: "Nombre",
  fLast: "Apellido",
  fZip: "Código postal (ZIP)",
  fState: "Estado",
  fStatePick: "Elige tu estado",
  fLangPref: "Idioma preferido",
  chkAge: "Confirmo que tengo 18 años o más y resido en un estado elegible.",
  chkRules: "Acepto las reglas oficiales y el aviso de privacidad.",
  chkMkt: "Quiero recibir noticias y promociones de {org} por email. (Opcional)",
  regBtn: "Guardar y continuar",
  regSaving: "Guardando…",
  regNote:
    "Guardamos la fecha y la versión de las reglas que aceptas. El consentimiento de marketing es independiente y puedes retirarlo cuando quieras.",

  // ---- capture ------------------------------------------------------------
  capTitle: "Sube tu ticket",
  capSub: "Captura el ticket completo, de la tienda a la fecha y el total.",
  capQ1: "Ticket completo, sin recortes",
  capQ2: "Fecha y tienda visibles",
  capQ3: "Total y productos legibles",
  capPick: "Tomar foto o elegir imagen",
  capChange: "Cambiar imagen",
  capSend: "Enviar ticket",
  capSending: "Subiendo…",
  capNote: "Consejo: apóyalo sobre una superficie plana y evita sombras.",
  capEmpty: "Encuadra el ticket completo",
  capPreviewAlt: "Vista previa del ticket",

  // ---- processing ---------------------------------------------------------
  prcTitle: "Estamos revisando tu ticket",
  prcSub: "Te avisaremos por email. Tiempo estimado: menos de {hours} horas.",
  st1: "Recibido",
  st1d: "Tu ticket llegó correctamente.",
  st2: "En revisión",
  st2d: "Leemos tienda, fecha, productos y total.",
  st3: "Validación",
  st3d: "Comparamos contra los productos participantes.",
  st4: "Resultado",
  st4d: "Aprobado, o te pedimos una imagen nueva.",

  // ---- panel --------------------------------------------------------------
  pnTitle: "Mi panel",
  pnHello: "Hola, {name}",
  pnEmpty: "Todavía no has subido ningún ticket.",
  pnEmptyCta: "Subir mi primer ticket",
  pnHistTitle: "Mis tickets",
  pnUploadAnother: "Subir otro ticket",
  pnReceiptOn: "Ticket del {date}",
  pnRewardTitle: "Tu recompensa",
  pnRewardAmount: "{amount}",
  pnRewardSub:
    "Enviamos tu recompensa digital al correo con el que te registraste.",
  pnRewardPending:
    "Aprobado. Estamos preparando el envío de tu recompensa digital.",
  pnRejected: "Motivo: {reason}",
  pnNeedsNewImage:
    "Necesitamos una foto nueva de este ticket. Sube el ticket completo, bien iluminado.",
  pnRewardedAlready:
    "Ya recibiste la recompensa de bienvenida de esta campaña: es una por participante/hogar.",

  // ---- statuses -----------------------------------------------------------
  stReceived: "Recibido",
  stInReview: "En revisión",
  stApproved: "Aprobado",
  stRejected: "Rechazado",
  stNeedsNewImage: "Imagen nueva",
  rwReserved: "En preparación",
  rwQueued: "En cola de envío",
  rwSent: "Enviada",
  rwDelivered: "Entregada",
  rwFailed: "Falló el envío",
  rwCanceled: "Cancelada",

  // ---- errors -------------------------------------------------------------
  errGeneric: "Algo salió mal. Vuelve a intentarlo.",
  errNetwork: "No pudimos conectar. Revisa tu conexión e intenta de nuevo.",
  errEmail: "Escribe un email válido.",
  errCode: "El código no es correcto o ya venció. Pide uno nuevo.",
  errTooManyCodes: "Pediste códigos muy seguido. Espera un minuto y vuelve a intentar.",
  errMailBudget:
    "Ahora mismo no podemos enviarte el código. No es tu culpa: ya avisamos al equipo. Intenta de nuevo más tarde.",
  errRequired: "Completa los campos obligatorios.",
  errZip: "El ZIP debe tener 5 dígitos.",
  errConsents: "Debes confirmar tu edad y aceptar las reglas para continuar.",
  errState: "Esta promoción todavía no aplica en tu estado.",
  errFileType: "Formato no admitido. Usa una foto JPG, PNG, WEBP o HEIC.",
  errFileSize: "La imagen pesa más de 10 MB. Toma la foto de nuevo.",
  errDuplicateImage: "Ya recibimos esta misma imagen. Sube una foto del ticket original.",
  errClosed: "Esta campaña no está recibiendo tickets en este momento.",
  errPendingReceipt:
    "Ya tienes un ticket en revisión. Te avisamos en cuanto tengamos el resultado.",
  errNotSignedIn: "Tu sesión expiró. Entra otra vez con tu email.",
  errPwShort: "La contraseña debe tener al menos 8 caracteres.",
  errPwMatch: "Las contraseñas no coinciden.",
  errBadLogin: "Correo o contraseña incorrectos.",
  errAccountExists:
    "Ya existe una cuenta con este correo. Entra con tu contraseña o recupérala.",

  // ---- misc ---------------------------------------------------------------
  poweredBy: "Operado por Supergana",
  privacyNote:
    "Tu ticket contiene datos personales. Lo guardamos cifrado y solo lo ve el equipo de validación.",
} as const;

type Dict = Record<keyof typeof es, string>;

const en: Dict = {
  appName: "supergana",
  draftRibbon: "Draft · campaign not published",
  langLabel: "Language",
  navHome: "Home",
  navUpload: "Upload receipt",
  navPanel: "My panel",
  loading: "Loading…",
  back: "Back",
  close: "Close",

  heroEyebrow: "{org} rewards you",
  heroTitle: "Your purchase takes you further",
  heroTitleMark: "further",
  heroSub:
    "Buy {min} in participating products, upload your receipt, and get a {reward} digital reward.",
  heroCta: "Upload my receipt",
  heroCtaSignedIn: "Continue",
  quotaLabel: "Rewards available this week",
  quotaLeft: "{left} of {total} left",
  quotaNote: "New rewards are released every Monday. One reward per participant/household.",
  quotaEmpty: "This week's rewards are gone",
  quotaEmptyNote:
    "Come back Monday for the next block. Your receipt is still valid within the promotion period.",
  howTitle: "How it works",
  how1Lead: "Buy {min}",
  how1Rest: "in participating products in a single trip.",
  how2Lead: "Upload your receipt",
  how2Rest: "from your phone. It takes under a minute.",
  how3Lead: "Get {reward}",
  how3Rest: "in digital rewards once your receipt is validated.",
  brandsTitle: "Participating brands",
  brandsNote: "Illustrative list. Final brands and sizes to be defined with {org}.",
  statesTitle: "Where it applies",
  statesNote: "Open to residents of: {states}.",
  legalHome:
    "Terms apply: minimum purchase in a single transaction, calculated after discounts and before tax. Weekly rewards are limited and subject to available funds. Must be 18 or older.",
  rulesLink: "Official rules",

  authTitle: "Sign in with your email",
  authSub: "We'll email you a single-use code.",
  authEmail: "Email",
  authSend: "Send code",
  authSending: "Sending…",
  authCodeTitle: "Check your inbox",
  authCodeSub: "We wrote to {email}. Enter the code we sent you.",
  authCode: "Code",
  authVerify: "Sign in",
  authVerifying: "Verifying…",
  authResend: "Resend code",
  authWrongEmail: "Use a different email",
  authSignOut: "Sign out",

  authPwTitle: "Sign in to your account",
  authPwSub: "With your email and password.",
  fPassword: "Password",
  fPassword2: "Confirm your password",
  authSignIn: "Sign in",
  authSigningIn: "Signing in…",
  authForgot: "Forgot your password?",
  authOtpAlt: "Sign in with an emailed code",
  authPwAlt: "Sign in with a password",
  authHaveAccount: "Already have an account? Sign in",
  authNoAccount: "Create a new account",
  acTitle: "Create your account",
  acSub: "Your reward is delivered to this email — type it carefully.",
  acBtn: "Create account and continue",
  acCreating: "Creating…",
  recTitle: "Recover your password",
  recSub: "We'll email you a link to choose a new one.",
  recBtn: "Send link",
  recSent:
    "If an account exists for that email, the link is on its way. Check your spam folder too.",
  rsTitle: "Choose your new password",
  rsSub: "At least 8 characters.",
  rsBtn: "Save password",
  rsSaving: "Saving…",
  rsDone: "Done — your password is saved.",
  pnChangePw: "Change my password",

  ptsTitle: "My points",
  ptsUnit: "points",
  ptsRate: "You earn {rate} points per eligible dollar on approved receipts.",
  ptsNext: "{points} points to go for: {prize}",
  ptsAllDone: "You've reached every prize in the catalog. 🏆",
  ptsEmpty: "Upload a receipt and start earning points with every approved purchase.",
  przTitle: "Prizes by points",
  przUnlocked: "Reached!",
  przAt: "{points} pts",
  przNote:
    "Accumulation prizes: reached by points, no drawings involved. Redeem with the promotion team.",

  veTitle: "Confirm your email",
  veBody:
    "Your reward is delivered to {email}. Confirm this address is yours so it can be released.",
  veSend: "Send me the code",
  veSent: "We sent you a 6-digit code. Enter it here:",
  veConfirm: "Confirm",
  veDone: "Email verified. Your reward is cleared for delivery.",
  errVeCode: "That code isn't right.",
  errVeExpired: "The code expired. Request a new one.",
  errVeAttempts: "Too many tries. Request a new code.",
  homeAccountQ: "Already participating?",
  homeSignIn: "Sign in to my account",
  homeCreate: "Create my account",
  homeGoPanel: "Go to my panel",

  regStep: "Step {n} of 3",
  regTitle: "Complete your profile",
  regSub: "We only ask for what's needed to validate your reward.",
  fName: "First name",
  fLast: "Last name",
  fZip: "ZIP code",
  fState: "State",
  fStatePick: "Pick your state",
  fLangPref: "Preferred language",
  chkAge: "I confirm I am 18+ and reside in an eligible state.",
  chkRules: "I accept the official rules and the privacy notice.",
  chkMkt: "I want to receive {org} news and offers by email. (Optional)",
  regBtn: "Save and continue",
  regSaving: "Saving…",
  regNote:
    "We record the date and the rules version you accept. Marketing consent is separate and you can withdraw it at any time.",

  capTitle: "Upload your receipt",
  capSub: "Capture the whole receipt, from store name to date and total.",
  capQ1: "Full receipt, no cropping",
  capQ2: "Date and store visible",
  capQ3: "Total and products readable",
  capPick: "Take a photo or pick an image",
  capChange: "Change image",
  capSend: "Submit receipt",
  capSending: "Uploading…",
  capNote: "Tip: lay it on a flat surface and avoid shadows.",
  capEmpty: "Frame the entire receipt",
  capPreviewAlt: "Receipt preview",

  prcTitle: "We're reviewing your receipt",
  prcSub: "We'll email you. Estimated time: under {hours} hours.",
  st1: "Received",
  st1d: "Your receipt arrived correctly.",
  st2: "In review",
  st2d: "We read store, date, products and total.",
  st3: "Validation",
  st3d: "We match it against the participating products.",
  st4: "Result",
  st4d: "Approved, or we ask for a new photo.",

  pnTitle: "My panel",
  pnHello: "Hi, {name}",
  pnEmpty: "You haven't uploaded a receipt yet.",
  pnEmptyCta: "Upload my first receipt",
  pnHistTitle: "My receipts",
  pnUploadAnother: "Upload another receipt",
  pnReceiptOn: "Receipt from {date}",
  pnRewardTitle: "Your reward",
  pnRewardAmount: "{amount}",
  pnRewardSub: "We're sending your digital reward to the email you signed up with.",
  pnRewardPending: "Approved. We're preparing your digital reward.",
  pnRejected: "Reason: {reason}",
  pnNeedsNewImage:
    "We need a new photo of this receipt. Upload the full receipt, well lit.",
  pnRewardedAlready:
    "You already claimed this campaign's welcome reward — it's one per participant/household.",

  stReceived: "Received",
  stInReview: "In review",
  stApproved: "Approved",
  stRejected: "Rejected",
  stNeedsNewImage: "New image",
  rwReserved: "Preparing",
  rwQueued: "Queued",
  rwSent: "Sent",
  rwDelivered: "Delivered",
  rwFailed: "Delivery failed",
  rwCanceled: "Canceled",

  errGeneric: "Something went wrong. Please try again.",
  errNetwork: "We couldn't connect. Check your connection and try again.",
  errEmail: "Enter a valid email address.",
  errCode: "That code is wrong or expired. Request a new one.",
  errTooManyCodes: "You've requested codes too quickly. Wait a minute and try again.",
  errMailBudget:
    "We can't send your code right now. This isn't your fault — the team has been notified. Please try again later.",
  errRequired: "Please fill in the required fields.",
  errZip: "ZIP must be 5 digits.",
  errConsents: "You must confirm your age and accept the rules to continue.",
  errState: "This promotion isn't available in your state yet.",
  errFileType: "Unsupported format. Use a JPG, PNG, WEBP or HEIC photo.",
  errFileSize: "That image is over 10 MB. Please retake the photo.",
  errDuplicateImage: "We already received this exact image. Upload a photo of the original receipt.",
  errClosed: "This campaign isn't accepting receipts right now.",
  errPendingReceipt: "You already have a receipt in review. We'll let you know the result.",
  errNotSignedIn: "Your session expired. Sign in again with your email.",
  errPwShort: "Password must be at least 8 characters.",
  errPwMatch: "Passwords don't match.",
  errBadLogin: "Wrong email or password.",
  errAccountExists:
    "An account with this email already exists. Sign in with your password or recover it.",

  poweredBy: "Operated by Supergana",
  privacyNote:
    "Your receipt holds personal data. We store it encrypted and only the validation team sees it.",
};

export const COPY: Record<Locale, Dict> = { es, en };

export type CopyKey = keyof Dict;

/** Replaces `{name}` placeholders. Missing values are left visible on purpose. */
export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );

export const translator =
  (locale: Locale) =>
  (key: CopyKey, values?: Record<string, string | number>): string => {
    const template = COPY[locale][key];
    return values ? fill(template, values) : template;
  };

export type Translate = ReturnType<typeof translator>;

// Status → copy key, so the mapping lives in one place instead of in each view.
export const RECEIPT_STATUS_KEY = {
  received: "stReceived",
  in_review: "stInReview",
  approved: "stApproved",
  rejected: "stRejected",
  needs_new_image: "stNeedsNewImage",
} as const satisfies Record<string, CopyKey>;

export const REWARD_STATUS_KEY = {
  reserved: "rwReserved",
  queued: "rwQueued",
  sent: "rwSent",
  delivered: "rwDelivered",
  failed: "rwFailed",
  canceled: "rwCanceled",
} as const satisfies Record<string, CopyKey>;

/**
 * Machine codes raised by `tickets_approve_receipt` → participant-facing copy.
 * Kept here so the reviewer's console and the participant's panel never drift
 * into saying different things about the same rejection.
 */
export const APPROVAL_ERROR_KEY: Record<string, CopyKey> = {
  below_threshold: "errGeneric",
  duplicate_receipt: "errDuplicateImage",
  participant_limit: "pnRewardedAlready",
  household_limit: "pnRewardedAlready",
  weekly_quota: "quotaEmpty",
  slots_exhausted: "quotaEmpty",
  fund_exhausted: "quotaEmpty",
};
