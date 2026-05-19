# Briefing visual — Supergana landing v2: vertical corporativa + sección de premios

## Qué cambió en la landing (lo que ya implementé en código)

Tras una reunión con ejecutivos de **maquiladoras** interesados en usar Supergana como **plataforma de quiniela corporativa** (empleados juegan en torno al partido, ganan premios físicos, conviven), abrimos un **segundo ICP co-igual** al de marcas. La landing ahora tiene 2 secciones nuevas:

### Sección "Empresas" (`#empresas`, `bg-blue text-cream`)
Posicionada entre `UseCases` y `Premios`. Habla a HR / comunicación interna / comité de eventos en empresas grandes (especialmente con planta operativa). Headline:
> *"La quiniela que une a tus colaboradores — sin armar nada."*

3 pilares: **engagement sin reuniones extra**, **premios que sí emocionan**, **listo para planta o para oficina**. CTA: "Agendar demo para mi empresa".

### Sección "Premios" (`#premios`, `bg-cream`)
Posicionada entre `Empresas` y `Benefits`. Gancho aspiracional que sirve a ambos ICPs (en corporativo motiva al empleado; en marca, al seguidor que participa). Headline:
> *"El premio es lo que recuerdan. Nosotros lo presentamos."*

Subhead clave (define la lógica de los premios):
> *"Tú eliges el premio según presupuesto y audiencia. Nosotros lo integramos al kit visual con las mascotas de Supergana."*

Son **6 cards** clasificadas por tier (estrella / top performers / participación) y por audiencia (ambos / sólo corporativo).

## Lo que necesito de ti

Genera **8 PNGs** que vivirán en `supergana/public/generated/v5/`. Las rutas y nombres ya están cableados en el código vía el helper `premioAsset()` en `lib/config.ts` — no los cambies. Si entregas un nombre distinto, no se renderizan.

**Reglas comunes a los 8:**
- Estilo rubber-hose, línea negra gruesa, paleta saturada de Supergana.
- Fondo transparente PNG (salvo donde indique lo contrario).
- Las mascotas referenciadas deben coincidir en proporciones/personalidad con las de `/public/characters/v2/` — son las mismas, sólo vestidas o situadas distinto.
- Resolución mínima 1024x1024 para los cuadrados, 1280x960 para horizontales, 768x1024 para verticales.
- Sin estrellas decorativas. Sin texto encima de la ilustración (los headlines son HTML).

---

### Brief 1 — `corporate-hero.png` *(horizontal 4:3, ~1280x960)*
**Uso:** ilustración principal del lado derecho de la sección `Empresas`. Es la primera imagen que ve un director de RH al llegar a esa sección — tiene que comunicar "esto es para mi empresa" en menos de un segundo.

**Composición:** tres mascotas de Supergana (sugerencia: `dino`, `mexicano`, `oso`) en un setting de empresa/fábrica claramente legible:
- Una con **casco de seguridad amarillo + chaleco reflectante naranja** (planta operativa).
- Otra con **gafete colgando del cuello** tipo "Empleado del mes" (oficina/corporativo).
- La tercera con **corbata y portapapeles** (HR / supervisor).

Las tres están reunidas alrededor de **un celular gigante compartido** viendo un partido de fútbol (la pantalla muestra cancha verde + dos siluetas de jugadores estilizadas). Ambiente cartoon-industrial: pueden flotar elementos como una taza de café, una lonchera, un cono de seguridad — pero nada realista. Energía: convivencia, cero seriedad corporativa.

---

### Brief 2 — `premio-viaje.png` *(cuadrado, fondo transparente)*
**Uso:** card "Viaje a la playa" — tier estrella. Es el premio mayor para el ganador absoluto.

**Composición:** mascota `gato` o `bandana` recostada en una **hamaca tropical** entre dos palmeras estilizadas. Tiene **lentes oscuros redondos**, un **short hawaiano** (motivo de flores o frutas), y sostiene un **coco con popote**. Detrás: un sol grande estilizado (sin estrellas) y el horizonte de mar con ondas planas estilo flat. Vibe: el premio se ganó y se está disfrutando.

---

### Brief 3 — `premio-jersey.png` *(cuadrado, fondo transparente)*
**Uso:** card "Jersey selección mexicana" — tier top performers (top 5 del tablero).

**Composición:** mascota `lince` vistiendo un **jersey verde** de selección mexicana (sin logos oficiales — sólo el verde sólido con detalles en banco/rojo en cuello y mangas; puedes inventar un escudo cartoon genérico tipo "MX"). Pose: **ambos puños arriba celebrando un gol**, boca abierta gritando. Líneas de movimiento alrededor para reforzar la energía.

---

### Brief 4 — `premio-parrillero.png` *(cuadrado, fondo transparente)*
**Uso:** card "Kit parrillero" — tier top performers (top 10 del tablero).

**Composición:** mascota `oso` con **delantal blanco** (puede llevar el logo Supergana en el pecho del delantal), **pinzas grandes** en una mano, **gorro de chef** (estilo cartoon abullonado). Frente a él una **parrilla humeante** con un par de salchichas y un asado. Algunas líneas de humo en espiral. Expresión: orgullosa, dueño de la parrillada.

---

### Brief 5 — `premio-tv.png` *(cuadrado, fondo transparente)*
**Uso:** card "Pantalla / Smart TV" — tier estrella alternativo.

**Composición:** mascota `cebra` parada al lado de una **smart TV gigante** (más alta que ella). La pantalla muestra una cancha de fútbol estilizada con dos jugadores cartoon. La mascota sostiene un **control remoto** en la mano y hace una pose de "¡me la gané!" (puño en alto o ambos brazos extendidos). Opcional: un moño rojo grande encima de la TV indicando "premio".

---

### Brief 6 — `premio-bono.png` *(cuadrado, fondo transparente)*
**Uso:** card "Días libres / bono" — tier estrella, **sólo corporativo** (no aplica para marcas).

**Composición:** mascota `nuevo` o `mexicano` **saliendo corriendo de una oficina** (una puerta cartoon en el background con un cartel "Oficina" o un reloj checador). Lleva una **mochila al hombro**, expresión de felicidad explosiva. Alrededor flotan **billetes alegres** (rectángulos verdes estilizados con "$" o el símbolo de peso `$`). Al fondo un **calendario cartoon** con varios días tachados con una equis grande. Energía: viernes a las 6pm + bono caído del cielo.

---

### Brief 7 — `premio-kit-participacion.png` *(cuadrado, fondo transparente)*
**Uso:** card "Kit Supergana de participación" — tier participación (para todos los que llenaron la quiniela).

**Composición:** mascota `dino` en el centro **repartiendo calcas y mini-lonas** con el wordmark "Supergana" a un grupo de **3-4 mini-figuras silueteadas** alrededor (no mascotas — figuras genéricas de personas estilo cartoon, para sugerir "todos los participantes"). La mascota tiene una caja a sus pies de la que salen calcomanías. Idea visual: "todos se llevan algo, nadie sale con las manos vacías".

---

### Brief 8 — `corporate-badge.png` *(vertical 1:1.5, fondo transparente, opcional polish)*
**Uso:** ornamento decorativo en la esquina superior de la sección Empresas.

**Composición:** un **gafete de empleado tipo lanyard** colgando. La cinta del lanyard puede ser azul (`#1E90FF`) o amarilla. La tarjeta plástica tiene impreso el **wordmark "Supergana"** y un círculo donde iría la foto (deja el círculo con el color cream y una silueta cartoon de mascota dentro — la de tu elección). Pequeño detalle: un clip metálico arriba donde se engancha la cinta. Sin sombra de fondo — sólo el gafete colgando.

---

## Entrega esperada

8 archivos PNG con los nombres exactos indicados arriba, en `supergana/public/generated/v5/`. Cuando estén, hago `npx kill-port 3000 && npm run dev` y verifico visualmente. Si alguno no encaja, te pido el ajuste específico de ese asset sin tocar los demás.

**Importante:** no toques `/public/characters/v2/` ni `/public/generated/v3/` — el resto de la landing depende de esos archivos y cualquier cambio rompe lo existente.
