"use client";

import { useState } from "react";

const FAQS = [
  {
    q: "¿Qué tan rápido pueden activar una quiniela?",
    a: "Entre 7 y 10 días desde el brief hasta el link publicable. Si el evento ya está corriendo (por ejemplo, Mundial en jornada de grupos), podemos arrancar en 48-72 horas con un kit reducido.",
  },
  {
    q: "¿Para qué tamaño de marca está pensado?",
    a: "Marcas medianas a grandes (B2C, retail, FMCG, servicios financieros, telecom, bebidas). Si tu audiencia social es de menos de 5,000, hay formatos más simples que pueden encajar mejor — lo conversamos en la demo.",
  },
  {
    q: "¿Cómo se mide el éxito?",
    a: "Definimos KPIs contigo desde el brief: participantes únicos, tasa de finalización, leads capturados, share rate, sentimiento. Al cierre entregamos un reporte con todo y recomendaciones para la siguiente activación.",
  },
  {
    q: "¿Quién es dueño de los datos capturados?",
    a: "Tú. Toda la captación lleva consentimiento explícito y los datos se entregan en CSV listo para tu CRM. Nosotros no usamos esos datos para nada más que tu campaña.",
  },
  {
    q: "¿Pueden integrarlo con mis canales actuales?",
    a: "Sí. La quiniela vive en una URL propia que puedes embeber, linkear o redirigir desde tu sitio, app o redes. Si necesitas integración con tu CRM o pixel de Meta/Google, lo hacemos.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: "Pago por campaña, no por suscripción. El precio depende del alcance, número de partidos y nivel de personalización visual. Te damos cotización exacta en la primera llamada.",
  },
  {
    q: "¿Qué necesitan de nosotros para empezar?",
    a: "Brief breve (objetivo, audiencia, fechas), guía de marca o ejemplos visuales, y una persona del equipo que pueda aprobar copy y visuales. Eso es todo.",
  },
  {
    q: "¿Funciona para empresas con planta operativa sin smartphone corporativo?",
    a: "Sí. La quiniela vive en un link o QR; cualquier celular personal, intranet o pantalla compartida en el comedor sirve. No hay app que descargar, ni cuentas que crear, ni VPN que configurar.",
  },
  {
    q: "¿Pueden integrar premios físicos de mi empresa?",
    a: "Sí. Tú defines y produces los premios (viajes, jerseys, kits parrilleros, días libres, bonos). Nosotros los integramos al kit visual, los anunciamos con las mascotas de Supergana y producimos la comunicación de ganadores para tus canales internos.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="border-b-[3px] border-ink bg-pink py-24 md:py-32"
    >
      <div className="mx-auto max-w-3xl px-5 md:px-8">
        <span className="text-xs font-bold uppercase tracking-wider">
          Preguntas frecuentes
        </span>
        <h2 className="font-display mt-3 text-4xl leading-tight md:text-6xl">
          Lo que se preguntan marketing y recursos humanos.
        </h2>

        <div className="mt-12 space-y-4">
          {FAQS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div
                key={i}
                className="cartoon-border cartoon-shadow rounded-2xl bg-cream"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-lg leading-snug md:text-xl">
                    {item.q}
                  </span>
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[3px] border-ink bg-yellow text-xl font-bold leading-none transition-transform ${
                      isOpen ? "rotate-45" : ""
                    }`}
                    aria-hidden
                  >
                    +
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t-[3px] border-ink px-6 py-5 text-[15px] leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
