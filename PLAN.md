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
3. **Fase 4: editor enriquecido** con **10tap-editor** (TipTap) en iOS y Android, y TipTap directamente en web. Como el formato ya es el de TipTap, **no hay migración de datos**: solo se cambia la implementación del adapter.

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
| Copia de seguridad e importación en JSON o ZIP      | P1        |
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
| Multimedia              | expo-image, expo-image-picker, expo-audio, expo-file-system                                                  |
| Seguridad               | expo-local-authentication, expo-secure-store                                                                 |
| Exportación             | expo-print, expo-sharing                                                                                     |
| i18n                    | i18next + expo-localization                                                                                  |
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
- **Notificaciones:** expo-notifications no programa notificaciones locales en web. Allí los recordatorios se muestran en la app (pantalla y badge), sin aviso del sistema.
- **No disponibles en web:** biometría, widgets, share extension y quick actions. Las funciones se ocultan con `Platform.OS` o con capacidades (`capabilities.ts`).
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
| **1. Núcleo (MVP)**       | CRUD de texto y checklist, carpetas, colores, anclar, archivar, papelera, lista/cuadrícula, ordenación, búsqueda, autoguardado, deshacer | 3–4 semanas | ⏳       |
| **2. Organización**       | Etiquetas, filtros, carpetas inteligentes, selección múltiple, drag & drop, favoritos                                                    | 2 semanas   |          |
| **3. Recordatorios**      | Selector, scheduler con ventana, RRULE, acciones, pantalla de próximos, badge                                                            | 2 semanas   |          |
| **4. Contenido rico**     | Editor TipTap, imágenes, voz, plantillas, quick actions                                                                                  | 2–3 semanas |          |
| **5. Seguridad y pulido** | Biometría, export/import y backup, i18n, accesibilidad, onboarding                                                                       | 2 semanas   |          |
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
- [ ] **Movido a la fase 1:** tabla `notes_fts` con sus triggers. Solo nativo, porque una migración con FTS5 fallaría en web; se creará en un paso de arranque aparte.

---

## 8. Riesgos

| Riesgo                                         | Mitigación                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| Inestabilidad del editor enriquecido           | `EditorAdapter` y formato TipTap desde el día 1                            |
| Notificaciones poco fiables en algunos Android | Alarmas exactas, guía para cada fabricante, pruebas en dispositivos reales |
| Pérdida de datos                               | Migraciones con tests, backup exportable, borrado lógico                   |
| Añadir sincronización más adelante             | Esquema sync-ready                                                         |
| Web: sin FTS ni notificaciones                 | Búsqueda con `LIKE` y recordatorios dentro de la app; documentado          |
