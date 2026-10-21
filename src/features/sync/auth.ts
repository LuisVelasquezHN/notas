import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { forgetAccount, hasPendingChanges, syncNow, wipeLocalData } from './engine';
import { deleteAllAttachments } from './files';
import type { Account } from './store';
import { getSupabase } from './supabase';

/**
 * Inicio de sesión con Google a través de Supabase Auth (OAuth con PKCE). La cuenta se crea la
 * primera vez que se entra. No hace falta ningún módulo nativo:
 * - iOS y Android: el navegador del sistema (`openAuthSessionAsync`) vuelve a
 *   `notas://auth/callback?code=…` y aquí se canjea el código;
 * - web: se navega a Google y se vuelve a `/auth/callback`, que canjea el código.
 */

export const AUTH_CALLBACK_PATH = 'auth/callback';

export function accountFromSession(session: Session | null): Account | null {
  if (!session) return null;
  const meta = session.user.user_metadata as { full_name?: string; name?: string };
  return {
    id: session.user.id,
    email: session.user.email ?? null,
    name: meta.full_name ?? meta.name ?? null,
  };
}

function redirectUrl(): string {
  return Platform.OS === 'web'
    ? `${window.location.origin}/${AUTH_CALLBACK_PATH}`
    : Linking.createURL(AUTH_CALLBACK_PATH);
}

const exchanged = new Set<string>();

/**
 * Canjea el código de la redirección por una sesión. En Android el enlace llega a la vez a
 * `openAuthSessionAsync` y a la ruta `/auth/callback`: cada código se canjea una sola vez.
 */
export async function exchangeCode(code: string): Promise<boolean> {
  if (exchanged.has(code)) return true;
  exchanged.add(code);
  const supabase = getSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) return true;
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}

export type SignInResult = 'ok' | 'cancelled' | 'error';

export async function signInWithGoogle(): Promise<SignInResult> {
  const supabase = getSupabase();
  const redirectTo = redirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data.url) return 'error';
  // En web la página ya se va a Google.
  if (Platform.OS === 'web') return 'ok';

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled';
  const params = new URL(result.url).searchParams;
  const code = params.get('code');
  if (!code) return params.get('error') === 'access_denied' ? 'cancelled' : 'error';
  return (await exchangeCode(code)) ? 'ok' : 'error';
}

export type SignOutResult = 'ok' | 'pending';

/**
 * Cierra la sesión y quita los datos de la cuenta de este dispositivo (siguen en la cuenta).
 * Antes se sube lo pendiente: si no se puede (sin conexión), no se cierra y devuelve `'pending'`
 * para no perder nada.
 */
export async function signOut(): Promise<SignOutResult> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  await syncNow();
  if (await hasPendingChanges()) return 'pending';
  await supabase.auth.signOut();
  if (userId) await wipeLocalData(userId);
  return 'ok';
}

/**
 * Elimina la cuenta y su copia en el servidor (ficheros, datos y usuario). Las notas se quedan en
 * el dispositivo; si después se entra con otra cuenta, se suben a ella.
 */
export async function deleteAccount(): Promise<void> {
  const supabase = getSupabase();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  await deleteAllAttachments(userId);
  const { error } = await supabase.rpc('delete_account');
  if (error) throw error;
  forgetAccount(userId);
  // El usuario ya no existe: se cierra solo la sesión local.
  await supabase.auth.signOut({ scope: 'local' });
}
