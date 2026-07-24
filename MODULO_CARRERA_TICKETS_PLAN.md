# Módulo Carrera de Tickets — plan de implementación

*Escrito 2026-07-24. **Este es el módulo prioritario**, por delante de Quinielas
(ver `MODULO_QUINIELAS_PLAN.md`, diferido): Novamex es el cliente cercano y lo
que hace falta ya no es un demo sino la infraestructura.*

## Por qué este módulo no lleva fase de demo

Para Quinielas recomendé demo primero y backend después. **Aquí no aplica: la
fase de demo ya está hecha.** Existen prototipados el flujo del participante y
la consola de operación. Lo que falta es el sistema real.

Material fuente, en orden de autoridad:

1. `../Novamex x Supergana/Contexto/BRIEF_MAESTRO_NOVAMEX_SUPERGANA.md` — 910
   líneas, **la fuente de verdad** de mecánica, economía y alcance comercial.
2. `../Novamex x Supergana/entregables/src/demo-participante.template.html` —
   flujo del participante, bilingüe. Pantallas: `home → register → capture →
   processing → reward → panel → rank`.
3. `../Novamex x Supergana/entregables/src/demo-admin.template.html` — consola
   de operación: cola de revisión, auditoría, cumplimiento, catálogo y reglas,
   embudo, consentimientos, exportar conciliación, fondo restante.

Los tres usan los mismos tokens que `app/globals.css`.

## Alcance acordado para la v1

**Solo el flujo de recompensa**: registro → subir ticket → revisión → $20
entregados. Es el compromiso central con Novamex y lo que hace que el piloto
exista.

Fuera de la v1, a la v1.1: puntos, misiones, topes semanales, leaderboard
(Carrera de Tickets) y el sorteo del premio mayor. El sorteo además arrastra
AMOE y posible registro estatal (NY/FL sobre $5,000), y el premio mayor es de
$2,400 — no hay razón para cargar eso en la primera entrega.

**Validación: cola de revisión manual.** Decidido. Es lo que el propio demo
promete al participante (*"menos de 48 horas"*, *"te pedimos una imagen
nueva"*), lo que la consola ya tiene diseñado, y lo que encaja con el modelo
managed. El OCR entra después como pre-filtro, sin cambiar la experiencia del
participante — la promesa de 48h ya absorbe ambas implementaciones.

## Estructura legal — es restricción de construcción, no de copy

| Capa | Mecánica | Régimen |
|---|---|---|
| Recompensa $20 | Compra $10 → recompensa **garantizada por umbral** | Sin azar |
| Carrera de Tickets (v1.1) | Puntos por acumulación, tope 40/semana | Acumulación |
| Premio mayor (v1.1) | Sorteo **con entrada gratuita alternativa** | AMOE |

El demo dice literalmente *"Comprar no mejora tus probabilidades"*. **Si el
build llega a amarrar el sorteo a la compra, se convierte en lotería privada
ilegal en EE.UU.** No es un texto que se pueda ajustar después: cambia el
régimen de toda la promoción. Ver el patrón "separar el dinero del azar" en
`../SUPERGANA_PLATAFORMA_FUNDAMENTOS.md`.

## Multi-tenant desde el día uno

Regla del usuario: *"los módulos son la infraestructura que iremos cambiando
entre marcas"*. Novamex es la campaña #1, no la aplicación.

Todo esto es **configuración de campaña, no código**: catálogo de productos y
sus alias, umbrales ($10 → $20), cupo semanal (150) y su liberación, límite por
hogar, estados elegibles, fondo, idiomas, y todo el copy.

## Schema propuesto (a validar contra el brief antes de migrar)

```sql
organizations   (id, slug, name, theme jsonb)
campaigns       (id, org_id, slug, name, status, starts_at, ends_at,
                 locales text[], config jsonb)
                 -- config: min_purchase_cents, reward_cents, weekly_quota,
                 --         per_household_limit, eligible_states[]

participants    (id, campaign_id, auth_user_id, email, first_name, last_name,
                 zip, locale, created_at)
consents        (id, participant_id, kind, version, accepted_at, ip)
                 -- kind: age_state | official_rules | marketing

products        (id, campaign_id, brand, name, size)
product_aliases (id, product_id, retailer, alias_text)

receipts        (id, participant_id, campaign_id, image_path, status,
                 submitted_at, reviewed_at, reviewed_by, store_name,
                 purchase_date, total_cents, eligible_cents, reject_reason,
                 image_hash, dedupe_key)
receipt_items   (id, receipt_id, product_id, alias_matched, line_text, amount_cents)

rewards         (id, participant_id, receipt_id, amount_cents, provider,
                 provider_ref, status, sent_at)
```

Estados del ticket: `received → in_review → approved | rejected | needs_new_image`.

### El detalle que decide si la validación funciona

`product_aliases` no es opcional. En la consola de admin ya aparece el campo
**"Alias en ticket (por retailer)"**: el mismo producto se imprime distinto
según la tienda — `CAMARONAZO 32OZ` vs `CAMARONAZO TOM`, `DGARI FRESA` vs
`D GARI GEL FRSA`. Cualquier modelo que asuma "un producto, un nombre" falla
en el primer ticket real.

### Antifraude que la v1 sí necesita

El demo no lo muestra, pero sin esto el piloto se rompe:

- **Deduplicación de tickets**: `dedupe_key` sobre (tienda + fecha + total).
  Es el abuso más común y el más barato de bloquear.
- **Hash de imagen** para cachar re-subidas del mismo archivo.
- **Límite por hogar**: definir qué es "hogar" — ¿email?, ¿ZIP + apellido?
  El demo dice *"una recompensa por participante/hogar"* pero no lo define.
  **Pendiente de decidir con el brief.**
- **Cupo semanal** con liberación los lunes (150/semana), para que el fondo no
  se vacíe en días.

### Cumplimiento

- Consentimientos guardados con timestamp **y versión de las reglas** — si las
  reglas cambian a media campaña hay que saber quién aceptó cuál.
- Verificación de estado elegible y 18+.
- **Acumulado de valor entregado por participante por año fiscal**: el umbral
  1099 es $600/ganador/año en EE.UU. El schema debe permitir consultarlo sin
  reprocesar.

## Rutas

- `app/c/[campana]/` — participante, bilingüe es/en.
- `app/admin/[campana]/` — consola de operación.

El `[campana]` es el tenant. Ya existe `app/admin/mundial/` como precedente de
panel operativo; revisarlo antes de inventar patrones nuevos.

## Piezas de infraestructura

1. **App del participante** (5 pantallas de la v1: home, register, capture,
   processing, reward). Bilingüe desde el inicio — es campaña de EE.UU.
2. **Cola de revisión** en la consola: imagen + captura de tienda/fecha/total/
   productos + aprobar / rechazar / pedir imagen nueva.
3. **Entrega de recompensas**: Tremendous. Empezar por el sandbox gratuito y
   **validar el catálogo real de gift cards antes de prometer marcas
   específicas**. Recordar: gift cards de supermercados participantes, decisión
   antiarbitraje ya tomada en el pitch.
4. **Notificaciones por email** en cada cambio de estado. `RESEND_API_KEY` ya
   aparece como env var opcional del proyecto.
5. **Almacenamiento de imágenes**: Supabase Storage, con RLS. Son datos
   personales — el ticket lleva ubicación, fecha y hábitos de compra.

## Orden sugerido

1. Schema + migración, verificada contra el brief.
2. Registro + consentimientos (lo que desbloquea todo lo demás).
3. Subida de ticket + almacenamiento + deduplicación.
4. Cola de revisión en la consola. **Aquí el piloto ya es operable a mano.**
5. Tremendous en sandbox → entrega real.
6. Emails de estado.

Después de 4 el sistema ya sirve para correr el piloto aunque la entrega sea
manual. Ese es el punto en que se le puede enseñar a Novamex.

## Contexto comercial que afecta decisiones técnicas

- Fondo **$30,000**. Escenario piloto: 2,000 × $10. Fase 0 pagada de $10,000
  acreditable.
- **Novamex ya corrió $15→$5 con Snipp** — hay precedente y expectativas
  formadas sobre tiempos y experiencia. Vale revisar qué hizo bien Snipp.
- La consola ya contempla "Exportar conciliación" y "Fondo restante": el
  cliente va a querer cuadrar dinero, no solo ver métricas.

## Antes de escribir código

Leer el `BRIEF_MAESTRO` completo. Este documento es el plan de construcción; el
brief es la fuente de verdad de la mecánica y la economía, y tiene 910 líneas
que no están resumidas aquí.
