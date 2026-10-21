# Lanzamiento: tiendas, betas y web

Todo lo que se puede dejar en el repositorio ya está aquí. Este documento recoge los pasos que necesitan cuentas (Supabase, Google Cloud, Vercel, Expo, Apple, Google Play, Sentry) y las respuestas a los cuestionarios de las tiendas.

## 0. Puesta en marcha: cuentas con Google, sincronización, web y Android

Todo es gratis para empezar (planes gratuitos de Supabase, Vercel y Expo). Orden recomendado:

### 0.1 Supabase (base de datos y cuentas)

1. Crea un proyecto en [supabase.com](https://supabase.com) (plan Free: 500 MB de base de datos y 1 GB de ficheros). Elige una región cercana (p. ej. `eu-west`).
2. **SQL Editor** → pega y ejecuta `supabase/migrations/20261020000000_sync.sql`. Crea la tabla `sync_rows` con seguridad por usuario (RLS), las funciones `push_changes` y `delete_account` y el bucket privado `attachments`.
   Después ejecuta también `supabase/migrations/20261021000000_hardening.sql` (refuerzo de seguridad: solo las tablas de la app, filas de 1 MB como máximo, 50 000 filas por cuenta y ficheros de 25 MB como máximo, solo imágenes y audio).
   - **Authentication → Sign In / Providers → Email: desactívalo.** Viene activado por defecto y permitiría crear cuentas con email y contraseña por la API aunque la app solo use Google.
3. **Project Settings → API**: copia la _Project URL_ y la clave _publishable_ (o _anon_). Son públicas por diseño: la seguridad la ponen las políticas RLS.
4. Copia `.env.example` a `.env.local` y rellena `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` para desarrollo.

> El plan Free **pausa el proyecto tras 7 días sin actividad**. Con uso normal no pasa; si pasa, se reactiva desde el panel sin perder datos.

### 0.2 Google (iniciar sesión / crear cuenta)

1. En [Google Cloud Console](https://console.cloud.google.com): crea un proyecto → **APIs y servicios → Pantalla de consentimiento de OAuth** (tipo _Externo_; nombre "Notas", email de soporte, dominio de la web y enlace a `/privacy`). Mientras esté en modo _Prueba_ solo entran los usuarios de prueba que añadas; publícala cuando quieras abrirla a todos.
2. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web.**
   - _URI de redirección autorizados_: `https://<tu-proyecto>.supabase.co/auth/v1/callback`.
3. En Supabase: **Authentication → Sign In / Providers → Google**: activa y pega el _Client ID_ y el _Client secret_.
4. En Supabase: **Authentication → URL Configuration**:
   - _Site URL_: la URL de la web (p. ej. `https://notes-lavg.vercel.app`).
   - _Redirect URLs_: `https://notes-lavg.vercel.app/auth/callback`, `http://localhost:8081/auth/callback` (desarrollo) y `notas://**` (app de Android/iOS).

No hace falta ningún módulo nativo ni la huella SHA-1: en el móvil se abre el navegador del sistema y vuelve a la app por `notas://auth/callback`. La primera vez que alguien entra, se crea su cuenta.

### 0.3 Web en Vercel (y app de escritorio)

1. En [vercel.com](https://vercel.com) → _Add New → Project_ → importa el repositorio de GitHub. `vercel.json` ya lo configura todo (compila con `expo export -p web`, sirve `dist/client` y las páginas con la función `api/index.ts`, y pone las cabeceras COOP/COEP que necesita SQLite).
2. **Settings → Environment Variables** (Production y Preview): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y, cuando lo tengas, `EXPO_PUBLIC_ANDROID_APK_URL`. Se incrustan al compilar: tras cambiarlas, vuelve a desplegar.
3. Cada push a `main` despliega en producción; el resto de ramas, una vista previa. Si el dominio no es `notes-lavg.vercel.app`, cámbialo en `store.config.json`, en las fichas de Google Play y en las URL de Supabase y Google.
4. **Escritorio:** la web es instalable (PWA, `public/manifest.json`). En Chrome o Edge (Windows, macOS, Linux) aparece "Instalar Notas" en la barra de direcciones y en Ajustes → Descargar la app; en Safari (macOS), Archivo → "Añadir al Dock". Se abre en su propia ventana y funciona con su propia base de datos local, sincronizada con la cuenta.

> **Netlify** también sirve: el adaptador es `expo-server/adapter/netlify` (ver la guía de Expo "API routes → Netlify"). Está preparado solo Vercel para no mantener dos configuraciones.

### 0.4 Android (APK para descargar)

1. `npx eas-cli@latest login` y `npx eas-cli@latest init` (cuenta gratuita de Expo).
2. Variables de la app en EAS (entornos `preview` y `production`), visibilidad _plain text_:
   ```bash
   npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --value https://<tu-proyecto>.supabase.co
   ```
   (y lo mismo con `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, y para `production`).
3. Compila el APK: `npx eas-cli@latest build -p android --profile preview`. Al terminar, la página de la build tiene el enlace y un QR para instalarlo (hay que permitir "instalar apps de origen desconocido"). Pon ese enlace en `EXPO_PUBLIC_ANDROID_APK_URL` en Vercel para ofrecerlo desde la web.
4. Para Google Play, sigue §1 y §2 (perfil `production`, `.aab`).

> El perfil `preview` no sube los source maps a Sentry (`SENTRY_DISABLE_AUTO_UPLOAD` en `eas.json`): sin las variables de Sentry la build fallaba en ese paso. Para `production`, configura Sentry (§1.2) o añade la misma variable a ese perfil.

## 1. Cuentas y configuración (una vez)

1. **Expo / EAS.** `npx eas-cli@latest login` y `npx eas-cli@latest init`: añade `extra.eas.projectId` y `owner` a `app.json`. Conecta el repositorio de GitHub en el panel del proyecto para que corran los workflows de `.eas/workflows/`.
2. **Sentry.** Crea el proyecto (plataforma React Native) y guarda en las variables de entorno de EAS (`npx eas-cli@latest env:create`), en los entornos `preview` y `production`:
   - `EXPO_PUBLIC_SENTRY_DSN`: DSN del proyecto (visibilidad _plain text_; va dentro de la app).
   - `SENTRY_ORG` y `SENTRY_PROJECT`: _slug_ de la organización y del proyecto.
   - `SENTRY_AUTH_TOKEN`: token de organización (visibilidad _secret_), para subir los source maps al compilar.

   Sin DSN la app no envía nada (desarrollo, tests y E2E). Los informes no llevan contenido de las notas (`src/lib/monitoring.ts`) y el usuario puede desactivarlos en Ajustes → Privacidad.

3. **Apple.** Crea la app en App Store Connect con el bundle id `com.novotechn.notas`. La primera vez, `npx eas-cli@latest submit -p ios` configura la API key de App Store Connect; después las subidas van solas.
4. **Google Play.** Crea la app con el paquete `com.novotechn.notas`. Google exige que **la primera subida sea manual**: descarga el `.aab` de la primera build de producción y súbelo a la pista de pruebas internas. Después crea una cuenta de servicio con acceso a la API de Google Play y súbela a EAS (`npx eas-cli@latest credentials -p android`) para las siguientes.
5. **Web.** En Vercel (ver §0.3). Las URL de `store.config.json` asumen `https://notes-lavg.vercel.app`: si el dominio es otro, cámbialas allí y en las fichas de Google Play.

## 2. Betas

```bash
npx eas-cli@latest workflow:run .eas/workflows/beta.yml
```

Compila las versiones de tienda (el número de build sube solo) y las sube a **TestFlight** y a la **pista interna** de Google Play. En Android la versión queda en borrador (`releaseStatus: draft` en `eas.json`) mientras la app no esté publicada; luego se puede pasar a `completed`. En TestFlight, los probadores internos la reciben al terminar de procesarse; para probadores externos hace falta la revisión de la beta.

## 3. Fichas de las tiendas

- **App Store:** `store.config.json` (EAS Metadata). Se sube con `npx eas-cli@latest metadata:push` y se trae lo editado en la web con `metadata:pull`. Antes de subirla, añade los datos de contacto para la revisión (`apple.review`: nombre, email y teléfono); no hace falta cuenta de prueba.
- **Google Play:** textos en `store/google-play/<idioma>/` (título ≤ 30, descripción breve ≤ 80, descripción completa ≤ 4000). Se pegan en la consola de Google Play (EAS Metadata solo cubre el App Store).
- **Nombre:** "Notas" a secas probablemente está ocupado en ambas tiendas; las fichas usan "Notas: listas y notas de voz". Compruébalo al crear la app.

### Capturas

Hacen falta en los dos idiomas (es-ES, en-US):

| Tienda      | Tamaños                                                           |
| ----------- | ----------------------------------------------------------------- |
| App Store   | iPhone 6,9" (1320 × 2868) y iPad 13" (2064 × 2752)                |
| Google Play | Teléfono (1080 × 1920 o más), icono 512 × 512, gráfico 1024 × 500 |

Pantallas propuestas: lista de notas en cuadrícula con colores, una nota con formato e imagen, una lista con elementos completados, recordatorios, carpetas y etiquetas, ajustes con el bloqueo. Usa datos de ejemplo, nunca notas reales.

## 4. Privacidad

La política está en la propia app, en `/privacy` (Ajustes → Privacidad → Política de privacidad), y en la web en `https://notes-lavg.vercel.app/privacy`. Si cambia el texto, actualiza `PRIVACY_POLICY_DATE` en `src/lib/app-info.ts`. **Revisa el email de contacto (`CONTACT_EMAIL`) antes de publicar: aparece en la política.**

### App Store: "Privacidad de la app"

- **¿Recopilas datos?** Sí:
  - **Diagnóstico** (_Datos de fallos_ y _Otros datos de diagnóstico_): **no** vinculados a la identidad, sin rastreo. Finalidad: funcionalidad de la app.
  - Solo si el usuario activa la sincronización (inicia sesión): **Información de contacto** (_Nombre_, _Dirección de correo electrónico_) y **Contenido del usuario** (_Fotos o vídeos_, _Datos de audio_, _Otro contenido del usuario_). **Vinculados** a la identidad (la cuenta), **sin** rastreo. Finalidad: funcionalidad de la app.
- El manifiesto de privacidad de iOS (`ios.privacyManifests` en `app.json`) declara lo mismo y las APIs de "motivo obligatorio" que usan las dependencias.
- **Eliminar la cuenta:** Ajustes → Cuenta y sincronización → Eliminar la cuenta (lo exige la guía 5.1.1(v)).

### Google Play: "Seguridad de los datos"

- **¿Recoge o comparte datos?** Recoge:
  - _Información y rendimiento de la app_ → **Registros de fallos** y **Diagnóstico**. Opcional (se desactiva en Ajustes). Finalidad: analítica (estabilidad).
  - Solo con la sincronización activada: _Información personal_ → **Nombre** y **Dirección de correo electrónico**; _Fotos y vídeos_ → **Fotos**; _Archivos de audio_ → **Grabaciones de voz**; _Archivos y documentos_ / _Otro contenido_ → **las notas**. Opcional. Finalidad: **funcionalidad de la app** y **gestión de la cuenta**.
- **¿Se comparten?** No (Sentry y Supabase actúan como proveedores de servicios).
- **¿Se procesan de forma efímera?** No.
- **¿Cifrados en tránsito?** Sí.
- **¿Puede pedir que se eliminen?** Sí: en la app (Ajustes → Cuenta y sincronización → Eliminar la cuenta). Google Play pide además una **URL** para solicitarlo sin la app: usa la política (`/privacy`, sección "Cuenta y sincronización", con el email de contacto).

### Clasificación por edades

- **App Store:** todas las respuestas "Ninguno" (ya en `store.config.json`) → 4+.
- **Google Play (IARC):** categoría "Utilidades, productividad, comunicación u otros"; todo "No" → PEGI 3 / Para todos. Público objetivo recomendado: mayores de 13 años (evita los requisitos de la política de familias).

## 5. Web

Se despliega en Vercel con cada push (ver §0.3). La web usa `output: "server"`: las páginas las sirve `api/index.ts` (`expo-server`), que aplica las cabeceras COOP/COEP del plugin de `expo-router`, y `vercel.json` las pone también en los ficheros estáticos. Sin ellas SQLite no abre en el navegador (en `output: "single"` no se enviaban). Lo comprueban los E2E web (`npm run e2e:web`).

## 6. Antes de cada versión

- [ ] `npm run check` y `npm run e2e:web` en verde.
- [ ] E2E nativos: etiqueta el PR con `e2e` (`.eas/workflows/e2e.yml`) o `npm run e2e:native` con un simulador.
- [ ] Prueba la beta en un iPhone y un Android reales (ver los pendientes de cada fase en `PLAN.md`).
- [ ] Sube la versión (`version` en `app.json`) y las notas de la versión en `store.config.json`.
