import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useState } from 'react';

import { decryptSecureNote, secureNotesQuery, type DecryptedSecureNote } from './repository';
import { useVaultStore } from './store';

/** Notas seguras descifradas (solo con la bóveda abierta; si no, lista vacía). */
export function useSecureNotes(): { notes: DecryptedSecureNote[]; loading: boolean } {
  const keys = useVaultStore((s) => s.keys);
  const { data: rows } = useLiveQuery(secureNotesQuery());
  const [state, setState] = useState<{ notes: DecryptedSecureNote[]; loading: boolean }>({
    notes: [],
    loading: true,
  });

  useEffect(() => {
    if (!keys) return;
    let cancelled = false;
    void Promise.all(rows.map(decryptSecureNote)).then((notes) => {
      if (!cancelled) setState({ notes, loading: false });
    });
    return () => {
      cancelled = true;
    };
  }, [rows, keys]);

  return keys ? state : LOCKED;
}

const LOCKED = { notes: [], loading: false };
