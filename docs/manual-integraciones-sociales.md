# Manual de Integraciones Sociales — PacienteIA

> Para el equipo de PacienteIA (onboarding de clientes) y para clínicas que configuran sus propias integraciones.
> Última actualización: 2026-05-15.

---

## Contenido

1. [Resumen de Canales](#1-resumen-de-canales)
2. [WhatsApp Business API (Meta Cloud API)](#2-whatsapp-business-api-meta-cloud-api)
3. [Facebook Messenger](#3-facebook-messenger)
4. [Instagram Direct Messages](#4-instagram-direct-messages)
5. [TikTok Lead Generation](#5-tiktok-lead-generation)
6. [Variables de Entorno Requeridas](#6-variables-de-entorno-requeridas)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Resumen de Canales

| Canal | Qué hace en PacienteIA | Configuración |
|-------|------------------------|---------------|
| **WhatsApp** | Recordatorios, confirmaciones, reactivación, inbox, bot de agendamiento | Por sucursal, requiere número propio |
| **Facebook Messenger** | Leads de anuncios al pipeline + mensajes al inbox | Por clínica, OAuth con Página de Facebook |
| **Instagram DMs** | Mensajes directos al inbox | Automático al conectar Facebook (si la cuenta IG está vinculada) |
| **TikTok Lead Gen** | Leads de campañas TikTok al pipeline | Webhook manual en TikTok Ads Manager |

**Todos los canales** convergen en la misma Bandeja (`/inbox`). El staff responde desde un solo lugar sin importar por dónde escribió el paciente.

---

## 2. WhatsApp Business API (Meta Cloud API)

### 2.1 Requisitos previos

- **Meta Business Account** verificada (business.facebook.com)
- **Número de teléfono** dedicado para la clínica (no puede ser un número que ya tenga WhatsApp instalado)
- Acceso al panel de **Meta for Developers** (developers.facebook.com)

### 2.2 Configuración paso a paso

#### Paso 1 — Crear o acceder a la Meta App

1. Ve a [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**
2. Selecciona tipo: **Business**
3. Nombre: algo como `PacienteIA - [Nombre Clínica]` (o usa una app compartida para todas las clínicas)
4. Vincula tu **Meta Business Account**

> **Nota:** Si ya tienes una app con WhatsApp para otra clínica, puedes crear una nueva app por clínica o usar la misma app si el negocio es el mismo. PacienteIA soporta múltiples configuraciones por sucursal.

#### Paso 2 — Agregar el producto WhatsApp

1. En el panel de tu app → **Add Product** → **WhatsApp**
2. Ve a **WhatsApp → Getting Started**
3. Selecciona o crea tu **WhatsApp Business Account (WABA)**
4. Registra el número de teléfono de la clínica:
   - Elige método de verificación (SMS o llamada)
   - Ingresa el código recibido

#### Paso 3 — Obtener credenciales

En **WhatsApp → API Setup** encontrarás:

| Dato | Dónde está | Variable en PacienteIA |
|------|-----------|------------------------|
| **Phone Number ID** | Campo "Phone number ID" | se guarda en `branch_whatsapp_config` |
| **WABA ID** | Campo "WhatsApp Business Account ID" | referencia |
| **Temporary Access Token** | El token de prueba (24h) | para testing |
| **App ID** | Settings → Basic | referencia |
| **App Secret** | Settings → Basic → Show | `WHATSAPP_APP_SECRET` en Vercel |

#### Paso 4 — Crear un System User Token (token permanente)

El token temporal dura 24h. Para producción necesitas un token permanente:

1. Ve a [business.facebook.com](https://business.facebook.com) → **Settings** → **System Users**
2. Crea un System User (rol: Admin)
3. Asígnale acceso al **WABA** y a la **app** con permisos completos
4. Click en **Generate Token** → selecciona tu app → marca estos permisos:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
5. Guarda el token — **solo se muestra una vez**

#### Paso 5 — Configurar webhook

1. En **WhatsApp → Configuration → Webhook**
2. **Callback URL:** `https://app.pacienteia.com/api/whatsapp/webhook`
3. **Verify Token:** el valor de tu variable `WHATSAPP_VERIFY_TOKEN` en Vercel
4. Click **Verify and Save**
5. En **Webhook fields**, suscribe: `messages`

#### Paso 6 — Configurar en PacienteIA

En la app de la clínica → **Ajustes → WhatsApp**:

| Campo | Valor |
|-------|-------|
| Token de acceso | El System User Token del Paso 4 |
| Phone Number ID | El Phone Number ID del Paso 3 |
| App Secret | El App Secret del Paso 3 |
| URL de Google Reviews | (opcional) URL de tu perfil de Google para reseñas |

Guarda y prueba enviando un mensaje al número de la clínica.

#### Paso 7 — Verificar funcionamiento

1. Envía un WhatsApp al número de la clínica desde tu teléfono personal
2. El mensaje debe aparecer en **Bandeja → Inbox** en PacienteIA
3. Responde desde PacienteIA y verifica que llega al teléfono

---

### 2.3 Notas sobre Multi-Sucursal

Cada sucursal tiene su propia configuración de WhatsApp (número, token, App Secret). Si la clínica tiene 2 sucursales, necesita 2 números de teléfono distintos. Se configuran por separado en **Ajustes → WhatsApp** mientras el contexto de sucursal activa está seleccionado.

---

## 3. Facebook Messenger

### 3.1 Qué conecta

Al conectar una **Página de Facebook** a PacienteIA:
- Los mensajes de Messenger de esa página aparecen en la **Bandeja** (`/inbox`)
- Los **leads de Facebook Lead Ads** de esa página ingresan automáticamente al **Pipeline de Leads**
- El staff puede responder mensajes de Messenger desde PacienteIA sin abrir Facebook

### 3.2 Requisitos previos

- **Página de Facebook** de la clínica (no un perfil personal — debe ser una Página)
- Ser **administrador** de esa Página
- La Página debe estar conectada a la **Meta Business Account**
- La misma Meta App del Paso 2.2 (o una dedicada) con el producto **Messenger** agregado

### 3.3 Configuración paso a paso

#### Paso 1 — Agregar el producto Messenger a tu Meta App

1. En developers.facebook.com → tu app → **Add Product** → **Messenger**
2. En **Messenger → Settings**:
   - Bajo "Access Tokens", vincula tu Página de Facebook
   - Genera un token de acceso de Página (este token es el que usa el OAuth flow de PacienteIA)

#### Paso 2 — Conectar desde PacienteIA

1. En PacienteIA → **Ajustes → Redes Sociales**
2. Click en **Conectar →** en la tarjeta de Facebook Messenger
3. Aparece la ventana de autorización de Facebook — selecciona la Página de la clínica
4. Acepta los permisos solicitados
5. Regresarás a PacienteIA con confirmación "Facebook e Instagram conectados"

> El botón "Conectar" te lleva a Facebook OAuth. Necesitas estar logueado en Facebook con una cuenta que administre la Página de la clínica.

#### Paso 3 — Configurar webhook en Meta App

Este paso es **necesario para recibir mensajes en tiempo real**:

1. En tu Meta App → **Messenger → Settings → Webhooks**
2. Click en **Add Callback URL**:
   - **Callback URL:** `https://app.pacienteia.com/api/facebook/webhook`
   - **Verify Token:** el valor de `FACEBOOK_WEBHOOK_VERIFY_TOKEN` en Vercel (el equipo de PacienteIA te lo proporciona)
3. Click **Verify and Save**
4. En **Webhook fields**, suscribe: `messages`, `messaging_postbacks`, `messaging_optins`
5. Luego, bajo la sección **Subscriptions**, suscribe tu Página a los webhooks

#### Paso 4 — Verificar funcionamiento

1. Envía un mensaje a la Página de Facebook de la clínica (desde tu Facebook personal o desde el buscador)
2. El mensaje debe aparecer en **Bandeja** de PacienteIA con etiqueta "Facebook Messenger"
3. Responde desde PacienteIA y verifica que llega a Messenger

### 3.4 Leads de Facebook Lead Ads

Para que los leads de tus anuncios entren automáticamente al pipeline:

1. En tu Meta App → **Messenger → Settings → Webhooks** → asegúrate de suscribir el campo `leadgen`
2. Crea un **Lead Ad** en Facebook Ads Manager apuntando a tu Página
3. Cuando alguien complete el formulario, el lead aparece en PacienteIA → **Leads** con fuente `Facebook`

**Importante:** El formulario del Lead Ad debe incluir al menos un campo de teléfono (`phone_number`) para que PacienteIA pueda procesar el lead correctamente.

---

## 4. Instagram Direct Messages

### 4.1 Cómo funciona

Instagram DMs se conectan **automáticamente** al conectar Facebook Messenger, **siempre que** tu cuenta de Instagram de negocio esté vinculada a tu Página de Facebook.

No hay un botón separado para Instagram — la conexión se establece en el mismo flujo OAuth de Facebook.

### 4.2 Requisitos previos

- **Cuenta de Instagram de Negocio** (no una cuenta personal ni de creador — debe ser de Negocio/Business)
- La cuenta de Instagram debe estar **vinculada a tu Página de Facebook**:
  - Ve a tu Página de Facebook → **Settings → Instagram** → Conectar cuenta

### 4.3 Verificar que Instagram está conectado

En **Ajustes → Redes Sociales**, la tarjeta de Instagram debe mostrar:
- Estado: **Conectado**
- "Vinculado a [nombre de tu página]"

Si muestra "Tu página de Facebook no tiene una cuenta de Instagram de negocio vinculada":
1. Ve a tu Página de Facebook (facebook.com/[tu-pagina]) → Configuración → Instagram
2. Conecta tu cuenta de Instagram de Negocio
3. Vuelve a PacienteIA → **Ajustes → Redes Sociales** → Desconecta y reconecta Facebook

### 4.4 Configuración de webhook para Instagram

En tu Meta App también necesitas suscribir el webhook para Instagram:

1. En tu Meta App → **Instagram Graph API → Settings → Webhooks** (o desde Webhooks → Instagram)
2. Misma Callback URL: `https://app.pacienteia.com/api/facebook/webhook`
3. Mismo Verify Token
4. Suscribe: `messages`, `messaging_postbacks`

> **Nota técnica:** El mismo webhook recibe tanto mensajes de Messenger como de Instagram. PacienteIA los distingue por el campo `object` en el payload de Meta.

### 4.5 Verificar funcionamiento

1. Envía un DM a la cuenta de Instagram de la clínica
2. El mensaje debe aparecer en **Bandeja** con etiqueta "Instagram DM"
3. Responde desde PacienteIA

---

## 5. TikTok Lead Generation

### 5.1 Qué conecta

TikTok no tiene OAuth como Facebook. La integración funciona via **webhook**: cuando alguien completa un formulario de Lead Generation en TikTok, TikTok envía los datos a PacienteIA, que los procesa como un lead nuevo en el pipeline.

### 5.2 Requisitos previos

- **Cuenta de TikTok Ads** con acceso a **TikTok Ads Manager**
- Una campaña activa o en preparación con **Lead Generation** como objetivo
- Acceso a la sección de **Webhooks** en TikTok Ads Manager

### 5.3 Configuración paso a paso

#### Paso 1 — Obtener el Clinic ID

En PacienteIA → **Ajustes → Redes Sociales**, en la sección de TikTok encontrarás el **Clinic ID** (UUID de tu organización). Cópialo — lo necesitarás en el Paso 3.

#### Paso 2 — Configurar el webhook en TikTok Ads Manager

1. Ve a [ads.tiktok.com](https://ads.tiktok.com) → inicia sesión
2. En el menú superior: **Tools** → **Lead Generation** → **Webhooks** (o "Webhook Settings")
3. Click en **Create Webhook**
4. Configura:
   - **Webhook Name:** `PacienteIA - [Nombre Clínica]`
   - **Webhook URL:** `https://app.pacienteia.com/api/intake/tiktok`
   - **Events:** marca `New Lead`
5. Guarda el webhook

#### Paso 3 — Agregar el campo oculto `clinic_id` en tu formulario de Lead Gen

Este es el paso más importante: PacienteIA necesita saber a qué clínica pertenece cada lead.

En TikTok Ads Manager, al crear o editar tu formulario de Lead Generation:
1. En la sección de **Questions / Preguntas**, busca la opción de agregar **Hidden Fields** o **Campos Ocultos**
2. Agrega un campo oculto con:
   - **Field Name:** `clinic_id`
   - **Value:** el UUID de tu organización (el Clinic ID del Paso 1)
3. Guarda el formulario

**Si TikTok no muestra opción de Hidden Fields en la interfaz:**
- Algunos formatos de campaña lo permiten bajo "Advanced Settings" al crear el formulario instantáneo
- Alternativamente, incluye el `clinic_id` en los parámetros UTM o contacta al equipo de PacienteIA para configuración manual

#### Paso 4 — Verificar funcionamiento

TikTok ofrece una opción de **Test Lead** en la configuración del webhook para enviar un lead de prueba. Úsala y verifica que aparezca en **Leads** de PacienteIA con fuente `TikTok`.

### 5.4 Campos que PacienteIA extrae del formulario TikTok

| Campo TikTok | Mapeo en PacienteIA |
|-------------|---------------------|
| `name` / `full_name` | Nombre del lead |
| `phone_number` | Teléfono |
| `email` | Email |
| `clinic_id` (oculto) | Identifica la clínica destino |
| Otros campos | Guardados en metadata del lead |

---

## 6. Variables de Entorno Requeridas

Estas variables se configuran en **Vercel** (el equipo de PacienteIA las gestiona para cada cliente según su plan):

### Variables globales de PacienteIA (una sola vez)

| Variable | Descripción | Cómo obtenerla |
|----------|-------------|----------------|
| `FACEBOOK_APP_ID` | ID de la Meta App usada para Messenger/Instagram | developers.facebook.com → tu app → Settings → Basic |
| `FACEBOOK_APP_SECRET` | Secret de la Meta App | Settings → Basic → Show (misma app que WhatsApp) |
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | Token secreto para verificar webhooks de Facebook | Cualquier string seguro que tú eliges (ej: `"paxi_fb_2026_xyz"`) |

### Variables por sucursal (se guardan en DB, no en Vercel)

| Dato | Dónde se configura | Descripción |
|------|--------------------|-------------|
| WhatsApp Access Token | Ajustes → WhatsApp | System User Token del Meta Business |
| WhatsApp Phone Number ID | Ajustes → WhatsApp | ID del número registrado en la app |
| WhatsApp App Secret | Ajustes → WhatsApp | Para verificar HMAC del webhook |

### Cómo agregar variables en Vercel

```bash
npx vercel env add FACEBOOK_APP_ID production
npx vercel env add FACEBOOK_APP_SECRET production
npx vercel env add FACEBOOK_WEBHOOK_VERIFY_TOKEN production
# Luego redeploy:
npx vercel --prod
```

---

## 7. Troubleshooting

### El botón "Conectar" de Facebook/Instagram me lleva a la página de inicio

**Causa:** Tu cuenta de PacienteIA tiene rol de plataforma (superadmin). El middleware de rutas estaba interceptando la navegación.
**Solución:** Está corregido en la versión actual. Si persiste, asegúrate de tener la versión más reciente desplegada.

### Aparece el error "Integración no configurada"

**Causa:** Las variables `FACEBOOK_APP_ID` o `FACEBOOK_APP_SECRET` no están en Vercel.
**Solución:** Agregarlas con `npx vercel env add ...` y hacer redeploy.

### Me autoriza en Facebook pero regresa con "Error al conectar: fallo en intercambio de tokens"

**Causas posibles:**
1. `FACEBOOK_APP_SECRET` incorrecto
2. La `redirect_uri` en la Meta App no coincide — ve a Meta App → **Facebook Login → Settings → Valid OAuth Redirect URIs** y agrega `https://app.pacienteia.com/api/auth/facebook/callback`

### Me autoriza en Facebook pero Instagram aparece como "No vinculado"

**Causa:** La Página de Facebook no tiene una cuenta de Instagram de Negocio vinculada.
**Solución:** En Facebook → tu Página → Configuración → Instagram → Conectar cuenta de Instagram. Luego reconecta desde PacienteIA.

### Los mensajes de Messenger/Instagram no aparecen en la Bandeja

**Causas posibles (en orden):**
1. El webhook no está configurado en la Meta App → repite el Paso 3.3.3
2. La Página no está suscrita al webhook → en Meta App → Messenger → Webhooks → verifica que tu Página aparece bajo "Subscriptions"
3. La app está en modo Desarrollo — solo recibe mensajes de testers y admins registrados → pasa la app a modo Producción o agrega la cuenta como tester

### Los leads de Facebook Lead Ads no llegan al pipeline

1. Verifica que el webhook está suscrito al campo `leadgen` (no solo `messages`)
2. El formulario del Lead Ad debe tener un campo de teléfono
3. Revisa que la Página esté suscrita en la sección de Subscriptions del webhook

### Los leads de TikTok no llegan

1. Verifica que el `clinic_id` en el campo oculto del formulario coincide exactamente con el UUID de la organización (sin espacios extra)
2. El webhook URL en TikTok Ads Manager debe ser exactamente: `https://app.pacienteia.com/api/intake/tiktok`
3. Usa el "Test Lead" de TikTok para enviar un lead de prueba y verifica en PacienteIA → Leads

### Error 403 en el webhook de TikTok

El endpoint de TikTok requiere que los datos vengan en el formato correcto. Verifica que TikTok esté enviando el campo `clinic_id` como parte del payload. Contacta al equipo de PacienteIA con el payload de ejemplo que TikTok muestra en su configuración de webhook.

---

## Apéndice — URLs de webhook de PacienteIA

| Canal | URL |
|-------|-----|
| WhatsApp | `https://app.pacienteia.com/api/whatsapp/webhook` |
| Facebook Messenger + Instagram | `https://app.pacienteia.com/api/facebook/webhook` |
| TikTok Lead Gen | `https://app.pacienteia.com/api/intake/tiktok` |
| Formularios web embed | `https://app.pacienteia.com/api/intake/webform` |

---

*Documento interno de PacienteIA — illari-labs*
