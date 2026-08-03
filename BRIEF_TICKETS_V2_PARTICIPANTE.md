# Brief — Carrera de Tickets v2: el lado del participante

*Escrito 2026-07-27 después de que Eduardo probara la v1 de punta a punta.
Continúa `MODULO_CARRERA_TICKETS_ENTREGA_V1.md`. La consola de operación quedó
aprobada en esa prueba y **no es objeto de este brief**.*

## El objetivo

**Convertir el lado del participante de un formulario de una sola transacción
en una cuenta con casa propia.**

Hoy la app hace exactamente una cosa: subir un ticket y esperar. Sirve para
cobrar una recompensa y no da ninguna razón para volver. Lo que se vende es una
plataforma donde la marca acumula relación con su gente, y eso no existe
todavía.

Dicho por el usuario, que es la definición a cumplir:

> me registre con mi correo y contraseña al módulo, pueda entrar y ya tenga mis
> datos, suba mi ticket, ver mi panel de puntos, ver cuánto tengo, cuánto me
> falta, qué premios hay, qué leaderboard tenemos, productos participantes

**Móvil primero, no móvil también.** La mayoría de las veces se usa desde el
celular, llegando de un QR en tienda. Cualquier decisión de diseño que se vea
bien en escritorio y regular en un teléfono está mal tomada.

---

## Restricción legal — léela antes de diseñar el leaderboard

Está en `MODULO_CARRERA_TICKETS_PLAN.md` y en
`../SUPERGANA_PLATAFORMA_FUNDAMENTOS.md`, y **decide la arquitectura**, no el
copy:

| Capa | Régimen | Qué se puede |
|---|---|---|
| Recompensa $20 | umbral garantizado, sin azar | comprar → cobrar |
| Puntos y leaderboard | acumulación | rankear por compra |
| Premio mayor | sorteo, exige AMOE | **comprar no puede mejorar tus probabilidades** |

El demo dice literalmente *"Comprar no mejora tus probabilidades"*. Si el
leaderboard rankea por compra **y** el premio mayor se le entrega a quien esté
arriba, la promoción se vuelve **lotería privada ilegal en EE.UU.** No es un
ajuste posterior: cambia el régimen de toda la campaña.

La salida limpia: el leaderboard reparte premios **de acumulación** (garantizados
por alcanzar un umbral, sin azar), y el sorteo se rifa aparte entre quienes
entraron — por compra **o** por la vía gratuita. Dos mecánicas separadas que
comparten pantalla, nunca una que alimente a la otra.

Mientras no existan reglas oficiales escritas, `show_grand_prize` sigue en
`false`. Anunciar un premio sin reglas es peor que no anunciarlo.

---

## Lo que Eduardo encontró al probar

### 1. El panel no se entera de nada — bug confirmado

Aprobó su ticket en la consola y la pantalla del participante siguió diciendo
"Estamos revisando tu ticket".

**No es auth.** La base quedó correcta: ticket `approved`, elegible **$14.37**,
recompensa de **$20** en `reserved`. Lo que falla es que `useMe`
(`app/c/[campana]/useMe.ts`) hace **un solo fetch al montar**. No hay polling,
ni refetch al volver a la pestaña, ni realtime. `reload()` existe pero solo se
llama después de las propias acciones del participante.

Resultado: quien sube un ticket a las 9 a.m. y lo deja abierto ve "en revisión"
hasta que recargue a mano. En la práctica nadie recarga; asume que se rompió.

Opciones, de menor a mayor: refetch en `visibilitychange` (barato, cubre el 90%
— la gente vuelve a la pestaña), polling suave mientras haya un ticket abierto,
o Supabase Realtime sobre `receipts`/`rewards`. **Con v2 metiendo puntos y
leaderboard, que la pantalla refleje el estado real deja de ser un detalle.**

### 2. No hay puerta de entrada visible

El único CTA del home es "Subir mi ticket". A `/entrar/` solo se llega
rebotado por un gate. Quien llega del QR y **ya tiene cuenta** no encuentra
cómo entrar; quien no la tiene no sabe que hace falta una.

### 3. El móvil nunca se verificó

`tickets.css` tiene un breakpoint en 860px que quita el marco de teléfono y va
a pantalla completa, así que está contemplado — pero **toda la prueba fue en
escritorio**. Hay que verlo en 390×844 real, en un teléfono, no en un
navegador angosto: teclado abierto sobre los campos, la nav inferior contra el
gesto de home de iOS, la cámara desde `capture="environment"`, y el `100dvh`
con la barra del navegador entrando y saliendo.

---

## El cambio de auth: correo y contraseña

Pedido explícito, y resuelve de paso el peor problema operativo que
encontramos.

Hoy el login es OTP por correo, y el emisor integrado de Supabase topa en
**2 correos por hora para todo el proyecto** (ver
`OPERACION_LIMITES_Y_CAPACIDAD.md`). Un participante nuevo quedó bloqueado en
su primer intento durante las pruebas.

**Con contraseña, entrar no manda ningún correo.** El muro desaparece del
camino crítico.

Lo que hay que decidir, no dar por hecho:

- **¿Se verifica el correo al registrarse?** Si sí, vuelve a costar un correo
  por alta y el problema regresa a medias. Si no, la recompensa puede acabar en
  una dirección con un dedazo — y el correo **es** el canal de entrega.
  Recomendación: registro sin verificar, pero verificación obligatoria **antes
  de liberar la recompensa**. El muro cae donde ya hay algo que ganar.
- **Recuperación de contraseña.** Manda correo por definición. Con SMTP propio
  (Resend) deja de importar; sin él, quien olvide su contraseña queda fuera.
  **Esto amarra la rama `email-resend` a este trabajo.**
- **`auth_leaked_password_protection` está apagado** en el proyecto. Con OTP
  daba igual; con contraseñas hay que prenderlo (Authentication → Policies).
- **Migrar a las cuentas que ya existen.** Hoy hay cuentas creadas por OTP sin
  contraseña. Necesitan un camino para ponerse una sin quedar atrapadas.

---

## Lo que hay que construir

Marcado con lo que ya existe, porque casi nada parte de cero.

| Pieza | Estado | Nota |
|---|---|---|
| Registro correo + contraseña | **nuevo** | reemplaza el OTP como camino principal |
| Entrar / recuperar contraseña | **nuevo** | y un CTA visible en el home |
| Panel con estado real | existe, no se actualiza | ver bug 1 |
| **Puntos** | **nuevo** | tabla, reglas de acumulación, tope semanal |
| **Cuánto llevo / cuánto me falta** | **nuevo** | el motor de retorno del módulo |
| **Premios del catálogo** | **nuevo** | umbrales de acumulación, sin azar |
| **Leaderboard** | **nuevo** | ojo con la restricción legal de arriba |
| **Productos participantes** | parcial | el home lista 7 marcas; falta ficha por producto. Placeholders está bien |
| Subir ticket | **listo** | no tocar sin razón |
| Historial de tickets | listo | ya muestra rechazo y motivo |

**Lo que el plan de v1 difirió y ahora entra:** puntos, misiones, topes
semanales y leaderboard. Esto **es** la v1.1 que el plan nombró. Vale decirlo
en voz alta: el alcance creció, y crece bien, pero no es "terminar la v1".

---

## Orden sugerido

1. **Arreglar que el panel se entere** (bug 1). Es chico y todo lo que sigue
   depende de que la pantalla refleje el estado.
2. **Auth con contraseña**, con la decisión de verificación tomada primero.
   Desbloquea que Eduardo pruebe el ciclo completo como participante real.
3. **Puntos en el schema**, antes de cualquier UI. El error que el módulo ya
   evitó una vez: no escribir pantallas contra campos que no existen.
4. **El panel de progreso** — cuánto llevo, cuánto me falta, qué sigue.
5. **Catálogo de premios y productos participantes.** Placeholders sirven.
6. **Leaderboard**, al final, cuando los puntos tengan historia real.
7. **Pasada móvil de verdad**, en teléfono, sobre todo lo anterior.

Después de 2 el usuario ya puede recorrer el módulo como participante y opinar
de diseño, que es justo lo que faltó esta vez.

---

## Lo que no se puede romper

Está verificado y hay batería que lo prueba: **`node scripts/probes/run-all.mjs`
tiene que seguir pasando** después de cada cambio.

- Un participante solo ve **sus** filas y no escribe en **ninguna** tabla.
- Las funciones que crean recompensas son de `service_role` y de nadie más.
- El fondo no se sobregira ni el cupo se excede bajo concurrencia.
- Una marca no alcanza los datos de otra.
- El bucket es privado y las subidas quedan dentro de la campaña de la persona.

**Puntos y leaderboard van a querer lecturas nuevas** (mi posición, el top 10).
Ojo: un leaderboard es, por definición, exponer datos de otros participantes.
Hay que decidir qué se muestra — ¿nombre completo?, ¿inicial?, ¿apodo? — y
escribir la política de lectura a propósito, no ampliar la que existe. Hoy la
regla es "solo tus propias filas" y el leaderboard es la primera excepción
legítima. Que sea una vista acotada, no un permiso abierto.

---

## Pendientes que este brief no cubre

Viven en otras ramas y no bloquean esto, salvo donde se indica:

- **Resend + SMTP** (`OPERACION_LIMITES_Y_CAPACIDAD.md`). **Amarra con la
  recuperación de contraseña.**
- **Export de conciliación** — el demo lo prometía, no existe. El cliente lo va
  a pedir el primer mes de dinero real.
- **Tremendous**, entrega automática. Hoy manual detrás de la interfaz.
- **Purgar los datos de prueba** antes de abrir a gente real: hoy hay 5
  participantes y 6 tickets falsos.
- **Las 4 preguntas abiertas con Novamex** (§5 de la entrega v1). Sobre todo el
  diccionario de alias: **Mineragua y Sangría Señorial siguen sin alias, así
  que hoy no se pueden validar** aunque aparezcan en el home.
- **Deriva de migraciones**: la base tiene `tickets_receipt_storage` y
  `tickets_helpers_search_path` sin archivo en el repo. Resolver antes de
  levantar un segundo entorno para otro cliente.
