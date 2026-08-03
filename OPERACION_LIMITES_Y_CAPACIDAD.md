# Límites de auth y capacidad de correo

*Medido contra el proyecto real `rlzcyejctolcfhyygqdq` el 2026-07-27. Todos los
números de abajo salieron del dashboard y de los logs de auth, no de la
documentación general.*

## El hallazgo

Un participante nuevo, con un correo que nunca había usado la app, en su primer
intento, **no pudo entrar**. Vio esto:

> Ahora mismo no podemos enviarte el código. No es tu culpa: ya avisamos al
> equipo. Intenta de nuevo más tarde.

Bastaron **dos correos** en la hora previa para llegar a ese estado. Los logs lo
confirman: exactamente dos eventos `mail.send`, y todo lo que vino después
respondió `over_email_send_rate_limit`.

Esto no es una degradación bajo carga. Es un muro: el participante número 3 de
cada hora simplemente no entra.

## Lo que está configurado hoy

| Límite | Valor real | Alcance | ¿Editable? |
|---|---|---|---|
| **Envío de correos** | **2 / hora** | **Todo el proyecto** | **No** — el campo está en gris |
| Verificación de tokens | 30 / 5 min | Por IP | Sí |
| Altas e inicios de sesión | 30 / 5 min | Por IP | Sí |
| Refresh de token | 150 / 5 min | Por IP | Sí |
| Cooldown por dirección | 60 s | Por email | Sí |
| SMTP propio | **Apagado** | — | — |
| Plan Supabase | **Free** | — | — |

El campo de 2/hora está en gris **porque el SMTP propio está apagado**. Es el
tope del emisor integrado de Supabase, y solo se vuelve editable al conectar un
proveedor propio.

Dos aclaraciones que importan:

- **El presupuesto es del proyecto, no de la campaña.** Novamex y cualquier
  cliente futuro comparten la misma cubeta. Es una restricción de arquitectura
  multi-tenant, no un detalle de configuración.
- **Los 429 vienen en dos sabores** y hasta hoy la app los trataba igual:
  `"only request this after N seconds"` (60 s, por dirección — esperar sí
  sirve) y `"email rate limit exceeded"` (la cuota de la hora se acabó —
  esperar no sirve, y el siguiente que llegue tampoco entra). Ya se distinguen.

## Lo que sí juega a favor

**Las sesiones no expiran.** `Time-box user sessions` e `Inactivity timeout`
están en 0. El participante pide **un** código en su vida y se queda dentro.
Eso baja el volumen de OTP a ≈ número de participantes únicos por dispositivo,
no de visitas — que es la diferencia entre un problema caro y uno manejable.

## La aritmética del piloto

Escenario 1 sembrado: $10 → $20, 1,200 slots, cupo 150/semana.

Correos por participante que llega hasta el final: **1 OTP** (Supabase) + 3 de
estado (Resend: recibido, aprobado, recompensa enviada). No todos completan, y
hacen falta más registros que recompensas.

| | Estimado |
|---|---|
| OTP de auth, toda la campaña | ~2,000–2,500 |
| Correos de estado (Resend), toda la campaña | ~6,000 |
| **Total** | **~8,000–9,000** |
| Por mes (campaña de ~8 semanas) | ~4,000–4,500 |

El pico manda más que el promedio: **el cupo se libera los lunes**, así que el
lunes concentra el tráfico por diseño. Un lunes cargado puede mover 200–300
correos en el día y 25–40 OTP en la hora pico.

Contra eso:

- Emisor integrado: **2/hora** → imposible, ni el promedio.
- Resend Free: **100/día, 3,000/mes** → un solo lunes lo revienta, y el mes
  también.
- SMTP propio recién activado: **30/hora por defecto** → sigue quedando corto en
  la hora pico del lunes.

## Qué hay que hacer, en orden

1. **Conectar SMTP propio apuntando a Resend** (Authentication → Emails → SMTP
   Settings). Es lo único que destraba el campo de 2/hora. Sin esto, nada más
   de esta lista sirve.
2. **Subir "Rate limit for sending emails" a 100–150/hora.** El default después
   de activar SMTP son 30, que no aguanta la mañana de un lunes.
3. **Resend Pro ($20/mes, 50,000 correos).** El plan gratis tope 100/día queda
   por debajo de un solo lunes del piloto.
4. **Agregar `{{ .Token }}` a la plantilla Magic Link.** Sin esto el correo
   manda un enlace y la pantalla pide un código de 6–10 dígitos. Hoy funciona
   por el enlace, pero el código es el flujo preferido: sobrevive a que el
   correo se abra en otro dispositivo.
5. **Verificar el dominio en Resend** (SPF/DKIM) antes de mandar a listas
   reales, o los códigos se van a spam y el piloto "no funciona" por una razón
   que no es la app.

## Lo que queda como riesgo conocido

**Nadie se entera cuando esto pasa.** El envío del OTP ocurre del navegador
directo a Supabase: el servidor de la app nunca lo ve, así que el fallo solo
existe como un `console.error` en el teléfono del participante. Si la cuota se
agota un lunes a las 9 a.m., la operación se entera por quejas, no por una
alarma.

Salidas posibles, en orden de esfuerzo: monitorear los logs de auth de Supabase;
o pasar el `signInWithOtp` por una ruta del servidor para poder registrar y
alertar los 429. La segunda es la correcta si esto se vende como infraestructura
gestionada — pero es una decisión de arquitectura, no un parche.
