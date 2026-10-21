import path from 'node:path';

import { createRequestHandler } from 'expo-server/adapter/vercel';

/**
 * Función de Vercel que sirve la web (`output: "server"`, ver vercel.json). Las rutas de la app
 * pasan por aquí; los ficheros estáticos (`dist/client`) los sirve Vercel directamente. Las
 * cabeceras COOP/COEP que necesita SQLite en web (PLAN.md §3.1) las pone el plugin de
 * expo-router en las páginas y vercel.json en los estáticos.
 */
export default createRequestHandler({ build: path.join(__dirname, '../dist/server') });
