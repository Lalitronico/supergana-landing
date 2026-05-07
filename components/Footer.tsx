import { SITE } from "@/lib/config";

export function Footer() {
  return (
    <footer className="bg-ink py-16 text-cream">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="font-display text-3xl">
              {SITE.name}
              <span className="text-red">.</span>
            </p>
            <p className="mt-3 max-w-sm text-sm opacity-70">
              Quinielas listas para tu marca. Activaciones llave en mano para
              cada momento deportivo.
            </p>
          </div>
          <div className="md:col-span-3">
            <p className="text-xs font-bold uppercase tracking-wider opacity-60">
              Producto
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#como-funciona" className="hover:text-yellow">
                  Cómo funciona
                </a>
              </li>
              <li>
                <a href="#kit" className="hover:text-yellow">
                  Qué incluye
                </a>
              </li>
              <li>
                <a href="#casos" className="hover:text-yellow">
                  Casos
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-yellow">
                  FAQ
                </a>
              </li>
            </ul>
          </div>
          <div className="md:col-span-4">
            <p className="text-xs font-bold uppercase tracking-wider opacity-60">
              Hablemos
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a
                  href={SITE.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-yellow"
                >
                  Agendar demo
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SITE.contactEmail}`}
                  className="hover:text-yellow"
                >
                  {SITE.contactEmail}
                </a>
              </li>
              <li>
                <a
                  href={SITE.social.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-yellow"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href={SITE.social.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-yellow"
                >
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-cream/15 pt-6 text-xs opacity-60">
          <p>© {new Date().getFullYear()} {SITE.name}. Hecho con balón en mano.</p>
          <p>Datos tratados con consentimiento explícito.</p>
        </div>
      </div>
    </footer>
  );
}
