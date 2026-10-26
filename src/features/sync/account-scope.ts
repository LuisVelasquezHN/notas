import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import Storage from 'expo-sqlite/kv-store';

import { openDatabase } from '@/db/client';
import { GUEST_SCOPE, scopeForAccount, type DataScope } from '@/db/scope';
import { buildBackup } from '@/features/backup/backup';
import { lockVault } from '@/features/vault/store';
import { t } from '@/i18n';
import { confirm } from '@/lib/confirm';

import migrations from '../../../drizzle/migrations';
import { accountFromSession } from './auth';
import { LEGACY_OWNER_KEY, clearLocalData, hasPendingChanges, localNoteCount } from './engine';
import { setPendingImport } from './pending-import';
import type { Account } from './store';
import { getSupabase, isSyncConfigured } from './supabase';

/**
 * Qué base de datos local se usa según la sesión (ver `db/scope.ts`).
 *
 * - Al arrancar: la de la cuenta con sesión, o la de invitado.
 * - Al entrar con una cuenta teniendo notas sin cuenta en el dispositivo: se pregunta si pasarlas a
 *   la cuenta (nunca se suben solas).
 * - Al salir (o caducar la sesión): la de invitado. Cerrar sesión, además, vacía la de la cuenta.
 *
 * Los datos que pasan de una base de datos a otra viajan como copia de seguridad en memoria
 * (`pending-import.ts`).
 */

async function currentAccount(): Promise<Account | null> {
  if (!isSyncConfigured) return null;
  const { data } = await getSupabase().auth.getSession();
  return accountFromSession(data.session);
}

/** Cuenta con sesión y ámbito con el que arrancar (tras migrar, si hace falta). */
export async function resolveInitialScope(): Promise<{
  account: Account | null;
  scope: DataScope;
}> {
  const account = await currentAccount();
  await migrateSingleDatabase(account);
  return { account, scope: scopeForAccount(account?.id) };
}

/**
 * Migración desde la versión con una sola base de datos (`notas.db`, ahora la de invitado). Si
 * sus datos eran de una cuenta:
 * - con esa cuenta en sesión: pasan a la base de datos de la cuenta;
 * - si no, y ya estaban todos en la nube: se quitan del dispositivo (vuelven al entrar);
 * - si no, y había cambios sin subir: se quedan como datos sin cuenta (no se pierden).
 */
async function migrateSingleDatabase(account: Account | null) {
  const owner = Storage.getItemSync(LEGACY_OWNER_KEY);
  if (!owner) return;
  const db = await openDatabase(GUEST_SCOPE);
  await migrate(db, migrations);
  if (account?.id === owner) {
    setPendingImport(await buildBackup());
    await clearLocalData();
  } else if (!(await hasPendingChanges())) {
    await clearLocalData();
  }
  Storage.removeItemSync(LEGACY_OWNER_KEY);
}

/**
 * Cambio de sesión: devuelve el ámbito al que pasar. Se llama con la base de datos del ámbito
 * actual todavía abierta.
 */
export async function scopeForSessionChange(
  next: Account | null,
  currentScope: DataScope | undefined,
): Promise<DataScope> {
  const nextScope = scopeForAccount(next?.id);
  if (nextScope === currentScope) return nextScope;
  if (next && currentScope === GUEST_SCOPE) {
    const count = await localNoteCount();
    if (count > 0) {
      const move = await confirm({
        title: t('account.moveGuestTitle'),
        message: t('account.moveGuestMessage', { count, email: next.email ?? next.name ?? '' }),
        confirmLabel: t('account.moveGuestAction'),
      });
      if (move) {
        setPendingImport(await buildBackup());
        await clearLocalData();
      }
    }
  }
  // Las claves de la bóveda abierta son de la otra base de datos.
  lockVault();
  return nextScope;
}
