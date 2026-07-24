# Módulo Quinielas — plan de implementación

> **DIFERIDO (2026-07-24).** La prioridad pasó a **Carrera de Tickets** — ver
> `MODULO_CARRERA_TICKETS_PLAN.md`. Razón: Novamex es el cliente cercano y ese
> módulo necesita infraestructura real, no un demo.
>
> Ojo con una diferencia importante: aquí se recomienda demo primero y backend
> después, porque el módulo de quinielas no tiene demo. Carrera de Tickets sí
> lo tiene (participante y consola), así que ahí el orden se invierte. No
> extrapolar la recomendación de un documento al otro.

*Escrito 2026-07-24, al cerrar la landing v2.*

## Qué es

La app del participante: 21 pantallas diseñadas en
`../HANDOFF SUPERGANA/design_handoff_supergana/`. Login, selector de modos,
4 modos de juego, tienda de puntos, premios, perfil y marcas aliadas.

**Fuente a leer primero:** `fuentes/Modulo Quinielas v2.dc.html` (739 líneas —
markup, estilos exactos y una clase de lógica al final con el estado completo).
El `README.md` del handoff describe cada pantalla en detalle. Las 21 capturas de
referencia están en `capturas/modulo/`, nombradas en orden de recorrido.

Notación del prototipo: `{{ x }}` = valor de `renderVals()`, `<sc-if>` =
condicional, `<sc-for>` = iteración, `style-hover`/`style-active` = pseudo-clases.

## Orden acordado con el usuario

**Demo jugable primero, backend después.** Razón textual del usuario: *"creo que
debemos darle más cerebro y pensar bien cómo queremos estructurar esa parte, si
mientras funciona como demo me parece bien, antes de tener una infraestructura
que tengamos que cambiar."*

Traducción práctica: construir las 21 pantallas con estado en cliente, sin
Supabase. Cuando el módulo esté completo, ya sabremos exactamente qué datos
necesita y el schema se diseña contra esa realidad, no contra una suposición.

## Fase A — Demo jugable

Ruta: **`app/j/[campana]/`**. El slug es el tenant desde el día uno, aunque en
esta fase venga de un archivo de config y no de la BD — así la Fase B no
reescribe rutas ni props.

Config de campaña (un objeto TS por ahora): `marcaCliente`, logo, modos
habilitados, catálogo de la tienda, copy. Es **la variable white-label
principal**; se inyecta en header, login, perfil y copy.

Estado del prototipo, tal cual lo declara la fuente:

```
loggedIn, email, loginErr
view                                     // jugar | perfil | premios | tienda | marcas
sbOpen                                   // barra de atajos expandida
mode                                     // null | gas | ligamx | survivor | manager
picks{}, sent                            // Liga MX
ticket, ticketOk, ticketErr              // gate de ticket Liga MX
survPick, survSent                       // Survivor
squad{DEL,MED,DEF1,DEF2,POR}, mgrSent    // Manager
gasStep, gasFoto, gasScan, gasMonto,     // Dame más Gasolina
  gasSent, gasParts, gasH, gasA, gasMin, gasC
canje                                    // id del producto canjeado
```

Reutilizar `components/ui/` (ya existe: `CartoonButton`, `Character`,
`DashedSlot`, `Marquee`, `Pill`, `ZigzagEdge`) y los tokens de `globals.css`.
**Leer la sección de trampas de este documento antes de escribir CSS.**

Breakpoint del módulo: **760px** (no el default de Tailwind). La barra de
atajos pasa a fila horizontal y las columnas apilan.

## Fase B — Backend multi-tenant

Solo cuando la Fase A esté completa. Schema propuesto, a validar contra lo que
el módulo realmente pidió:

```
organizations (id, slug, name, logo_url, theme jsonb)
campaigns     (id, org_id, slug, status, starts_at, ends_at, config jsonb, modules[])
participants  (id, campaign_id, auth_user_id, email, display_name)
points_ledger (id, participant_id, delta, reason, ref_type, ref_id, created_at)
```

El **ledger es append-only**: el saldo es un `sum()`, nunca un campo mutable.
Es la pieza más crítica según `SUPERGANA_PLATAFORMA_FUNDAMENTOS.md`, y es lo
que habilita el tracking fiscal por ganador (1099 desde $600/año en US).

Auth: Supabase Auth, magic link + Google. RLS por participante.

**Conectar un solo modo end-to-end**, no los cuatro. Acordado: **Liga MX** — es
lo único validado en producción (PSG-Arsenal, Mundial × Rotary), reusa scoring
existente, y es el más ligero regulatoriamente (habilidad + entrada gratuita).

Los otros 3 modos se quedan como demo hasta que haya comprador. Construirles
backend antes sería especulación cara.

## Fase C — Premios reales

Tremendous, empezando por el sandbox gratuito para validar el catálogo MX antes
de prometer premios específicos. Detalle en `SUPERGANA_INVESTIGACION_2026-07-22.md`.
No nombrar al proveedor públicamente: se dice "premios reales en +200 países".

## Restricción legal que afecta al diseño, no solo al copy

Del patrón "separar el dinero del azar" (default de la plataforma):

- La compra otorga **puntos ciertos**, canjeables por umbral garantizado.
- Toda capa competitiva o con azar es de **entrada gratuita**; comprar nunca
  mejora probabilidades ni da acceso exclusivo.
- **Un solo elemento de azar contamina toda la estructura** — incluido un
  desempate por sorteo. Los desempates deben ser por habilidad.

Por eso el modo "Dame más Gasolina" usa una quiniela **de habilidad** (marcador
exacto, minuto del gol, tiros de esquina) y no un sorteo. No cambiar esa
mecánica sin releer `SUPERGANA_PLATAFORMA_FUNDAMENTOS.md`.

## Dato que debería influir en el diseño

De la campaña Mundial × Rotary: **116 personas pagaron boleto, solo 19 llenaron
su quiniela**. 84% de abandono entre pagar y participar.

Ese hueco de activación es el mejor argumento para el módulo nuevo, y algo que
el diseño debe atacar explícitamente: magic link sin fricción, recordatorios,
onboarding corto, estado guardado. Si el módulo nuevo repite ese 84%, no sirvió
de nada.

## Trampas heredadas de la landing (no repetirlas)

- `globals.css` está **fuera de `@layer`**, así que sus clases le ganan a
  cualquier utilidad de Tailwind. Un `shadow-*` no sobrescribe `.btn-cartoon`.
- `clamp()` solo con `vw` rompe en laptops bajas. Usar `min(Xvw, Yvh)` dentro.
- `transform: scale` no reduce el layout; para encoger de verdad, `zoom`.
- `overflow-x: hidden` en body secuestra el scroll. Usar `clip`.
- En grid, una fila toma la altura del más alto **incluyendo márgenes** —
  escalonar tarjetas con `mt-*` produce huecos que parecen bug.

## Assets

- 7 personajes base en `public/characters/v2/`. **No regenerarlos.**
- Poses de la landing en `public/generated/landing-v2/`.
- Para arte nuevo: `codex exec` + `scripts/chroma-key.mjs`. **Elegir un croma
  que el sujeto no contenga** — keyear verde detrás de un dinosaurio verde
  destruye al dinosaurio (ya pasó). El removedor ML (`strip-bg.mjs`) segmenta
  por sujeto y falla con nuestra paleta saturada.
- Briefs a Codex: **siempre con lista blanca de archivos tocables.**
