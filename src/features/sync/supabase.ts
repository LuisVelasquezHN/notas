import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

/**
 * Cliente de Supabase (cuentas y sincronización, PLAN.md §9). Sin las variables de entorno la
 * app funciona como antes, solo en local: no se muestra la sección de cuenta.
 * La sesión se guarda en `localStorage` (en iOS y Android, el de expo-sqlite).
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSyncConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

/**
 * El cliente se crea al usarlo por primera vez: en web, la primera pasada se renderiza en el
 * servidor, donde no hay `localStorage`.
 */
export function getSupabase(): SupabaseClient {
  if (!url || !key) throw new Error('Supabase no está configurado (EXPO_PUBLIC_SUPABASE_*)');
  if (client) return client;
  client = createClient(url, key, {
    auth: {
      storage: localStorage,
      autoRefreshToken: true,
      persistSession: true,
      // PKCE: el código de la redirección se canjea a mano (ver `auth.ts` y `/auth/callback`).
      flowType: 'pkce',
      detectSessionInUrl: false,
    },
  });
  if (Platform.OS !== 'web') {
    // En iOS y Android, el token solo se refresca con la app en primer plano.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') void client?.auth.startAutoRefresh();
      else void client?.auth.stopAutoRefresh();
    });
  }
  return client;
}

/** Bucket de Storage con los ficheros de los adjuntos (`<user_id>/<attachment_id>`). */
export const ATTACHMENTS_BUCKET = 'attachments';
