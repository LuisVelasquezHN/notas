# Lanzamiento: tiendas, betas y web

Todo lo que se puede dejar en el repositorio ya está aquí. Este documento recoge los pasos que necesitan cuentas (Expo, Apple, Google, Sentry) y las respuestas a los cuestionarios de las tiendas.

## 1. Cuentas y configuración (una vez)

1. **Expo / EAS.** `npx eas-cli@latest login` y `npx eas-cli@latest init`: añade `extra.eas.projectId` y `owner` a `app.json`. Conecta el repositorio de GitHub en el panel del proyecto para que corran los workflows de `.eas/workflows/`.
2. **Sentry.** Crea el proyecto (plataforma React Native) y guarda en las variables de entorno de EAS (`npx eas-cli@latest env:create`), en los entornos `preview` y `production`:
   - `EXPO_PUBLIC_SENTRY_DSN`: DSN del proyecto (visibilidad _plain text_; va dentro de la app).
   - `SENTRY_ORG` y `SENTRY_PROJECT`: _slug_ de la organización y del proyecto.
   - `SENTRY_AUTH_TOKEN`: token de organización (visibilidad _secret_), para subir los source maps al compilar.

   Sin DSN la app no envía nada (desarrollo, tests y E2E). Los informes no llevan contenido de las notas (`src/lib/monitoring.ts`) y el usuario puede desactivarlos en Ajustes → Privacidad.

3. **Apple.** Crea la app en App Store Connect con el bundle id `com.novotechn.notas`. La primera vez, `npx eas-cli@latest submit -p ios` configura la API key de App Store Connect; después las subidas van solas.
4. **Google Play.** Crea la app con el paquete `com.novotechn.notas`. Google exige que **la primera subida sea manual**: descarga el `.aab` de la primera build de producción y súbelo a la pista de pruebas internas. Después crea una cuenta de servicio con acceso a la API de Google Play y súbela a EAS (`npx eas-cli@latest credentials -p android`) para las siguientes.
5. **Web.** `npx eas-cli@latest deploy --prod` la primera vez para elegir el subdominio. Las URL de `store.config.json` asumen `https://notas.expo.app`: si el subdominio es otro, cámbialas allí y en las fichas de Google Play.

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

La política está en la propia app, en `/privacy` (Ajustes → Privacidad → Política de privacidad), y en la web en `https://notas.expo.app/privacy`. Si cambia el texto, actualiza `PRIVACY_POLICY_DATE` en `src/lib/app-info.ts`. **Revisa el email de contacto (`CONTACT_EMAIL`) antes de publicar: aparece en la política.**

### App Store: "Privacidad de la app"

- **¿Recopilas datos?** Sí, solo **Diagnóstico**:
  - _Datos de fallos_ (crash data) y _Otros datos de diagnóstico_.
  - **No** vinculados a la identidad del usuario. **No** se usan para rastrear.
  - Finalidad: **Funcionalidad de la app**.
- Nada más: las notas, fotos, audios y recordatorios no salen del dispositivo, así que no cuentan como datos recopilados.
- El manifiesto de privacidad de iOS (`ios.privacyManifests` en `app.json`) declara lo mismo y las APIs de "motivo obligatorio" que usan las dependencias.

### Google Play: "Seguridad de los datos"

- **¿Recoge o comparte datos?** Recoge: _Información y rendimiento de la app_ → **Registros de fallos** y **Diagnóstico**.
- **¿Se comparten?** No (Sentry actúa como proveedor de servicios).
- **¿Se procesan de forma efímera?** No.
- **¿Es obligatorio?** No: el usuario puede desactivarlo en Ajustes.
- **Finalidad:** Analítica (estabilidad de la app).
- **¿Cifrados en tránsito?** Sí.
- **¿Puede pedir que se eliminen?** No hay datos vinculados al usuario; indica el email de contacto.

### Clasificación por edades

- **App Store:** todas las respuestas "Ninguno" (ya en `store.config.json`) → 4+.
- **Google Play (IARC):** categoría "Utilidades, productividad, comunicación u otros"; todo "No" → PEGI 3 / Para todos. Público objetivo recomendado: mayores de 13 años (evita los requisitos de la política de familias).

## 5. Web

Cada push a `main` despliega en producción con `.eas/workflows/deploy-web.yml` (el resto de ramas, una vista previa). A mano:

```bash
npm run web:export && npx eas-cli@latest deploy --prod
```

La web usa `output: "server"`: así EAS Hosting sirve las cabeceras COOP/COEP que necesita SQLite (en `output: "single"` no las enviaba y la base de datos no abría). Lo comprueban los E2E web (`npm run e2e:web`).

## 6. Antes de cada versión

- [ ] `npm run check` y `npm run e2e:web` en verde.
- [ ] E2E nativos: etiqueta el PR con `e2e` (`.eas/workflows/e2e.yml`) o `npm run e2e:native` con un simulador.
- [ ] Prueba la beta en un iPhone y un Android reales (ver los pendientes de cada fase en `PLAN.md`).
- [ ] Sube la versión (`version` en `app.json`) y las notas de la versión en `store.config.json`.
