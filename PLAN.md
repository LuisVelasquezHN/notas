# Notas — Plan del proyecto

App de notas **local-first** en React Native (Expo) para **iOS, Android y web**: varios tipos de nota, carpetas, etiquetas, colores, anclado, filtros, recordatorios y notificaciones.

## 0. Decisiones tomadas

| #   | Decisión       | Resolución                                                                 | Implicaciones                                                                                                                                                                                                    |
| --- | -------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Sincronización | **Solo local para el lanzamiento.** La sincronización se evaluará después. | El esquema se diseña _sync-ready_ desde el día 1 (UUID v7, `updated_at`, borrado lógico, `sort_key` fraccional). No hay backend ni cuentas en v1.                                                                |
| 2   | Monetización   | **Gratis**, preparado para pagos en el futuro.                             | Capa `entitlements` (`useEntitlement('feature')`) que hoy devuelve `true` para todo. Si se cobra más adelante, se conecta RevenueCat sin tocar las pantallas.                                                    |
| 3   | Plataformas    | **iOS + Android**, más **web si es viable**.                               | Es viable: Expo Router, expo-sqlite (WASM + OPFS) y Drizzle funcionan en web. Las limitaciones están en §3.1. Se trata como plataforma de segundo nivel: debe funcionar, pero no se le dedica pulido específico. |
| 4   | Editor         | **Recomendación aplicada (ver abajo).**                                    | —                                                                                                                                                                                                                |

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

| Área                    | Elección                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Framework               | **Expo SDK 58** (React Native 0.88, New Architecture, React Compiler) + TypeScript estricto                  |
| Navegación              | **Expo Router**: `NativeTabs` en iOS y Android, tabs headless (`expo-router/ui`) en web                      |
| Base de datos           | **expo-sqlite + Drizzle ORM**: migraciones generadas con drizzle-kit, `useLiveQuery` reactivo                |
| Preferencias            | **expo-sqlite/kv-store** (API síncrona, funciona en web; se descarta MMKV para no añadir otro módulo nativo) |
| Estado de UI            | **Zustand**                                                                                                  |
| IDs                     | **UUID v7** (ordenable por tiempo)                                                                           |
| Orden manual            | **fractional-indexing**                                                                                      |
| Listas                  | **FlashList**                                                                                                |
| Gestos y animación      | Reanimated 4 + Gesture Handler                                                                               |
| Drag & drop             | react-native-sortables                                                                                       |
| Bottom sheets           | @gorhom/bottom-sheet                                                                                         |
| Notificaciones          | **expo-notifications** + **rrule**; reprogramación con **expo-background-task**                              |
| Editor                  | **TipTap 3** (StarterKit + listas de tareas) en un DOM component de Expo                                     |
| Multimedia              | expo-image, expo-image-picker, expo-audio, expo-file-system                                                  |
| Acciones rápidas        | expo-quick-actions (no es del SDK oficial)                                                                   |
| Seguridad               | expo-local-authentication (biometría o código del dispositivo; sin PIN propio ni expo-secure-store)          |
| Exportación y copias    | expo-print, expo-sharing, expo-document-picker                                                               |
| i18n                    | i18next + react-i18next + expo-localization (claves tipadas contra el catálogo en español)                   |
| Tests                   | Jest (jest-expo) + React Native Testing Library; Maestro para E2E                                            |
| Monitorización          | Sentry                                                                                                       |
| Pagos (futuro)          | RevenueCat, detrás de la capa `entitlements`                                                                 |
| Sincronización (futuro) | Supabase + PowerSync u otra opción equivalente                                                               |

### 3.1 Web: viabilidad y limitaciones

- **Base de datos:** expo-sqlite funciona en web con WASM (OPFS, persistente). El driver de Drizzle usa la API síncrona, que en web necesita `SharedArrayBuffer`, es decir, las cabeceras `COOP: same-origin` y `COEP: credentialless`.
  - **En desarrollo:** se añaden desde `metro.config.js`. En modo `single` el CLI sirve el HTML antes que el middleware de Metro, así que `enhanceMiddleware` no basta.
  - **En producción:** las pone el hosting. Están declaradas en el plugin de `expo-router` para EAS Hosting; **hay que verificarlo en la fase 6**.
  - **Arranque:** la base de datos y el kv-store se abren primero de forma **asíncrona** (`AppBootstrap`), porque la primera operación síncrona falla si el worker de SQLite aún no ha cargado.
  - **Salida web:** `output: "single"` (SPA). El renderizado estático o en servidor ejecutaría SQLite en Node.
- **FTS5 en web:** el WASM por defecto **no incluye FTS**. En web, la búsqueda usa `LIKE` sobre `content_text`. Si hiciera falta más adelante, se compila un `wa-sqlite` con FTS y se carga con `SQLite.configureWeb({ wasmURL })`.
- **Adjuntos:** sin sistema de ficheros, las imágenes (reducidas a 1600 px, JPEG) y los audios (WebM) se guardan como data URI en la propia base de datos. Las grabaciones WebM de Chrome no traen duración: se usa la medida al grabar. El micrófono exige contexto seguro (HTTPS o localhost).
- **Notificaciones:** expo-notifications no programa notificaciones locales en web. Allí los recordatorios se muestran en la app (pantalla y badge), sin aviso del sistema.
- **No disponibles en web:** biometría, widgets, share extension y quick actions. Las funciones se ocultan con `Platform.OS` o con capacidades (`capabilities.ts`).
- **Bloqueo en web:** sin biometría ni código del dispositivo, no se ofrece bloquear la app ni las notas. Una nota bloqueada (p. ej. importada de una copia) se muestra oculta y se abre tocando "Desbloquear": oculta el contenido a la vista, no lo protege.
- **Exportar en web:** los ficheros (Markdown, texto, copia JSON) se descargan; el PDF se genera con el diálogo de impresión del navegador ("Guardar como PDF"). "Compartir texto" solo aparece si el navegador tiene `navigator.share`.
- **Despliegue:** EAS Hosting.

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

| Fase                      | Contenido                                                                                                                                | Duración    | Estado   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------- |
| **0. Fundaciones**        | Expo + TypeScript, lint y formato, tema y tokens, Drizzle y migraciones, rutas y tabs, UI base, Jest, EAS y CI                           | 1 semana    | ✅ hecha |
| **1. Núcleo (MVP)**       | CRUD de texto y checklist, carpetas, colores, anclar, archivar, papelera, lista/cuadrícula, ordenación, búsqueda, autoguardado, deshacer | 3–4 semanas | ✅ hecha |
| **2. Organización**       | Etiquetas, filtros, carpetas inteligentes, selección múltiple, drag & drop, favoritos                                                    | 2 semanas   | ✅ hecha |
| **3. Recordatorios**      | Selector, scheduler con ventana, RRULE, acciones, pantalla de próximos, badge                                                            | 2 semanas   | ✅ hecha |
| **4. Contenido rico**     | Editor TipTap, imágenes, voz, plantillas, quick actions                                                                                  | 2–3 semanas | ✅ hecha |
| **5. Seguridad y pulido** | Biometría, export/import y backup, i18n, accesibilidad, onboarding                                                                       | 2 semanas   | ✅ hecha |
| **6. Lanzamiento**        | E2E, Sentry, betas, fichas de las tiendas, privacidad, despliegue web                                                                    | 1–2 semanas |          |
| **7. Post-lanzamiento**   | Sincronización, pagos, widgets, share extension, versiones, IA                                                                           | continuo    |          |

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

---

## 8. Riesgos

| Riesgo                                         | Mitigación                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| Inestabilidad del editor enriquecido           | `EditorAdapter` y formato TipTap desde el día 1                            |
| Notificaciones poco fiables en algunos Android | Alarmas exactas, guía para cada fabricante, pruebas en dispositivos reales |
| Pérdida de datos                               | Migraciones con tests, backup exportable, borrado lógico                   |
| Añadir sincronización más adelante             | Esquema sync-ready                                                         |
| Web: sin FTS ni notificaciones                 | Búsqueda con `LIKE` y recordatorios dentro de la app; documentado          |
