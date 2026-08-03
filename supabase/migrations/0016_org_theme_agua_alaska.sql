-- The shell learns to read `organizations.theme`, and Agua Alaska gets the first
-- real one. Nothing about this migration is Alaska-specific in the code it feeds:
-- `lib/tickets/theme.ts` parses any organization's row, and a campaign whose org
-- has no theme renders the Supergana look through the same components.
--
-- WHAT A THEME MAY DO, AND WHY THAT IS SO LITTLE
--
-- A tenant gets a logo and two colours. It does not get a stylesheet, a
-- component or a branch on the slug — that is the difference between a platform
-- and seven forks of a landing page. The colours divide by job, decided with the
-- client on 2026-08-03:
--
--   · ACTION stays Supergana yellow (#FFD93D). The ticket, the buttons and the
--     stamps are the product's vocabulary for "press this". A tenant repainting
--     them would be a tenant forking the product.
--   · BRAND is the tenant's: headline word, badges, progress fills. Identity,
--     never affordance.
--
-- `brand` and `brand_ink` are a pair because contrast is not decorative:
--   #0098E0 on cream #FAF7F0 = 3.0:1 — clears the large-text bar, misses the
--   4.5:1 body copy needs. It fills bars and sets display type.
--   #001C74 on cream        = 13.8:1 — everything small reads this one.
-- Both were sampled from the client's logo (the navy is 44% of its pixels);
-- Alaska has no brand book on file, so extraction was the honest route and
-- Eduardo validated the pair. Question 16 of `Alaska/PREGUNTAS_ABIERTAS.md` is
-- answered by this migration.
--
-- No `mascots` key yet: the artwork does not exist, and a theme pointing at a
-- 404 is worse than a theme with no mascot. It lands with the screens that use it.

UPDATE organizations
SET theme = jsonb_build_object(
  'logo_url',   '/brands/agua-alaska/logo.png',
  'logo_alt',   'Agua Alaska',
  'brand',      '#0098E0',
  'brand_ink',  '#001C74',
  'powered_by', true,
  'note',       'Colores muestreados del logo del cliente (sin manual de marca) y validados 2026-08-03. brand = azul cielo para rellenos y titulares; brand_ink = navy para cualquier texto chico.'
)
WHERE slug = 'agua-alaska';

-- Novamex keeps the Supergana look, but its row stops claiming otherwise: the
-- old `accent` key was written before a reader existed and names nothing the
-- parser looks for. Left explicit rather than deleted so the pending brand
-- answer keeps a home — the same reason 0012 seeded a note in the first place.
UPDATE organizations
SET theme = jsonb_build_object(
  'note',       'Sin logo ni colores de Novamex todavía: la campaña usa el sistema Supergana. Para co-marcar hace falta logo_url + brand + brand_ink (ver lib/tickets/theme.ts).',
  'powered_by', true
)
WHERE slug = 'novamex';
