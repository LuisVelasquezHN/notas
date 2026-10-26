import Storage from 'expo-sqlite/kv-store';

/**
 * Ámbito de los datos locales (PLAN.md §9): cada cuenta tiene su propia base de datos y su carpeta
 * de adjuntos, y el uso sin cuenta ("invitado") la suya. Cambiar de cuenta cambia de base de datos:
 * es imposible ver o subir notas de otra cuenta, aunque la sesión se pierda sin cerrarla.
 */
export type DataScope = string;

export const GUEST_SCOPE: DataScope = 'guest';

/** Los ids de cuenta de Supabase son UUID: forman parte de nombres de fichero. */
const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function scopeForAccount(accountId: string | null | undefined): DataScope {
  if (!accountId) return GUEST_SCOPE;
  if (!ACCOUNT_ID.test(accountId)) throw new Error('Id de cuenta no válido');
  return accountId.toLowerCase();
}

/** Fichero SQLite del ámbito. El de invitado es el de siempre (`notas.db`). */
export function databaseName(scope: DataScope): string {
  return scope === GUEST_SCOPE ? 'notas.db' : `notas-${scope}.db`;
}

/** Carpeta de adjuntos (relativa a Documents). La de invitado es la de siempre. */
export function attachmentsDirName(scope: DataScope): string {
  return scope === GUEST_SCOPE ? 'attachments' : `attachments/${scope}`;
}

let active: DataScope = GUEST_SCOPE;

/** Ámbito de la base de datos abierta ahora. */
export const activeScope = (): DataScope => active;

const SCOPE_KEY = 'data.scope';

export function setActiveScope(scope: DataScope) {
  active = scope;
  // Las tareas en segundo plano (recordatorios) abren la base de datos sin la interfaz.
  try {
    Storage.setItemSync(SCOPE_KEY, scope);
  } catch {
    // En web, antes de abrir el almacén: no hay tareas en segundo plano.
  }
}

/** Último ámbito abierto (para las tareas en segundo plano). */
export function rememberedScope(): DataScope {
  try {
    return Storage.getItemSync(SCOPE_KEY) ?? GUEST_SCOPE;
  } catch {
    return GUEST_SCOPE;
  }
}
