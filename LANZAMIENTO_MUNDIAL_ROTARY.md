# Lanzamiento — Quiniela Mundialista x Rotary Cd. Juárez

Checklist para dejar viva la campaña. La quiniela vive en
https://supergana.fun/mundial/quiniela/ (y `/mundial/` redirige ahí).
Deadline: **8 de julio** (los cuartos arrancan el 9 jul, 14:00 CDMX).

## Flujo de la experiencia

supergana.fun → popup → `/mundial/quiniela/` (intro estilo flyer) →
"Participar ahora" → **pago en Stripe** → regresa con `?session_id=` a
`/mundial/quiniela/` → llena la quiniela → confirmación.

## 1. Base de datos ✅ HECHO

`supabase/migrations/0003_mundial_rotary.sql` ya aplicada y verificada en el
proyecto Supabase `Supergana` (`rlzcyejctolcfhyygqdq`). Crea solo tablas
`mundial_*`; no toca PSG-Arsenal.

## 2. Stripe — verificar la configuración del Payment Link

Payment Link ya creado: `https://buy.stripe.com/aFa8wQffiekEftT6qRds400`
(ya está hardcodeado como fallback en el código, así que "Participar" funciona
aunque no se ponga la env var).

Falta confirmar en el dashboard de Stripe:

1. **Redirect post-pago** del Payment Link → After payment → *Redirect
   customers to your website*:
   ```
   https://supergana.fun/mundial/quiniela/?session_id={CHECKOUT_SESSION_ID}
   ```
   Sin esto, el cliente paga pero no regresa al formulario.
2. **Webhook** (Developers → Webhooks → Add endpoint):
   - URL — ⚠️ **con diagonal final**:
     `https://supergana.fun/api/mundial/stripe-webhook/`
   - Evento: `checkout.session.completed`.
   - Copiar el **Signing secret** (`whsec_...`) para la env var.
3. Cantidad fija en 1 (para varios boletos se paga varias veces; cada pago
   genera un acceso único).

## 3. Variables de entorno en Vercel (proyecto `supergana`, Production)

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | (ya existe) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | (ya existe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API Keys → service_role |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` del webhook |
| `ADMIN_PASSWORD` | contraseña fuerte para /admin/mundial |
| `NEXT_PUBLIC_SITE_URL` | `https://supergana.fun` |
| `NEXT_PUBLIC_STRIPE_PAYMENT_LINK` | opcional (ya hay fallback en código) |
| `RESEND_API_KEY` | opcional — sin ella todo funciona, solo no salen correos |
| `EMAIL_FROM` | opcional, ej. `Supergana <hola@supergana.fun>` (dominio verificado en Resend) |

Las env vars aplican en el **siguiente** build: agrégalas antes del push, o
haz Redeploy en Vercel después.

## 4. Contenido pendiente

- **`lib/mundial/teams.ts`**: `QF4_HOME` = Argentina (confirmado). Falta el
  ganador de Suiza-Colombia (07-jul noche) en `QF4_AWAY` y poner
  `QF4_PENDING = false`.
- Confirmar con Rotary el texto exacto de la causa (hoy: "100 becas
  universitarias y otros proyectos de servicio del Rotary Club Ciudad Juárez").
- Validar la dinámica con tesorería/asesor legal de Rotary (comunicada como
  campaña de donativo con reconocimientos, no como apuesta).

## 5. Deploy y prueba end-to-end

1. Commit + push a `main` → Vercel deploya (GH Pages ya eliminado).
2. Compra de prueba real: pagar $100 → verificar redirect al formulario →
   llenar → confirmación → fila en `mundial_entries` → boleto usado → correo
   (si Resend). Luego **refund** desde Stripe y marcar el boleto `refunded`.
3. Verificar `/admin/mundial`: login, participante visible, export CSV.

## Reglas de premios (según flyer)

- El premio de cada etapa se **divide entre todos los que atinen**: cuartos =
  los 4 que avanzan; semis = los 2 finalistas; final = el campeón.
- Si nadie atina cuartos o semis, esa bolsa **se acumula al premio de la final**.
- No hay desempates por marcador (se quitaron subcampeón/marcador/goles).

## Operación durante el Mundial

- **Día a día**: nada; la transparencia se actualiza sola.
- **Tras cada etapa**: `/admin/mundial` → Resultados (capturar ganadores de
  cuartos / finalistas / campeón) → Ganadores → Calcular → revisar → Publicar.
- **Pagos fuera de Stripe**: pestaña Boletos → crear boleto manual → compartir
  el enlace único al confirmar el pago.
