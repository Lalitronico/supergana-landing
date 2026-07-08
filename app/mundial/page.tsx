import { redirect } from "next/navigation";

// The campaign lives at /mundial/quiniela/ (Champions-style single page: the
// quiniela IS the page). /mundial/ is kept only as a friendly alias so any
// older link or the Stripe/business shorthand still lands in the right place.
export default function MundialPage() {
  redirect("/mundial/quiniela");
}
