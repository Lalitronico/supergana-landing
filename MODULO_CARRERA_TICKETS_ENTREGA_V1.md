# Carrera de Tickets — entrega v1

*Construido el 2026-07-24 siguiendo `MODULO_CARRERA_TICKETS_PLAN.md`.
Fuente de verdad de mecánica y economía: `../Novamex x Supergana/Contexto/BRIEF_MAESTRO_NOVAMEX_SUPERGANA.md`.*

El plan proponía seis pasos y marcaba el punto exacto en que el piloto se vuelve
operable: *"después de 4 el sistema ya sirve para correr el piloto aunque la
entrega sea manual"*. **Esta entrega cubre los pasos 1 a 4, más los correos de
estado (paso 6) y el ledger de recompensas con entrega manual (paso 5 en su
forma acordada).** Falta enchufar Tremendous, que era una decisión explícita.

---

## 1. Qué existe ahora

### Base de datos (migraciones 0006 y 0007, aplicadas y verificadas)

Once tablas nuevas. La tenencia es real desde el día uno: `organizations →
campaigns → todo lo demás`, y cada fila del módulo cuelga de una campaña.

| Tabla | Para qué |
|---|---|
| `organizations`, `campaigns` | El tenant. Todo lo configurable vive en `campaigns.config` (jsonb) |
| `campaign_admins` | Allowlist de staff por campaña con rol (`reviewer`/`supervisor`/`finance`/`admin`) |
| `participants` | Perfil por campaña, con `household_key` generado |
| `consents` | Append-only, con versión de reglas, IP y user-agent |
| `products`, `product_aliases` | Catálogo de validación: cómo se imprime cada producto en cada retailer |
| `receipts`, `receipt_items` | Tickets y sus líneas capturadas |
| `receipt_reviews` | Bitácora append-only de cada decisión |
| `rewards` | Recompensas aprobadas, con `external_id` idempotente |

**`tickets_approve_receipt` es el único lugar donde nace una recompensa.**
Bajo lock de la fila de campaña verifica, en una sola transacción: umbral
mínimo, elegible ≤ total, ticket duplicado, límite por participante, límite por
hogar, cupo semanal, slots de campaña y fondo restante. Después actualiza el
ticket, escribe las líneas, crea la recompensa y deja el registro en la
bitácora. Si algo falla, no pasa nada de lo anterior.

### Seguridad

- Bucket `receipts` **privado** (10 MB, solo imágenes). El ticket lleva
  ubicación, fecha y hábitos de compra: nunca hay URL pública. La consola ve las
  imágenes con enlaces firmados de 5 minutos.
- Política de storage: un participante solo puede escribir y leer en su propia
  carpeta (`<campaña>/<auth-uid>/…`). **Sin política de borrado, a propósito**:
  un ticket en revisión no debe poder desaparecer a manos de quien lo subió.
- RLS verificada: `anon` no toca ninguna tabla; `authenticated` solo puede
  **leer sus propias filas** (participante, consentimientos, tickets, líneas,
  recompensas) y no puede escribir en ninguna; `tickets_approve_receipt` y
  `tickets_review_receipt` solo son ejecutables por `service_role`.
- `search_path` fijado en las cuatro funciones del módulo.

### App del participante — `/c/[campana]/`

Bilingüe es/en con toggle e idioma persistido en cookie. Cinco pantallas:

`/` home (cupo semanal, cómo funciona, marcas, estados elegibles, legal) ·
`/entrar/` OTP por email · `/registro/` perfil y consentimientos ·
`/subir/` captura y envío del ticket, más el estado "en revisión" ·
`/panel/` recompensa e historial.

La imagen **no pasa por la API**: el navegador escribe directo al bucket
privado y manda solo la llave del objeto. Una foto de teléfono de 8 MB
excedería el límite de body de una función serverless en Vercel. El servidor
después descarga el objeto y lo hashea él mismo — un hash calculado en el
cliente no vale nada como señal antifraude.

### Consola de operación — `/admin/[campana]/`

Cuatro vistas, calcadas del demo aprobado: **Resumen** (fondo restante con
barra de pagado/reservado/disponible, cupo, tiempo mediano de validación,
embudo), **Cola de revisión**, **Recompensas** y **Catálogo y reglas**.

La revisión es el corazón: imagen firmada al lado de la captura manual de
tienda, fecha y total, más las líneas del ticket. Al escribir una línea el
diccionario de alias la asocia sola al producto (alias más largo gana, para que
`CAMARONAZO 32OZ` no pierda contra `CAMARONAZO`). **El gasto elegible no se
escribe: es la suma de las líneas que coinciden con el catálogo.**

Señales antifraude que la v1 sí puede ver, sin OCR ni vendor: hogar ya premiado,
participante ya premiado, hogar compartido entre varias cuentas, remitente
repetido, cuenta creada menos de dos horas antes del envío. Son cinco hechos
verificables, no un puntaje de riesgo que nadie podría explicarle al cliente.

### Correos

Cinco, vía Resend, bilingües según el idioma del participante: recibido,
aprobado, imagen nueva, rechazado, recompensa enviada. Todos *env-gated* como
los del Mundial: sin `RESEND_API_KEY` se registra y se sigue — un correo que
rebota nunca puede costarle la recompensa a alguien.

---

## 2. Antes de que esto funcione hay que configurar cuatro cosas

**Nada de lo siguiente es código. Sin esto, la app carga pero nadie puede entrar.**

### a) Variables de entorno

En `.env.local` y en Vercel:

```
SUPABASE_SERVICE_ROLE_KEY=...   # falta en local; sin él ninguna ruta responde
RESEND_API_KEY=...              # sin él no sale ningún correo de estado
EMAIL_FROM=Supergana <...>
NEXT_PUBLIC_SITE_URL=https://supergana.fun
```

Recordatorio del CLAUDE.md global: las `NEXT_PUBLIC_*` se hornean en el build,
así que tienen que estar en Vercel **antes** de deployar, no solo en local.

### b) SMTP propio en Supabase Auth — esto es lo que más fácil se pasa por alto

El login es OTP por email y **lo envía Supabase, no nosotros**. El emisor
integrado de Supabase está limitado a unos pocos correos por hora: alcanza para
probar y se cae el primer día de un piloto real.

Hay que configurar SMTP propio en el dashboard (Authentication → Emails → SMTP
Settings) apuntando a Resend, que ya está en el stack. Es configuración de
dashboard, no despliegue.

**Sobre el código de 6 dígitos:** la plantilla *Magic Link* por defecto de
Supabase solo lleva `{{ .ConfirmationURL }}` — manda un enlace, no un código, y
las dos pantallas de entrada piden un código. Para que el campo de 6 dígitos
sirva hay que agregar `{{ .Token }}` a la plantilla.

Mientras tanto **el enlace también funciona**: `app/auth/callback/route.ts`
recibe tanto el `code` de PKCE como el par `token_hash` + `type`, y los dos
formularios mandan su `emailRedirectTo` ahí. Así una instalación fresca puede
autenticar sin tocar el dashboard. El código sigue siendo el flujo preferido —
funciona aunque el correo se abra en otro dispositivo, que es justo lo que el
enlace no soporta.

Si el Site URL del proyecto apunta a `supergana.fun`, hay que agregar
`http://localhost:3000/**` a los Redirect URLs (Authentication → URL
Configuration) para probar en local con enlace. Con el código no aplica.

### c) Dar de alta al primer revisor

Estar en `auth.users` no autoriza nada, y la consola entra con
`shouldCreateUser: false` — no crea cuentas. El camino de operación no depende
del correo: con la service role se crea la cuenta, se le da el asiento y se
genera su código o su enlace sin enviar nada.

```sql
insert into public.campaign_admins (campaign_id, auth_user_id, role)
select c.id, u.id, 'admin'
from public.campaigns c, auth.users u
where c.slug = 'ticket-al-tanque' and u.email = 'tu-correo@…';
```

Para crear la cuenta y sacar el código en un solo paso está `scripts/tickets-otp.mjs`:

```
node scripts/tickets-otp.mjs alguien@correo.com --admin ticket-al-tanque
```

Usa `auth.admin.createUser` + `generateLink`, que devuelve el mismo OTP que
habría ido por correo, sin enviar nada. Sin `--admin` sirve igual para dar de
alta a un participante de prueba. **Vive en el repo a propósito**: la primera
versión murió en el scratchpad de la sesión que lo escribió, y sin él no hay
forma de entrar mientras el SMTP siga pendiente.

### d) La campaña está en `draft`

Sembrada así a propósito. En `draft` la app se ve y se puede recorrer, con un
listón visible de "borrador", **pero no acepta tickets**. Pasarla a `live` debe
ser un acto deliberado, después de las respuestas de la sección 5:

```sql
update public.campaigns set status = 'live' where slug = 'ticket-al-tanque';
```

---

## 3. Decisiones que se tomaron en esta sesión

| Decisión | Qué se eligió | Por qué |
|---|---|---|
| **Hogar** | Apellido normalizado + ZIP | El brief promete "una por participante/hogar" y nunca define hogar. Solo email se vence con cinco minutos y cinco correos; teléfono verificado exige vendor de SMS y sale del alcance. Es una llave gruesa a propósito: **marca** el reclamo en la cola, y el bloqueo duro vive en la aprobación |
| **Auth** | Supabase Auth real | Pedido explícito: la infraestructura es Supergana, la gente debe poder iniciar sesión y llevar control de lo suyo. Trajo `@supabase/ssr` y `proxy.ts` |
| **Entrega** | Manual detrás de la interfaz | El ledger ya usa `external_id` idempotente y el estado que usaría un proveedor automático. Cambiar a Tremendous es escribir un adaptador y voltear `config.payout_provider` |
| **Premio mayor** | **Apagado** (`show_grand_prize: false`) | El demo lo muestra; la v1 no. Arrastra AMOE y registro estatal (NY/FL sobre $5,000) y anunciar un premio sin reglas oficiales escritas es peor que no anunciarlo — es exactamente lo que convierte la promoción en lotería privada |
| **Puntos y leaderboard** | Fuera, como marcaba el plan | Por eso el home de la v1 tiene tres pasos y no cuatro: el paso "sigue acumulando puntos" del demo describe algo que todavía no existe |
| **Escenario económico** | Escenario 1 sembrado ($10 → $20, 1,200 slots) | Es lo que muestran el deck y los dos demos. Pasar al Escenario 2 es un `update` de config, no código — la sentencia exacta está comentada en la migración 0007 |

---

## 4. Qué está verificado y qué no

**Verificado contra el proyecto real (`rlzcyejctolcfhyygqdq`):**

- Migraciones aplicadas: 11 tablas, 4 funciones, 5 políticas de lectura propia,
  2 de storage, bucket privado.
- La lógica de aprobación, con datos sintéticos y limpieza posterior. Siete
  casos, todos pasaron: aprobación válida ($20 con `external_id`), segundo
  reclamo del mismo hogar bloqueado (probando que `"gonzalez "` con espacio y
  mayúscula distinta colapsa a la misma llave), ticket duplicado bloqueado
  (probando que `"el super #114"` cacha a `"El Super #114"`), gasto bajo el
  umbral, doble aprobación, petición de imagen nueva con su bitácora, y los
  efectos correctos de la aprobación.
- Permisos: `anon` sin acceso a ninguna tabla; `authenticated` sin escritura en
  ninguna; la ruta del dinero solo para `service_role`.
- `tsc --noEmit`, `next build` y `eslint` limpios. `/admin/mundial` sigue
  resolviendo a su página estática — la precedencia sobre `[campana]` funciona.

**Verificado en el navegador (dev server, 2026-07-24):**

- El home de campaña renderiza server-side en ES y EN, con listón de borrador,
  cupo 150/150, las 7 marcas y los estados elegibles.
- Los gates funcionan: `/subir/` sin sesión rebota a la pantalla de entrada, y
  la consola muestra su reja de acceso.
- Códigos de estado: `401` sin sesión en `/me` y en las cuatro rutas de admin,
  `403` reservado para sesión válida sin asiento en la campaña, `404` para
  campaña inexistente tanto en la API como en la página.
- El payload público no expone el fondo, ni las reglas de hogar, ni el
  diccionario de alias.
- Sin errores en la consola del navegador ni en el log del server.

**Verificada la consola completa, con sesión real y datos sembrados:**

- Entrada con Supabase Auth, autorizada por `campaign_admins`.
- Cola de revisión con los tres tickets, imagen servida por enlace firmado
  desde el bucket privado.
- Señales antifraude encendiéndose solas: dos cuentas con el mismo apellido y
  ZIP salieron marcadas antes de decidir nada, y en cuanto se aprobó a una, la
  otra pasó de aviso a alerta — hogar ya premiado.
- Aprobación de punta a punta desde el formulario: las líneas escritas tal como
  se imprimen se asociaron solas por alias (Jarritos, La Perrona, Camaronazo,
  D'Gari), el elegible se dedujo en $11.47 y TORTILLAS MAIZ quedó fuera por no
  estar en el catálogo. En la base quedó: recompensa de $20 en `reserved`,
  ticket `approved`, `dedupe_key` normalizado, 4 líneas y 1 entrada de bitácora
  con el revisor real.
- Ledger de recompensas con `external_id` y sólo las transiciones legales
  desde `reserved`.

Cinco bugs reales salieron de estas pasadas y quedaron corregidos:

1. Los montos en español se imprimían `USD 10` en vez de `$10` — es-MX
   desambigua el dólar frente al peso, correcto en México y equivocado en El
   Paso.
2. La reja de la consola salía sin estilos: los tokens de color vivían sólo en
   `.tka` y esa pantalla se renderiza fuera de ese contenedor.
3. El admin devolvía `403` sin sesión, obligando al navegador a preguntarle a
   Supabase quién era sólo para elegir pantalla.
4. **La longitud del OTP estaba hardcodeada en 6 dígitos.** Es configuración
   del proyecto (6 a 10) y éste emite 8: el campo habría rechazado todos los
   códigos reales. Ahora acepta 6–10 y el copy ya no promete un número.
5. **Los enlaces de acceso generados desde el servidor vuelven por flujo
   implícito** (`#access_token=…`), no PKCE. Un fragmento nunca llega al
   servidor, así que `/auth/callback` caía a su rama de error mientras los
   tokens quedaban sin usar en la barra de direcciones.
   `app/auth/HashSession.tsx` es la otra mitad: lee el fragmento, entrega los
   tokens al cliente de navegador y recarga sobre una URL limpia.

**Verificado el circuito del participante (navegador, 2026-07-27):**

Esto era el hueco de la entrega y ya está cerrado. Una cuenta nueva recorrió
todo el camino sin atajos: entrar → perfil → consentimientos → foto → cola.

- **Entrada real.** `signInWithOtp` desde `/entrar/` fue aceptado por Supabase y
  la pantalla avanzó sola al paso del código. El código de 8 dígitos verificó y
  creó sesión en cookies, que es lo que después leen las rutas de servidor.
- **Los gates encadenan solos.** Al entrar, `/subir/` vio que la cuenta no tenía
  perfil y mandó a `/registro/`; al guardar, regresó a `/subir/`.
- **Consentimientos.** Marketing quedó **sin marcar** a propósito: se escribieron
  las tres filas con `accepted` true/true/false y la versión de reglas. El log
  guarda el "no" explícito, que es más defendible que no guardar nada.
  `household_key` salió `vega|79915` — normalizado, como lo espera la aprobación.
- **La subida no pasa por la API.** El navegador escribió directo al bucket en
  `ticket-al-tanque/<auth-uid>/<uuid>.jpg`, que es la única forma que la política
  de storage deja escribir a esa cuenta. El servidor bajó el objeto y lo hasheó:
  el sha256 que quedó en `receipts.image_hash` es idéntico al del archivo local.
- **El bucket sigue cerrado.** La URL pública del mismo objeto da **400**; el
  enlace firmado da **200** con los 49,391 bytes exactos.
- **Cierra el circuito.** El ticket apareció en la cola de revisión como
  *Marisol Vega · 79915 · RECIBIDO*, con la imagen servida por enlace firmado y
  el hogar visible para el revisor.

De paso quedaron verificados dos fixes de la sesión anterior: los montos se
imprimen `$10`/`$20` en español, y la consola distingue bien el `403` — con la
sesión de la participante viva contestó *"tu sesión es válida, pero tu cuenta no
está en la lista de operación"*, no una pantalla de login.

**Un bug nuevo, corregido y verificado:** las dos pantallas de entrada hacían
`setError(authError.message)`, o sea imprimían el string de gotrue tal cual.
El rate limit del emisor integrado salió **en inglés** en una campaña bilingüe
para El Paso. Ahora `isRateLimited()` (en `lib/supabase/browser.ts`) lo traduce
y cualquier otro error cae en el mensaje genérico ya traducido; el string crudo
del proveedor no vuelve a llegar a pantalla.

**No verificado todavía:**

- Ningún correo se envió: no hay `RESEND_API_KEY` en local. El gate sí quedó
  probado — el log dice `RESEND_API_KEY missing — skipped "Recibimos tu ticket"`
  y el ticket se guardó igual, que es exactamente lo que debe pasar.
- El OTP **llegando por correo**. Que Supabase acepte la petición ya está
  probado; lo que falta es SMTP propio y `{{ .Token }}` en la plantilla. Y esto
  dejó de ser teórico: la prueba se topó con
  *"you can only request this after 20 seconds"* con **una sola persona**
  entrando. Es la sección 2b y es lo que se cae el primer día del piloto.

---

## 5. Lo que sigue pendiente con Novamex

Sembrado como placeholder y marcado como tal en la migración:

1. **¿Los $30,000 son solo premios o presupuesto total?** Si son todo incluido,
   la mecánica sembrada no es viable y toca el micro-piloto del brief §15.
2. **Estados, mercados y retailers.** Hoy están `TX, NM, AZ`, inferidos de las
   ciudades del demo. Es configuración, pero decide quién puede registrarse.
3. **El diccionario de descriptores por retailer.** Hay 5 productos con 12
   alias, tomados del demo de la consola. Mineragua y Sangría Señorial aparecen
   en las marcas del home pero **no tienen alias**, así que hoy no podrían
   validarse. Un producto sin alias nunca coincide con una línea impresa.
4. **Reglas oficiales.** `rules_version` dice `2026-07-24-draft` y `rules_url`
   está vacía. Los consentimientos ya se guardan versionados, así que cuando
   existan las reglas de verdad basta con actualizar la config: quien aceptó la
   versión vieja queda registrado como tal.

---

## 6. Deuda técnica conocida

- **Sin hash perceptual.** Se cacha el mismo archivo (sha256) y el mismo ticket
  (tienda + fecha + total), que son los dos abusos baratos. La misma foto
  recortada o rotada todavía pasaría el primer filtro — la ve el revisor, no el
  sistema. El brief lo pone como capa aparte y entra con el pre-filtro de OCR.
- **El embudo no mide escaneos de QR.** Empieza en el registro. Los escaneos
  necesitan instrumentar los enlaces con UTM firmados (brief §11); la consola lo
  dice explícitamente en vez de mostrar un número inventado.
- **Objetos huérfanos.** Si la red se cae entre la subida y el registro del
  ticket, la imagen queda en el bucket sin fila. La API sí limpia cuando el
  insert falla; el hueco es la falla de red pura.
- **El correo de "recompensa enviada" se dispara al marcar `sent`.** Con entrega
  manual eso depende de que el operador marque el estado después de enviar de
  verdad, no antes.
- **Hay datos de prueba en la campaña real.** Cuatro participantes (los tres
  sembrados el 24-jul y `prueba.participante@supergana.fun` del 27), cuatro
  tickets, una recompensa en `reserved` y una imagen en el bucket. Sirven para
  enseñar la consola con algo dentro, pero **hay que purgarlos antes de abrir a
  gente real**, junto con las cuentas en `auth.users` — si no, el primer reporte
  de conciliación que vea Novamex trae cuatro personas que no existen.
