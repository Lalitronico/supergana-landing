# Quiniela PSG vs Arsenal Brief

Fecha: 2026-05-11

## Contexto

Se reconstruyo la primera experiencia de quiniela digital de Supergana para la final Champions League 2026: PSG vs Arsenal, Puskas Arena, 30 de mayo de 2026. La ruta principal es `/q/psg-arsenal/`.

La direccion visual quedo como mini-app arcade/cartoon: rubber-hose, fondo estadio vintage, cards con borde negro grueso, botones amarillos, motion con Framer Motion y assets generados para que no se sienta como formulario tradicional.

## Implementacion clave

- `app/q/[slug]/page.tsx`: pagina estatica para la quiniela.
- `app/q/[slug]/QuinielaClient.tsx`: flujo client-side con estados intro, preguntas, registro, submit, exito y ranking.
- `app/q/[slug]/quiniela.css`: sistema visual de la experiencia.
- `lib/quinielas/`: contenido, tipos, scoring provisional y helpers.
- `lib/supabase/`: cliente y helpers de submit/ranking.
- `supabase/`: migraciones/RPC para `submit_quiniela` y scoring.

## Assets

- Personajes con jerseys en `public/characters/v3/`.
- Assets base de quiniela en `public/generated/v4/`.
- Assets frescos de experiencia y preguntas en `public/generated/v5/quiniela/`.
- Logos de equipos en `public/teams/`.
- Fotos/referencias de jugadores en `public/players/`.

Ultimos ajustes visuales:

- Portada con escudos PSG/Arsenal sin placa/fondo crema, solo sombra sticker.
- Reemplazo de placeholders de Rice, Saliba, Otro jugador, No hay goles y La aficion por escenas cartoon generadas.
- Correccion de recortes en cards: personajes y escenas ahora usan encuadre mas estable.
- Titulos largos ajustados para evitar solaparse con arte lateral.

## Datos y flujo

- 14 preguntas: 13 puntuables + 1 desempate.
- Total: 1000 puntos.
- Registro final con nickname + email.
- Submit via Supabase RPC desde cliente, sin API routes ni server actions porque el proyecto usa `output: export`.
- Si faltan variables Supabase, la UI muestra estado amable de configuracion faltante.
- Ranking mostrado es provisional antes del partido.

## QA realizado

- `npm run lint`: pasa.
- `npm run build`: pasa.
- QA visual con navegador en desktop y mobile para preguntas con imagenes problematicas.

## Nota para siguiente sesion

No tomar como referencia la quiniela previa hecha por Claude. La fuente de verdad actual es esta implementacion nueva en `/q/psg-arsenal/` y los datos en `lib/quinielas/psg-arsenal.ts`.
