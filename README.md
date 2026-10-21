# Notas

App de notas local-first para iOS, Android, web y escritorio (PWA), con cuenta de Google y
sincronización opcional (Expo SDK 58 + Expo Router + SQLite/Drizzle + Supabase).
El plan completo del producto está en [PLAN.md](PLAN.md); la puesta en marcha de cuentas, web
(Vercel) y APK de Android, en [store/README.md](store/README.md) §0.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # opcional: Supabase para probar la sincronización
npm run web          # web en http://localhost:8081
npm run ios          # requiere development build (npx expo run:ios o EAS)
npm run android
```

| Script                | Qué hace                                                           |
| --------------------- | ------------------------------------------------------------------ |
| `npm run check`       | lint + typecheck + tests (lo mismo que CI)                         |
| `npm run format`      | Prettier                                                           |
| `npm run db:generate` | genera una migración en `drizzle/` tras cambiar `src/db/schema.ts` |

## Estructura

```
src/app/         rutas (Expo Router)
src/components/  UI base (components/ui) y AppBootstrap
src/db/          esquema Drizzle y cliente SQLite
src/features/    lógica por funcionalidad (repositorios, hooks, componentes)
src/lib/         utilidades (ids, sort keys, capacidades, entitlements)
src/stores/      estado con Zustand
src/theme/       tokens de diseño y useTheme
drizzle/         migraciones SQL generadas
supabase/        SQL del servidor de sincronización (se ejecuta en Supabase)
api/             función de Vercel que sirve la web
public/          manifiesto e iconos de la PWA
```

## Base de datos

- Las migraciones se aplican al arrancar (`AppBootstrap`).
- Usa siempre `getDb()` dentro de la app.
- Convenciones: IDs UUID v7, fechas en ms UTC, borrado lógico (`deleted_at`) y colores como token.
