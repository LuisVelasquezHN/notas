# Notas

App de notas local-first para iOS, Android y web (Expo SDK 58 + Expo Router + SQLite/Drizzle).
El plan completo del producto está en [PLAN.md](PLAN.md).

## Desarrollo

```bash
npm install
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
```

## Base de datos

- Las migraciones se aplican al arrancar (`AppBootstrap`).
- Usa siempre `getDb()` dentro de la app.
- Convenciones: IDs UUID v7, fechas en ms UTC, borrado lógico (`deleted_at`) y colores como token.
