# Brief para Codex — Poses faltantes de la landing v2

La landing nueva (`app/page.tsx` + `components/landing/`) ya está construida y
funcionando. Vende Supergana como **plataforma de experiencias gamificadas
white-label para marcas**: tres módulos (Quinielas, Carrera de Tickets, Tienda
de Puntos), premios reales en +200 países, y nosotros operamos todo.

Le faltan **cinco piezas de arte**. Todo lo demás está terminado.

## Tu tarea

Ilustra las cinco piezas listadas abajo y conéctalas. Los huecos ya están
marcados en el código y hoy se ven como círculos etiquetados
(`PERSONAJE — CON TICKET`, etc.), así que sabrás exactamente dónde va cada una.

**Cómo se conectan:** en `lib/characters.ts` hay un mapa `POSES` donde cada pose
faltante tiene `src: null`. Sustituye ese `null` por la ruta de tu PNG. El
componente `Character` ya hace el resto — cuando `src` deja de ser `null`,
el placeholder desaparece solo. No hace falta tocar ninguna sección.

### Las cinco piezas

1. **`conTicket`** — un personaje sosteniendo/levantando un ticket de compra
   (un recibo de papel). Va junto al mock del módulo "Carrera de Tickets".
   Emoción: "ya subí el mío, voy ganando".

2. **`deCompras`** — un personaje de compras, con bolsas o carrito. Va junto al
   mock de "Tienda de Puntos". Emoción: canjear algo que se ganó.

3. **`invitando`** — un personaje haciendo el gesto de invitar/llamar
   ("vente, súmate"). Va en la card punteada "Tu marca aquí".

4. **`senalando`** — un personaje señalando hacia unos pasos numerados. Va en la
   sección "Cómo funciona", junto al título "De brief a campaña viva en días".

5. **Ilustración de escena** — la única que no es un personaje suelto:
   **personajes en las gradas de un estadio, celebrando**. Va en el panel azul
   de la card del caso "Quiniela Mundial × Rotary". Formato cuadrado (1:1).
   El hueco lo marca `DashedSlot` con la etiqueta
   `ILUSTRACIÓN — PERSONAJES EN EL ESTADIO` en `components/landing/Casos.tsx`.

## Dirección de arte

- Estilo **rubber-hose años 30** (brazos de manguera, guantes, ojos grandes),
  igual que los personajes existentes en `public/characters/v2/`. Úsalos como
  referencia de estilo, escala y paleta.
- **No regeneres los 7 personajes base.** Castéalos en las poses nuevas: son
  los mismos actores en otra escena, no personajes nuevos.
- Fondo **transparente** (PNG con alpha), excepto la pieza 5 que va dentro de
  un marco cuadrado.
- Paleta: cream `#FAF7F0`, ink `#0A0A0A`, yellow `#FFD93D`, red `#FF4757`,
  blue `#1E90FF`, green `#2ECC71`, pink `#FF6B9D`.
- Contorno negro grueso, colores planos saturados. **Sin degradados suaves,
  sin sombras difuminadas, sin estrellas decorativas dispersas.**

## Alcance — lista blanca estricta

Solo puedes crear o modificar estos archivos:

- `public/generated/landing-v2/**` ← todos tus PNG van aquí, carpeta nueva
- `lib/characters.ts` ← únicamente para cambiar los cinco `src: null`
- `lib/config.ts` ← únicamente si necesitas agregar un helper `landingAsset()`
- `components/landing/Casos.tsx` ← únicamente para meter la pieza 5 dentro del
  `DashedSlot` existente (pásala como `children`, no borres el componente)

**No toques nada más.** En particular: no modifiques ninguna otra sección de
`components/landing/`, ni `components/ui/`, ni `app/page.tsx`, ni
`app/globals.css`, ni `public/characters/**` (arte existente), ni nada bajo
`app/mundial/`, `app/q/`, `app/api/` o `app/admin/`.

Si crees que algo fuera de la lista necesita cambiar, **detente y dilo** en vez
de cambiarlo.

## Antes de terminar

- `npm run build` debe pasar.
- `npx tsc --noEmit` debe pasar sin errores.
- Los cinco placeholders etiquetados deben haber desaparecido de la página.
