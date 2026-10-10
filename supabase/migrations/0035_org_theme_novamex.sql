-- Novamex co-brand theme, for the 2026-10-12 demo (campaign `tanque`) and,
-- by inheritance, for `ticket-al-tanque`.
--
-- No brand kit yet: the logo is the official SVG from novamex.com rasterised
-- to public/brands/novamex/logo.png (448×120, transparent), a placeholder
-- until the client sends theirs.
--
-- Colour pair, and why it is not Novamex's yellow:
--   Novamex's corporate colour is #FFB900. The theme's rule (lib/tickets/
--   theme.ts) is that ACTION stays Supergana yellow #FFD93D, and a brand yellow
--   two steps away from it would make identity and affordance unreadable as two
--   different things — besides failing as text on cream (1.61:1). The yellow
--   lives in the logo, where it belongs. Identity colour is Jarritos orange
--   #FD5000, sampled from jarritos.com's official logo: 3.10:1 on cream, which
--   clears the large-text bar the headline word uses. `brand_ink` #B83A00 is
--   the same hue darkened for small copy: 5.39:1 on cream.
-- Revisit both when the brand kit lands.
--
-- Mascots are added by a later migration once the art is final; a missing pose
-- simply does not render (Mascot.tsx).
update public.organizations
   set theme = jsonb_build_object(
         'note', 'Placeholder hasta recibir brand kit (2026-10-10). Logo oficial de novamex.com; brand = naranja Jarritos porque el amarillo Novamex choca con el amarillo de acción de Supergana.',
         'logo_url', '/brands/novamex/logo.png',
         'logo_alt', 'Novamex',
         'brand', '#FD5000',
         'brand_ink', '#B83A00',
         'powered_by', true
       )
 where slug = 'novamex';
