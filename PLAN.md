# Notas — Plan del proyecto

App de notas **local-first** en React Native (Expo) para **iOS, Android y web**: varios tipos de nota, carpetas, etiquetas, colores, anclado, filtros, recordatorios y notificaciones.

## 0. Decisiones tomadas

| #   | Decisión       | Resolución                                                | Implicaciones                                                                                                                                                                                                      |
| --- | -------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Sincronización | **Local-first; sincronización opcional desde la fase 7.** | El esquema es _sync-ready_ desde el día 1 (UUID v7, `updated_at`, borrado lógico, `sort_key` fraccional). En la fase 7: cuenta con Google y sincronización con Supabase (ver §9). Sin cuenta, todo sigue en local. |
| 2   | Monetización   | **Gratis**, preparado para pagos en el futuro.            | Capa `entitlements` (`useEntitlement('feature')`) que hoy devuelve `true` para todo. Si se cobra más adelante, se conecta RevenueCat sin tocar las pantallas.                                                      |
| 3   | Plataformas    | **iOS + Android**, más **web si es viable**.              | Es viable: Expo Router, expo-sqlite (WASM + OPFS) y Drizzle funcionan en web. Las limitaciones están en §3.1. Se trata como plataforma de segundo nivel: debe funcionar, pero no se le dedica pulido específico.   |
| 4   | Editor         | **Recomendación aplicada (ver abajo).**                   | —                                                                                                                                                                                                                  |

### Decisión 4: estrategia del editor

1. **MVP (fases 1–3): editor de texto plano**, basado en `TextInput` multilinea y aislado tras una interfaz `EditorAdapter`.
2. **El contenido se guarda desde el primer día como JSON de ProseMirror/TipTap** (`{ type: 'doc', content: [...] }`), aunque solo tenga párrafos. También se guarda `content_text` (texto plano) para la vista previa y la búsqueda.
3. **Fase 4: editor enriquecido** con **TipTap**. Se planeó 10tap-editor en nativo, pero se usa TipTap en un **DOM component** de Expo (`'use dom'`): el mismo código corre en una webview (`@expo/dom-webview`, incluida en el SDK) en iOS y Android, y como componente normal en web, sin módulos nativos extra. Como el formato ya era el de TipTap, **no hubo migración de datos**: solo cambió la implementación del adapter.

**Por qué:** el editor enriquecido es la pieza más inestable de cualquier app de notas en React Native (teclado, foco, scroll y webview). Separarlo del núcleo permite lanzar antes un MVP sólido sin quedar atados a una librería, y el formato de almacenamiento ya es el definitivo.

---

## 1. Catálogo de funcionalidades

**P0** = MVP · **P1** = v1.0 (lanzamiento) · **P2** = después del lanzamiento

### Tipos de nota

| Funcionalidad                                                            | Prioridad |
| ------------------------------------------------------------------------ | --------- |
| Nota de texto (texto plano, luego enriquecido)                           | P0        |
| Checklist: marcar, reordenar, completados al final, sangría de subtareas | P0        |
| Nota con imágenes (cámara o galería)                                     | P1        |
| Nota de voz                                                              | P1        |
| Plantillas (reunión, compra, diario…)                                    | P1        |
| Enlaces con vista previa                                                 | P2        |
| Dibujo o boceto                                                          | P2        |

### Organización

| Funcionalidad                                           | Prioridad |
| ------------------------------------------------------- | --------- |
| Carpetas anidadas (hasta 3 niveles), con color e icono  | P0        |
| Colores de nota (10 tokens, adaptados a claro y oscuro) | P0        |
| Anclar                                                  | P0        |
| Archivar                                                | P0        |
| Papelera (borrado automático a los 30 días, restaurar)  | P0        |
| Vista lista o cuadrícula (masonry)                      | P0        |
| Ordenar por modificación, creación o título             | P0        |
| Orden manual (drag & drop)                              | P1        |
| Duplicar y mover entre carpetas                         | P0        |
| Etiquetas                                               | P1        |
| Favoritos                                               | P1        |
| Selección múltiple y acciones en lote                   | P1        |

### Búsqueda y filtros

| Funcionalidad                                                                               | Prioridad |
| ------------------------------------------------------------------------------------------- | --------- |
| Búsqueda de texto completo (FTS5; ver nota de web en §3.1)                                  | P0        |
| Filtros combinables: tipo, color, etiqueta, carpeta, con recordatorio, con adjuntos, fechas | P1        |
| Filtros guardados ("carpetas inteligentes")                                                 | P1        |
| Búsquedas recientes y resaltado de coincidencias                                            | P1        |

### Recordatorios y notificaciones

| Funcionalidad                                                            | Prioridad |
| ------------------------------------------------------------------------ | --------- |
| Recordatorio con fecha y hora, con atajos ("Esta tarde", "Mañana 9:00"…) | P0        |
| Recurrencia (RRULE)                                                      | P1        |
| Acciones en la notificación: Hecho, Posponer 10 min, Abrir               | P1        |
| Fecha límite por ítem de checklist                                       | P1        |
| Pantalla de próximos y vencidos, y badge                                 | P1        |
| Resumen diario                                                           | P2        |
| Recordatorios por ubicación                                              | P2        |

### Seguridad, datos y extras

| Funcionalidad                                       | Prioridad |
| --------------------------------------------------- | --------- |
| Deshacer y rehacer; snackbar "Deshacer"             | P0        |
| Tema claro, oscuro o del sistema                    | P0        |
| Bloqueo con biometría o PIN (por nota o de la app)  | P1        |
| Exportar (Markdown, PDF, texto) y compartir         | P1        |
| Copia de seguridad e importación en JSON            | P1        |
| i18n (es/en) y accesibilidad                        | P1        |
| Quick actions en el icono                           | P1        |
| Historial de versiones                              | P2        |
| Widgets y share extension                           | P2        |
| Sincronización en la nube y cuenta                  | P2        |
| Colaboración                                        | P2        |
| IA (resumir, convertir en checklist, autoetiquetar) | P2        |

---

## 2. Stack tecnológico

| Área                 | Elección                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| Framework            | **Expo SDK 58** (React Native 0.88, New Architecture, React Compiler) + TypeScript estricto                  |
| Navegación           | **Expo Router**: `NativeTabs` en iOS y Android, tabs headless (`expo-router/ui`) en web                      |
| Base de datos        | **expo-sqlite + Drizzle ORM**: migraciones generadas con drizzle-kit, `useLiveQuery` reactivo                |
| Preferencias         | **expo-sqlite/kv-store** (API síncrona, funciona en web; se descarta MMKV para no añadir otro módulo nativo) |
| Estado de UI         | **Zustand**                                                                                                  |
| IDs                  | **UUID v7** (ordenable por tiempo)                                                                           |
| Orden manual         | **fractional-indexing**                                                                                      |
| Listas               | **FlashList**                                                                                                |
| Gestos y animación   | Reanimated 4 + Gesture Handler                                                                               |
| Drag & drop          | react-native-sortables                                                                                       |
| Bottom sheets        | @gorhom/bottom-sheet                                                                                         |
| Notificaciones       | **expo-notifications** + **rrule**; reprogramación con **expo-background-task**                              |
| Editor               | **TipTap 3** (StarterKit + listas de tareas) en un DOM component de Expo                                     |
| Multimedia           | expo-image, expo-image-picker, expo-audio, expo-file-system                                                  |
| Acciones rápidas     | expo-quick-actions (no es del SDK oficial)                                                                   |
| Seguridad            | expo-local-authentication (biometría o código del dispositivo; sin PIN propio ni expo-secure-store)          |
| Exportación y copias | expo-print, expo-sharing, expo-document-picker                                                               |
| i18n                 | i18next + react-i18next + expo-localization (claves tipadas contra el catálogo en español)                   |
| Tests                | Jest (jest-expo) + React Native Testing Library; E2E con Maestro (iOS/Android) y Playwright (web)            |
| Monitorización       | Sentry (`@sentry/react-native`): solo errores, sin contenido de las notas, desactivable                      |
| Pagos (futuro)       | RevenueCat, detrás de la capa `entitlements`                                                                 |
| Sincronización       | **Supabase** (Postgres + Auth con Google + Storage, plan gratuito); motor propio (ver §9)                    |

### 3.1 Web: viabilidad y limitaciones

- **Base de datos:** expo-sqlite funciona en web con WASM (OPFS, persistente). El driver de Drizzle usa la API síncrona, que en web necesita `SharedArrayBuffer`, es decir, las cabeceras `COOP: same-origin` y `COEP: credentialless`.
  - **En desarrollo:** las pone el propio servidor de Expo a partir del plugin de `expo-router` (con `output: "server"`; en `single` no las enviaba).
  - **En producción:** las aplica `expo-server` (en Vercel, la función `api/index.ts`) a partir del plugin de `expo-router`; `vercel.json` las pone también en los estáticos. **Verificado en la fase 6:** con `output: "single"` la exportación es estática y **no** lleva las cabeceras (la base de datos no abriría); con `output: "server"` sí, en todas las rutas. Lo comprueban los E2E web.
  - **Arranque:** la base de datos y el kv-store se abren primero de forma **asíncrona** (`AppBootstrap`), porque la primera operación síncrona falla si el worker de SQLite aún no ha cargado.
  - **Salida web:** `output: "server"`. El servidor solo renderiza la pantalla vacía: la base de datos se abre en un efecto, en el navegador, y `AppBootstrap` no pinta nada hasta hidratar (el servidor no conoce el tema del usuario).
  - **Varias pestañas:** OPFS solo admite una conexión por fichero. La pestaña que abre primero se queda un candado (Web Locks, `src/db/tab-lock.web.ts`); las demás muestran "Notas ya está abierta en otra pestaña" y continúan solas al cerrarse aquella.
  - **Límite de expo-sqlite:** cada operación síncrona espera al worker solo unos milisegundos (`Sync operation timeout`). Con la CPU saturada (p. ej. muchas páginas arrancando a la vez) puede fallar al migrar; por eso los E2E web corren en serie.
- **FTS5 en web:** el WASM por defecto **no incluye FTS**. En web, la búsqueda usa `LIKE` sobre `content_text`. Si hiciera falta más adelante, se compila un `wa-sqlite` con FTS y se carga con `SQLite.configureWeb({ wasmURL })`.
- **Adjuntos:** sin sistema de ficheros, las imágenes (reducidas a 1600 px, JPEG) y los audios (WebM) se guardan como data URI en la propia base de datos. Las grabaciones WebM de Chrome no traen duración: se usa la medida al grabar. El micrófono exige contexto seguro (HTTPS o localhost).
- **Notificaciones:** expo-notifications no programa notificaciones locales en web. Allí los recordatorios se muestran en la app (pantalla y badge), sin aviso del sistema.
- **No disponibles en web:** biometría, widgets, share extension y quick actions. Las funciones se ocultan con `Platform.OS` o con capacidades (`capabilities.ts`).
- **Bloqueo en web:** sin biometría ni código del dispositivo, no se ofrece bloquear la app ni las notas. Una nota bloqueada (p. ej. importada de una copia) se muestra oculta y se abre tocando "Desbloquear": oculta el contenido a la vista, no lo protege.
- **Exportar en web:** los ficheros (Markdown, texto, copia JSON) se descargan; el PDF se genera con el diálogo de impresión del navegador ("Guardar como PDF"). "Compartir texto" solo aparece si el navegador tiene `navigator.share`.
- **Despliegue:** Vercel (`vercel.json` + `api/index.ts`, adaptador `expo-server/adapter/vercel`): producción con cada push a `main`. Hasta la fase 6 era EAS Hosting.
- **Escritorio:** la web se instala como app (PWA: `public/manifest.json`, `src/app/+html.tsx`; botón en Ajustes → Descargar la app con `beforeinstallprompt`).

---

## 4. Modelo de datos

Principios:

- **IDs UUID v7** generados en el cliente.
- **Borrado lógico** (`deleted_at`).
- **`updated_at`** en todas las tablas.
- **`sort_key`** fraccional para el orden manual.
- **Colores como token**, no como hex.

```sql
folders        (id, parent_id, name, color, icon, sort_key, created_at, updated_at, deleted_at)

notes          (id, type ('text'|'checklist'|'image'|'audio'),
                title, content_json, content_text,
                folder_id, color, is_pinned, pinned_at,
                is_archived, is_favorite, is_locked,
                sort_key, created_at, updated_at, deleted_at)

checklist_items(id, note_id, text, is_checked, checked_at, indent, due_at,
                sort_key, created_at, updated_at, deleted_at)

tags           (id, name UNIQUE, color, created_at, updated_at, deleted_at)
note_tags      (note_id, tag_id, created_at, PK(note_id, tag_id))

reminders      (id, note_id, checklist_item_id, fire_at, rrule, timezone,
                status ('scheduled'|'fired'|'done'|'snoozed'),
                os_notification_id, created_at, updated_at, deleted_at)

attachments    (id, note_id, kind, local_uri, mime, size, width, height, duration_ms,
                created_at, deleted_at)

note_versions  (id, note_id, title, content_json, created_at)          -- P2
saved_filters  (id, name, icon, query_json, sort_key, created_at, updated_at, deleted_at)

notes_fts      VIRTUAL fts5(title, content_text, items_text)          -- solo nativo
```

Las fechas se guardan como `INTEGER` en milisegundos UTC. Los booleanos, como `INTEGER` 0/1 (Drizzle `mode: 'boolean'`).

---

## 5. Arquitectura

```
src/
  app/                      # Expo Router (solo rutas)
    _layout.tsx             # Providers: DB + migraciones, tema, gestos; Stack raíz
    (tabs)/
      _layout.tsx           # NativeTabs (iOS/Android)
      _layout.web.tsx       # Tabs headless (web)
      index.tsx             # Notas
      folders.tsx
      reminders.tsx
      settings.tsx
    note/[id].tsx           # Editor
    folder/[id].tsx
    search.tsx
    archive.tsx
    trash.tsx
  db/                       # client, schema, migraciones (drizzle/), provider
  features/<feature>/       # repository.ts · hooks/ · components/
  components/ui/            # Primitivos de UI
  theme/                    # Tokens, paleta de notas, ThemeProvider
  stores/                   # Zustand
  lib/                      # ids, fractional index, fechas, capacidades, entitlements
  i18n/
drizzle/                    # SQL de migraciones generado por drizzle-kit
```

**Flujo de datos:** componente → hook (`useNotes(filter)`) → `useLiveQuery` (Drizzle) → SQLite. Las mutaciones pasan por `repository.ts`, que notifica al scheduler de recordatorios cuando hace falta.

---

## 6. Recordatorios: detalles técnicos

1. **iOS admite un máximo de 64 notificaciones locales pendientes.** Se mantiene una ventana de unas 50 y se recalcula al hacer cambios, al abrir la app o volver a primer plano, y en una tarea en segundo plano.
2. **Recurrencias:** RRULE y zona horaria guardadas; las ocurrencias se calculan con `rrule`.
3. **Android:**
   - Permiso `POST_NOTIFICATIONS` (13+).
   - Alarmas exactas (12+).
   - Canales "Recordatorios" (alta) y "Resumen" (baja).
4. **Acciones:** categoría `reminder` con _Hecho_, _Posponer_ y _Abrir_; respuestas gestionadas incluso con la app cerrada.
5. **Deep link** a `note/[id]`.
6. **La fuente de verdad es la base de datos.** La programación es idempotente.

---

## 7. Roadmap (1 desarrollador)

| Fase                      | Contenido                                                                                                                                    | Duración    | Estado                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------- |
| **0. Fundaciones**        | Expo + TypeScript, lint y formato, tema y tokens, Drizzle y migraciones, rutas y tabs, UI base, Jest, EAS y CI                               | 1 semana    | ✅ hecha                    |
| **1. Núcleo (MVP)**       | CRUD de texto y checklist, carpetas, colores, anclar, archivar, papelera, lista/cuadrícula, ordenación, búsqueda, autoguardado, deshacer     | 3–4 semanas | ✅ hecha                    |
| **2. Organización**       | Etiquetas, filtros, carpetas inteligentes, selección múltiple, drag & drop, favoritos                                                        | 2 semanas   | ✅ hecha                    |
| **3. Recordatorios**      | Selector, scheduler con ventana, RRULE, acciones, pantalla de próximos, badge                                                                | 2 semanas   | ✅ hecha                    |
| **4. Contenido rico**     | Editor TipTap, imágenes, voz, plantillas, quick actions                                                                                      | 2–3 semanas | ✅ hecha                    |
| **5. Seguridad y pulido** | Biometría, export/import y backup, i18n, accesibilidad, onboarding                                                                           | 2 semanas   | ✅ hecha                    |
| **6. Lanzamiento**        | E2E, Sentry, betas, fichas de las tiendas, privacidad, despliegue web                                                                        | 1–2 semanas | 🟡 falta publicar           |
| **7. Post-lanzamiento**   | Cuentas con Google, sincronización, web en Vercel, escritorio (PWA), APK de Android. Después: pagos, widgets, share extension, versiones, IA | continuo    | 🟡 falta configurar cuentas |

### Fase 0: checklist

- [x] Proyecto Expo SDK 58 con TypeScript estricto y alias `@/`
- [x] ESLint (`eslint-config-expo`) + Prettier
- [x] Tema: tokens claro/oscuro, paleta de 10 colores de nota, espaciados, tipografía y radios; hook `useTheme`
- [x] Componentes UI base: `Text`, `Screen`, `Button`, `IconButton`, `Chip`, `ColorSwatch`, `EmptyState`, `Fab`
- [x] expo-sqlite + Drizzle: esquema completo, migración inicial generada, migraciones al arrancar
- [x] Utilidades: UUID v7, `sortKey` fraccional, `capabilities`, `entitlements`
- [x] Rutas: tabs (Notas, Carpetas, Recordatorios, Ajustes), editor, carpeta, búsqueda, archivo y papelera (placeholders)
- [x] Preferencias (`expo-sqlite/kv-store`) + store Zustand de UI
- [x] Jest (jest-expo) con tests de las utilidades
- [x] `eas.json` (development, preview, production) + GitHub Actions (lint, formato, typecheck, tests, migraciones al día, expo-doctor)
- [x] Web verificada en el navegador: arranque, crear nota, persistencia tras recargar, cambio de tema, barra de tabs adaptativa (arriba en escritorio, abajo en móvil)
- [ ] **Pendiente:** probar en iOS y Android (development build), ejecutar `eas init` (requiere cuenta Expo) y revisar el bundle id `com.novotechn.notas`
- [x] **Movido a la fase 1:** tabla `notes_fts` con sus triggers (hecho en la fase 1, ver abajo).

### Fase 1: checklist

- [x] Notas de texto: editor de texto plano tras `EditorAdapter` (`src/features/editor`), contenido guardado como documento TipTap + `content_text`
- [x] Autoguardado con debounce (también al pasar a segundo plano y al salir); las notas nuevas que se dejan vacías se descartan
- [x] Deshacer/rehacer en el editor (historial con agrupación) y snackbar "Deshacer" para archivar, papelera, mover, borrar ítems y carpetas
- [x] Checklists: marcar, completados agrupados al final (plegables), Intro crea el siguiente ítem, retroceso en vacío lo borra, sangría de subtareas, reordenar arrastrando el asa (react-native-sortables), desmarcar/borrar completados
- [x] Convertir texto ↔ checklist sin perder contenido; duplicar nota
- [x] Colores (11 tokens), anclar, archivar/desarchivar, papelera con restauración, borrado definitivo, vaciado y purga automática a los 30 días al arrancar
- [x] Carpetas anidadas (hasta 3 niveles) con color e icono; crear, editar, borrar (sus notas pasan a "Sin carpeta", con deshacer); mover notas entre carpetas
- [x] Lista o cuadrícula masonry (FlashList v2, 2–3 columnas según ancho); orden por modificación, creación o título, ancladas primero
- [x] Búsqueda: FTS5 con prefijos y sin acentos en nativo (tabla `notes_fts` + triggers creados al arrancar, fuera de las migraciones); `LIKE` en web. Incluye el texto de los ítems de checklist
- [x] Web verificada en el navegador: crear/editar texto y checklist, deshacer, color, archivar con snackbar, búsqueda, carpetas, nota en carpeta, descarte de nota vacía, papelera
- [ ] **Pendiente:** verificar en iOS y Android (teclado, `KeyboardAvoidingView`, arrastre de ítems; el arrastre no se pudo comprobar en web con eventos sintéticos)
- [x] **Pasado a la fase 2:** orden manual de notas (drag & drop), selección múltiple (hecho en la fase 2, ver abajo)

### Fase 2: checklist

- [x] Etiquetas: crear, renombrar, color y borrar con deshacer (pestaña Carpetas); asignar desde el menú de la nota o el editor (buscar o crear al vuelo); se muestran en tarjetas y editor; pantalla por etiqueta (`/tag/[id]`) con creación de notas ya etiquetadas. El nombre es único sin distinguir mayúsculas; una etiqueta borrada que ocupa el nombre se elimina del todo para reutilizarlo
- [x] Favoritos: marcar desde el menú (también en lote), estrella en la tarjeta, pantalla "Favoritas" y contador en Carpetas
- [x] Filtros combinables (`NoteFilter`, `src/features/filters`): tipo, color, etiqueta, carpeta, favoritas, con recordatorio, con adjuntos, modificada en las últimas 24 h/7/30/365 días e incluir archivadas. "O" dentro de cada criterio, "y" entre criterios. En la búsqueda, con chips para quitar cada criterio
- [x] Carpetas inteligentes (`saved_filters`): guardar la búsqueda actual, o crear una vacía desde Carpetas; nombre e icono; los filtros se editan desde la propia carpeta (`/smart/[id]`); borrar con deshacer. El JSON se normaliza al leer y escribir
- [x] Selección múltiple: mantener pulsada una nota entra en el modo; barra flotante con anclar, archivar, papelera y "más" (favoritos, color, etiquetas, mover). Seleccionar todo; el botón atrás de Android y salir de la pantalla cancelan la selección. Deshacer en lote
- [x] Orden manual (drag & drop): opción "Manual" en Ordenar; mantener pulsado y arrastrar (react-native-sortables). Ancladas y resto se reordenan por separado; solo se reescribe el `sort_key` de la nota movida. En Notas, carpetas, etiquetas, carpetas inteligentes, favoritas y archivo
- [x] Duplicar copia también las etiquetas
- [x] Tests: filtros (normalizar, serializar, desglose en chips), claves de orden al mover, vecinos tras soltar, seleccionar todo
- [x] Web verificada en el navegador: etiquetas desde el editor, tarjetas con etiquetas, selección múltiple y favoritos en lote, filtros combinados con recuento, guardar y abrir carpeta inteligente, pantallas de etiqueta y favoritas, orden manual (render y tocar para abrir)
- [ ] **Pendiente:** verificar en iOS y Android el arrastre de notas y "mantener sin mover = seleccionar" en orden manual (en web no se puede simular con eventos sintéticos)
- [ ] **Limitaciones conocidas:** en orden manual la cuadrícula alinea filas (no es masonry) y la lista no está virtualizada; reordenar no cambia `updated_at`. Los filtros "con recordatorio" y "con adjuntos" no darán resultados hasta las fases 3 y 4
- [ ] **No incluido (P1 de búsqueda, sin fase asignada):** búsquedas recientes y resaltado de coincidencias

### Fase 3: checklist

- [x] Selector de recordatorio (`src/features/reminders`): atajos "Esta tarde"/"Esta noche", "Mañana" y "Próxima semana", y calendario + hora propios (sin módulos nativos, igual en web). Desde la campana del editor, el chip bajo la nota o el menú de la nota; quitar con deshacer
- [x] Recurrencia (RRULE con `rrule`): diaria, de lunes a viernes, semanal, mensual y anual. Se guarda `DTSTART` en hora de pared + `RRULE`, y se calcula en la zona del recordatorio (mantiene la hora local con los cambios de horario). `fire_at` es solo el próximo aviso: posponer no desplaza la serie. Un recurrente vencido avanza a su última ocurrencia pasada; "Hecho" lo pasa a la siguiente
- [x] Scheduler con ventana (`scheduler.ts`, `window.ts`): las 50 notificaciones más próximas; identificador determinista (recordatorio + hora + hash del contenido), así que reprogramar solo cancela/programa diferencias. Se recalcula al arrancar, al volver a primer plano, tras cualquier cambio en notas/ítems/recordatorios (listener de SQLite) y en una tarea de `expo-background-task`
- [x] Notificaciones: canal "Recordatorios" (alta) en Android, alarmas exactas si hay permiso (`SCHEDULE_EXACT_ALARM`, con aviso para concederlo), categoría con acciones **Hecho**, **Posponer 10 min** y **Abrir**; tocar abre la nota. Las respuestas se atienden con la app abierta, al arrancar (`getLastNotificationResponseAsync`, sin duplicados) y en segundo plano (tarea de `expo-task-manager`)
- [x] Fecha límite por ítem de checklist: botón al editar el ítem, chip bajo el texto; un ítem completado deja de avisar y "Hecho" sobre su recordatorio lo marca como completado
- [x] Pantalla Recordatorios: vencidos, hoy, mañana, próximos 7 días y más adelante; marcar como hecho (con deshacer), posponer 10 min / 1 h / mañana, cambiar, abrir y quitar. Avisos de permiso denegado o sin alarmas exactas. Ajustes muestra el estado de las notificaciones
- [x] Badge: recordatorios vencidos en el icono de la app (nativo) y en la pestaña (NativeTabs y barra web). Las tarjetas muestran el próximo recordatorio (en rojo si venció). El filtro "Con recordatorio" ya funciona
- [x] Web: sin notificaciones del sistema; mientras la app está abierta, un snackbar avisa al vencer con "Abrir"
- [x] Tests: zonas horarias y cambios de horario, recurrencias, ventana (límite, orden, diff, identificadores), avance de vencidos, "Hecho", atajos y grupos
- [x] Web verificada en el navegador: crear recordatorio recurrente desde el editor, chip en editor y tarjeta, pantalla con grupos, vencido + badge (adelantando el reloj), hecho y deshacer, fecha límite de un ítem y marcarlo como hecho desde la lista
- [ ] **Pendiente:** probar en iOS y Android con un development build (nuevos módulos nativos: expo-notifications, expo-task-manager, expo-background-task): permisos, entrega a la hora, acciones con la app cerrada (en iOS "Hecho"/"Posponer" con la app terminada solo se garantiza al volver a abrirla), canal y alarmas exactas en Android 12–14, badge del icono
- [ ] **No incluido (P2):** resumen diario y recordatorios por ubicación; recurrencias personalizadas (cada N días, días concretos)

### Fase 4: checklist

- [x] Editor enriquecido (`src/features/editor`): TipTap 3 en un DOM component (`rich-text/tiptap-dom.tsx`) tras el mismo `EditorAdapter`. Títulos H1/H2, negrita, cursiva, subrayado, tachado, listas con viñetas y numeradas, casillas, citas, código y quitar formato; atajos de Markdown de TipTap. Barra de formato nativa en la parte inferior que resalta los formatos activos. Deshacer/rehacer sigue en la pantalla (historial de título + contenido; el de TipTap está desactivado). En nativo la webview crece con el contenido (`matchContents`), los cambios se agrupan 150 ms antes de cruzar el puente y la pantalla hace scroll para seguir el cursor. Las notas antiguas (solo párrafos) se abren sin migrar
- [x] Adjuntos (`src/features/attachments`, tabla `attachments` ya existente, sin migración): imágenes desde la cámara o la galería (varias a la vez) y notas de voz, en cualquier nota (texto o lista). En nativo, ficheros en `Documents/attachments/` con ruta **relativa** en la base de datos; en web, data URI (ver §3.1)
- [x] Imágenes: encima del título (una grande o cuadrícula), visor a pantalla completa con deslizamiento y borrar con deshacer. Las tarjetas muestran la primera imagen y "+N"
- [x] Voz (expo-audio): grabadora en una hoja (AAC mono 64 kbps; permiso con aviso para abrir Ajustes), lista de audios con reproducir/pausar, progreso y borrar con deshacer. Indicador "Nota de voz" en las tarjetas
- [x] Una nota nueva que solo tiene adjuntos no se descarta; duplicar copia los adjuntos (comparten fichero); los ficheros sin referencia se borran tras un borrado definitivo y al arrancar (los adjuntos quitados se purgan al día siguiente)
- [x] Filtros: "Imagen" y "Voz" en Tipo = notas con imágenes o audios adjuntos; "Con adjuntos" ya da resultados
- [x] Plantillas integradas (`src/features/templates`): Reunión, Lista de la compra, Diario (con la fecha), Proyecto o idea, Receta y Equipaje; botón propio junto a "Nueva lista"
- [x] Acciones rápidas del icono (expo-quick-actions): Nueva nota, Nueva lista, Nota de voz y Buscar. Pasan por la ruta `/new` (`notas://new?kind=text|checklist|voice&template=…`), que también sirve como enlace profundo; `unstable_settings.anchor` deja las pestañas debajo para poder volver
- [x] Permisos en `app.json` (cámara, fotos, micrófono) con textos en español; `expo-doctor` sin avisos
- [x] Tests: plantillas (documentos válidos, texto plano, fecha del diario), extensión por MIME y formato de duraciones, estado de formato
- [x] Web verificada en el navegador: escribir, negrita, H1, lista, deshacer/rehacer con el editor TipTap; abrir una nota antigua; adjuntar imágenes (reducidas a 1600 px), cuadrícula, visor, borrar y deshacer; miniatura en la tarjeta; plantilla "Reunión"; `/new?kind=voice` abre la grabadora y "Cancelar" la cierra; filtro "Imagen"
- [ ] **Pendiente:** probar en iOS y Android con un development build (nuevos módulos nativos: expo-image-picker, expo-audio, expo-file-system, expo-quick-actions): teclado y foco del editor en la webview, seguir el cursor, fondo transparente de la webview, grabar y reproducir, permisos, acciones rápidas (en Android, sin icono propio todavía). En web no se pudo grabar audio (requiere conceder el micrófono) ni comprobar las reglas de Markdown al teclear (los eventos sintéticos no las disparan)
- [ ] **Conocido (anterior a esta fase):** en orden manual, una nota creada mientras la lista está montada no aparece en la rejilla (react-native-sortables) hasta volver a cargar la pantalla
- [ ] **No incluido:** plantillas propias del usuario, enlaces dentro del texto con diálogo, transcripción de voz, recortar/anotar imágenes

### Fase 5: checklist

- [x] i18n (`src/i18n`): i18next + react-i18next + expo-localization, español (catálogo de referencia) e inglés. Todas las pantallas, hojas, snackbars, diálogos, notificaciones (botones y canal), acciones rápidas, plantillas y nombres de colores/iconos. Las claves se comprueban en TypeScript contra `es.ts` y `en.ts` debe tener las mismas. Fechas, horas, calendario (primer día de la semana de la región) y recurrencias con `Intl` en el idioma activo. Ajuste "Idioma": Sistema, Español o English (se aplica al momento, también `<html lang>` en web); "Sistema" sigue al dispositivo (incluido el idioma por app de iOS/Android 13+, `supportedLocales`). Textos de permisos de iOS traducidos (`locales/*.json`)
- [x] Bloqueo de la app (`src/features/security`, iOS y Android): biometría o código del dispositivo (expo-local-authentication; el "PIN" es el del sistema, no se guarda uno propio). Al arrancar y al volver tras "Al salir / 1 min / 5 min" en segundo plano; tapa el contenido en el selector de apps; el navegador sigue montado debajo y las hojas modales se ocultan mientras está bloqueada. Activarlo y desactivarlo pide verificación; sin código en el dispositivo se explica cómo configurarlo
- [x] Notas bloqueadas (columna `is_locked`, sin migración): "Bloquear"/"Quitar bloqueo" en el menú (también en lote). Ocultan contenido, imágenes y audio en tarjetas; en la búsqueda solo cuentan por el título; la notificación muestra solo el título. Abrirla pide verificación y queda desbloqueada hasta salir de la app; exportarla también la pide. Capa `entitlements` (`noteLock`, `export`)
- [x] Exportar una nota (`src/features/export`): Markdown (títulos, formato, listas anidadas, casillas, citas, código, etiquetas como `#tag`), texto plano, PDF (expo-print, con las imágenes) y "Compartir texto". Nativo: hoja de compartir del sistema; web: descarga o impresión
- [x] Copia de seguridad (`src/features/backup`): JSON con todas las tablas (también papelera) y los adjuntos en base64 (un fichero compartido se guarda una vez). Exportar pide verificación si hay notas bloqueadas. Importar (expo-document-picker) valida el formato y la versión, descarta filas incompletas y **fusiona**: añade lo que falta, sustituye solo lo que es más reciente en la copia, no borra nada (importar dos veces no cambia nada), funde etiquetas con el mismo nombre (y corrige las carpetas inteligentes que las usan), suelta referencias rotas y regenera las notificaciones
- [x] Onboarding (`/onboarding`, `Stack.Protected`): tres páginas (local-first, organización, recordatorios) con selector de idioma y botón para activar notificaciones; "Saltar" y "Ver la presentación" en Ajustes. Quien ya usaba la app no la ve (migración del store de ajustes v1 → v2)
- [x] Accesibilidad: los títulos (`largeTitle`, `title`, `heading`) se anuncian como encabezado; grupos de opciones como `radiogroup`; el editor TipTap tiene nombre accesible dentro de la webview; chips con área táctil de 44 pt; el snackbar se anuncia en iOS y dura el triple con lector de pantalla; las hojas no se deslizan con "Reducir movimiento"; textos de accesibilidad traducidos en todas las pantallas
- [x] Ajustes reorganizados: Apariencia, Idioma, Seguridad (solo nativo), Recordatorios, Datos (exportar/importar copia), Notas, Ayuda
- [x] Tests: catálogos (mismas claves, mismas variables, plurales), cambio de idioma en textos y fechas, conversión a Markdown/texto/HTML y nombres de fichero, lectura y validación de copias, fusión (más reciente gana, idempotencia, orden de carpetas, referencias rotas, etiquetas fundidas, notificaciones), migración de ajustes
- [x] Web verificada en el navegador: presentación y cambio de idioma en vivo, Ajustes en ambos idiomas, crear nota y exportar a Markdown, exportar la copia, importar una copia modificada (nueva + actualizada, con etiqueta e ítems), nota bloqueada importada (tarjeta oculta, búsqueda solo por título, pantalla de desbloqueo, quitar bloqueo)
- [x] Dependencias del SDK al día (`expo install --fix`); `expo-doctor` sin avisos
- [ ] **Pendiente:** probar en iOS y Android con un development build (nuevos módulos nativos: expo-local-authentication, expo-localization, expo-print, expo-sharing, expo-document-picker): Face ID/huella y código, bloqueo al volver de segundo plano y cubierta en el selector de apps, diálogo de Face ID sin que salte la cubierta, compartir Markdown/PDF/copia, importar desde Archivos/Drive, idioma por app del sistema, VoiceOver/TalkBack. En web no se probó el PDF (abre el diálogo de impresión) ni "Compartir texto" (el navegador del panel no tiene `navigator.share`)
- [ ] **No incluido:** copia en ZIP (el JSON ya incluye los adjuntos), PIN propio de la app (se usa el del dispositivo), exportar varias notas a la vez, copias automáticas programadas

### Fase 6: checklist

- [x] Web lista para producción: `output: "server"` para que EAS Hosting envíe COOP/COEP (verificado con la exportación de producción y `expo serve`: en `single` no se enviaban y la base de datos no abría); se quita el parche de cabeceras de `metro.config.js`. Sin errores de hidratación (`AppBootstrap` espera a hidratar)
- [x] Varias pestañas en web: candado con Web Locks; la segunda pestaña espera con un aviso y continúa al cerrarse la primera (antes: "No se pudo abrir la base de datos"). Reintentos al abrir por si el fichero de OPFS tarda en liberarse. La pantalla de error de arranque muestra también la causa
- [x] Sentry (`@sentry/react-native` + plugin + `getSentryExpoConfig`, `src/lib/monitoring.ts`): solo con `EXPO_PUBLIC_SENTRY_DSN`; solo errores (sin trazas, capturas ni Session Replay); sin datos personales; descarta migas que pueden llevar texto del usuario (consola, toques, UI) y los parámetros de las consultas de Drizzle en los mensajes. Pantalla de error de Expo Router y fallos de arranque informados. Ajuste "Enviar informes de errores" (activado por defecto; los eventos se descartan hasta cargar los ajustes)
- [x] Privacidad: política en la app (`/privacy`, pública también en web, es/en) enlazada desde Ajustes → Privacidad; manifiesto de privacidad de iOS (datos de fallos y diagnóstico sin vincular ni rastreo + APIs de motivo obligatorio de las dependencias); `usesNonExemptEncryption: false`. Respuestas para "Privacidad de la app" y "Seguridad de los datos" en `store/README.md`
- [x] E2E web (Playwright, `e2e/web/`, `npm run e2e:web`, job `e2e-web` en CI): cabeceras en todas las rutas y aislamiento, segunda pestaña, presentación, crear nota y persistir, búsqueda, lista con casilla, cambio de idioma, política pública en es/en. Corre contra la compilación de producción. 10/10 en verde
- [x] E2E nativos (Maestro, `.maestro/`): notas (crear, persistir tras reiniciar, buscar), listas (añadir y marcar) y privacidad; selectores por `testID` para no depender del idioma del simulador. Workflow `.eas/workflows/e2e.yml` (perfil `e2e-test`) al etiquetar un PR con `e2e`
- [x] Accesibilidad en web: `accessibilityState` no llega al DOM con react-native-web; se usan `aria-checked/selected/expanded/disabled` (casillas, chips, opciones, tarjetas seleccionadas, formato activo)
- [x] Betas: perfiles con entornos de EAS (`environment`, `EXPO_PUBLIC_APP_ENV`), envío a TestFlight y a la pista interna de Google Play (`eas.json`), workflow manual `.eas/workflows/beta.yml`
- [x] Fichas: App Store en `store.config.json` (EAS Metadata, es-ES y en-US: título, subtítulo, descripción, palabras clave, categorías, edad 4+) y Google Play en `store/google-play/`. Guía de lanzamiento en `store/README.md`
- [x] Tests unitarios: limpieza de mensajes de error, ajuste de informes por defecto
- [ ] **Pendiente (necesita cuentas):** `eas init`, variables de Sentry en EAS, crear las apps en App Store Connect y Google Play (primera subida a Play a mano), primer `eas deploy` (las URL de las fichas asumen `notas.expo.app`), datos de contacto para la revisión de Apple, capturas de pantalla. Revisar el email de contacto de la política (`src/lib/app-info.ts`) y que el nombre de la ficha esté libre
- [ ] **Pendiente:** ejecutar los flujos de Maestro (no hay simulador ni Maestro en esta máquina: solo se validó su sintaxis) y probar Sentry con una compilación real (sin DSN no se envía nada)
- [ ] **No incluido:** EAS Update (necesita `eas init`; los canales ya están en `eas.json`), source maps de la web en Sentry, PWA/manifest

### Fase 7: checklist

- [x] Servidor (`supabase/migrations/20261020000000_sync.sql`): tabla genérica `sync_rows` (usuario, tabla, id, `updated_at`, lápida, JSON, `seq`) con RLS por usuario; `push_changes` (gana lo igual o más reciente); `delete_account`; bucket privado `attachments` con políticas por carpeta de usuario
- [x] Seguimiento local: tablas `sync_outbox` y `sync_state` (migración `0001_sync`) y triggers creados al arrancar (`src/features/sync/tracking.ts`), que apuntan cualquier alta, cambio o borrado (también en cascada, importaciones y scheduler) salvo lo que llega del servidor. `os_notification_id` y `local_uri` no se sincronizan
- [x] Motor (`src/features/sync/engine.ts` + `plan.ts`, ver §9): baja todo lo nuevo, decide con `planPull` (función pura) y aplica en una transacción; luego sube lo pendiente en lotes. Adjuntos a Storage (se suben una vez, se descargan al llegar). Se sincroniza al entrar, al volver a primer plano, 3 s después de un cambio local, al salir de la app y cada minuto con la app abierta
- [x] Cuenta (`src/features/sync/auth.ts`): Google por Supabase Auth con PKCE, sin módulos nativos (navegador del sistema en iOS/Android → `notas://auth/callback`; redirección en web → `/auth/callback`). Ajustes → Cuenta y sincronización: entrar, estado, sincronizar ahora, cerrar sesión (las notas se quedan) y **eliminar la cuenta** (lo exigen las tiendas). Sin las variables `EXPO_PUBLIC_SUPABASE_*`, la sección no aparece y la app es solo local
- [x] Web en Vercel (`vercel.json`, `api/index.ts`), verificada sirviendo la exportación con el adaptador: cabeceras COOP/COEP en páginas y estáticos, rutas dinámicas, manifiesto. App de escritorio instalable (PWA) y enlace al APK en Ajustes (solo web)
- [x] Textos: presentación, política de privacidad (nueva sección "Cuenta y sincronización", web en Vercel), fichas de las tiendas, manifiesto de privacidad de iOS y respuestas de "Seguridad de los datos" (`store/README.md` §4). Guía paso a paso de cuentas en `store/README.md` §0
- [x] Tests: planificador (gana lo más reciente, pendientes, eco, orden sin cambio de `updatedAt`, lápidas, referencias rotas, validación, fusión de etiquetas y carpetas inteligentes, adjuntos), triggers contra SQLite real (`node:sqlite`) y **dos dispositivos sincronizando** contra un servidor simulado (fusión, conflictos, borrados, etiquetas duplicadas, adjuntos, sin ecos)
- [x] **Revisión tras el primer despliegue (21-10):**
  - Web: las pestañas no se desplazaban en escritorio (el contenedor de `TabSlot` no encoge y crecía con el contenido); se limita su alto. E2E que lo comprueba
  - Teclado: `react-native-keyboard-controller` (`KeyboardProvider` + `KeyboardAvoider` en `components/ui`) en las hojas y el editor; el `KeyboardAvoidingView` de React Native no hacía nada en Android de borde a borde. En la web del móvil, `interactive-widget=resizes-content` (Chrome) y `visualViewport` (Safari). **Pendiente de probar en un dispositivo**
  - Autoguardado: si un guardado falla (en web, `Sync operation timeout` de expo-sqlite con la CPU ocupada; visto solo en desarrollo) se reintenta hasta 5 veces en vez de darse por guardado
  - Seguridad: cerrar sesión sube lo pendiente y **quita los datos de la cuenta del dispositivo** (antes se quedaban y se subían a la siguiente cuenta que entrase); límites en el servidor (`20261021000000_hardening.sql`) y un lote rechazado ya no atasca la sincronización; ids del servidor validados (el de un adjunto forma parte del nombre del fichero); cabeceras de seguridad en Vercel (`X-Frame-Options`, `frame-ancestors`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`); proveedor Email de Supabase a desactivar
  - Vercel no compila los commits que solo tocan documentación, tests o SQL (`ignoreCommand`)
- [ ] **Pendiente (necesita cuentas, ver `store/README.md` §0):** proyecto de Supabase + SQL, cliente OAuth de Google, proyecto en Vercel con las variables, `eas init` + variables en EAS + primer APK. Probar el inicio de sesión real en web y Android (no se pudo sin cuentas: se comprobó que la app redirige a Supabase con la URL de vuelta correcta y que `/auth/callback` vuelve a Ajustes)
- [ ] **Seguridad, no incluido (posibles mejoras):** cifrado de extremo a extremo (hoy Supabase guarda las notas cifradas en disco y en tránsito, pero el servidor podría leerlas; las notas bloqueadas solo se ocultan en la app); base de datos local cifrada (SQLCipher, `useSQLCipher` de expo-sqlite) con la clave en el llavero; sesión en `expo-secure-store` en vez de `localStorage` de expo-sqlite; `android.allowBackup: false` para que la copia automática de Android no incluya la base de datos
- [ ] **Limitaciones conocidas:** gana la última escritura por reloj del cliente (un reloj muy desajustado puede perder una edición); se compara la fila entera, no campo a campo (editar el título en un dispositivo y el color en otro a la vez: gana una de las dos); sin tiempo real (se bajan cambios cada minuto y al volver a la app); al entrar con una cuenta, las notas del dispositivo se suben a esa cuenta; el plan gratuito de Supabase pausa el proyecto tras 7 días sin uso
- [ ] **No incluido:** sincronización en tiempo real (Supabase Realtime), cifrado de extremo a extremo, compartir notas entre cuentas, Netlify (solo está preparado Vercel), app de escritorio nativa (Electron/Tauri): la PWA cubre Windows, macOS y Linux

---

## 8. Riesgos

| Riesgo                                         | Mitigación                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| Inestabilidad del editor enriquecido           | `EditorAdapter` y formato TipTap desde el día 1                            |
| Notificaciones poco fiables en algunos Android | Alarmas exactas, guía para cada fabricante, pruebas en dispositivos reales |
| Pérdida de datos                               | Migraciones con tests, backup exportable, borrado lógico                   |
| Añadir sincronización más adelante             | Esquema sync-ready; motor con tests de dos dispositivos (fase 7)           |
| Web: sin FTS ni notificaciones                 | Búsqueda con `LIKE` y recordatorios dentro de la app; documentado          |

---

## 9. Sincronización

- **Modelo:** cada fila local (`folders`, `notes`, `checklist_items`, `tags`, `note_tags`, `reminders`, `attachments`, `saved_filters`) es una fila de `sync_rows` con sus datos en JSON (nombres de Drizzle, como las copias). `note_tags` usa `note_id|tag_id` como id. Los borrados definitivos viajan como lápidas.
- **Conflictos:** gana la versión con `updated_at` mayor (en `note_tags`, `created_at`); en empate gana quien sube (reordenar no cambia `updated_at`). Un cambio local pendiente igual o más reciente que el del servidor se respeta y se sube después.
- **Cursor:** `seq` crece con cada escritura en el servidor; cada dispositivo guarda el último que vio (kv-store, por usuario) y baja solo lo posterior. Se baja todo antes de aplicar para no romper referencias entre páginas.
- **Etiquetas duplicadas** (mismo nombre creado en dos dispositivos): queda la de id menor (UUID v7: la más antigua) en todos; la otra se funde (sus notas y carpetas inteligentes pasan a la que queda).
- **Primera vez con una cuenta:** todo lo del dispositivo se apunta para subir (`enqueueAll`) y se baja la cuenta entera: se fusionan.
