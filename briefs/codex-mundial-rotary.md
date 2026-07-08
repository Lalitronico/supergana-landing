# Brief para Codex — Popup de la Quiniela Mundial x Rotary

Lanzamos una campaña de donativo con Rotary: la gente dona $100 USD, llena
una quiniela de la fase final del Mundial 2026 y compite por premios en
cuartos, semifinales y final. 75% de lo recaudado es donativo. Es una
campaña con causa, festiva y solidaria — no una casa de apuestas.

## Tu tarea

Crea el arte del **popup promocional** de la campaña y complétalo con tu
integración. El popup ya funciona en `components/MundialPromoModal.tsx`
(lleva a `/mundial/`); dentro hay un bloque de personajes placeholder
marcado con un comentario, listo para que lo sustituyas por tu arte.

Tienes libertad creativa total sobre las imágenes: la emoción que buscamos
es Mundial + orgullo de donar. Guarda los PNG en
`public/generated/mundial-v1/` y referencia con `mundialAsset("nombre")`
(helper ya existente en `lib/config.ts`).

## Únicas reglas

- No toques la landing principal (`app/page.tsx` y sus componentes) — el
  popup es la única pieza que vive ahí.
- No regeneres los 7 personajes base; castéalos en escenas nuevas.
- Sin logos oficiales (FIFA, selecciones, Rotary).
- Corre `npm run build` antes de dar por terminado.
