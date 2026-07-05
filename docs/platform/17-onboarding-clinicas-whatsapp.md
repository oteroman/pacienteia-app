# 17 — Onboarding de Clínicas: WhatsApp Multi-App

## Modelo de Responsabilidad

Cada clínica tiene su **propia app de Meta** con su propio número de WhatsApp. La facturación del consumo de mensajes va directamente a la cuenta de Meta de la clínica. PacienteIA no tiene responsabilidad sobre el tráfico de mensajes de ninguna clínica.

```
Clínica A — su app Meta — su WABA — su facturación
Clínica B — su app Meta — su WABA — su facturación
Clínica C — su app Meta — su WABA — su facturación
                ↓ (todos apuntan al mismo webhook)
    https://app.pacienteia.com/api/whatsapp/webhook
    HMAC validado con el App Secret de CADA clínica
```

---

## HMAC Per-Clínica

Cada mensaje que Meta envía al webhook está firmado con el `App Secret` de la app de la clínica que lo origina. El webhook valida la firma usando el secret correspondiente a ese `phone_number_id`.

**Columna en DB:** `branch_whatsapp_config.app_secret_enc` — encriptado con AES-256-GCM (mismo key que el access token).

**Fallback:** Si una rama no tiene `app_secret_enc` configurado, se valida con el global `WHATSAPP_APP_SECRET`. Esto mantiene compatibilidad con instalaciones anteriores a esta arquitectura (ej: La Rosa).

---

## Qué da PacienteIA a la clínica

Visible en **Ajustes → WhatsApp**:

| Dato | Dónde encontrarlo |
|------|-------------------|
| URL de webhook | `https://app.pacienteia.com/api/whatsapp/webhook` |
| Token de verificación | Ajustes → WhatsApp → se muestra con botón Copiar |

---

## Qué da la clínica a PacienteIA

La clínica obtiene estos datos desde su panel de Meta:

| Dato | Dónde encontrarlo en Meta |
|------|--------------------------|
| Phone Number ID | Meta → su app → WhatsApp → Números de teléfono |
| WABA ID | Meta → su app → WhatsApp → Información de la cuenta |
| Access Token | System User Token permanente de su WABA |
| **App Secret** | Meta → su app → Configuración → Básica → App Secret |

---

## Pasos de configuración

### En Meta (la clínica lo hace)

1. Crear app en Meta for Developers (tipo: Business)
2. Agregar producto WhatsApp
3. Registrar su número de teléfono
4. En WhatsApp → Configuración → Webhooks:
   - URL: `https://app.pacienteia.com/api/whatsapp/webhook`
   - Token de verificación: (el que PacienteIA les dio)
   - Suscribirse al campo `messages`
5. Crear System User con permisos sobre el WABA → generar token permanente

### En PacienteIA (el admin lo hace)

1. Insertar en `branch_whatsapp_config`:
   ```sql
   INSERT INTO branch_whatsapp_config
     (branch_id, organization_id, phone_number_id, waba_id, access_token_enc, display_name, status)
   VALUES (...)
   ```
   — `access_token_enc` = resultado de `encryptToken(token)`

2. Llamar `subscribed_apps` para vincular el WABA:
   ```
   POST https://graph.facebook.com/v20.0/{waba_id}/subscribed_apps
   Authorization: Bearer {access_token_de_la_clinica}
   ```
   > **Nota:** Si la clínica configura el webhook desde su propio panel de Meta, Meta hace esto automáticamente. Solo es necesario llamarlo manualmente si se configura programáticamente.

3. La clínica pega su `App Secret` en **Ajustes → WhatsApp → App Secret** — se encripta y guarda en `app_secret_enc`.

---

## Verify Token: uno global para todos

El `WHATSAPP_VERIFY_TOKEN` es único para toda la plataforma. Solo PacienteIA lo conoce y lo proporciona a cada clínica durante el onboarding. No hay riesgo en compartirlo con la clínica que está configurando — es solo para el handshake inicial de verificación del webhook, no para seguridad operativa.

La seguridad real está en el `App Secret` (HMAC por mensaje).

---

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `app/api/whatsapp/webhook/route.ts` | Webhook principal — HMAC per-clínica |
| `app/(dashboard)/settings/whatsapp/page.tsx` | UI para ver URL/token y configurar App Secret |
| `lib/crypto/whatsapp-token.ts` | `encryptToken` / `decryptToken` AES-256-GCM |
| `supabase/migrations/20260513000002_branch_app_secret.sql` | Columna `app_secret_enc` en `branch_whatsapp_config` |
