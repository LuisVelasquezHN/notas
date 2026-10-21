import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { notesQuery, type NoteScope } from '@/features/notes/repository';
import type { NotesSortBy } from '@/stores/settings-store';

import { serializeFilter, type NoteFilter } from '../filter';

/** Notas que cumplen un filtro, en vivo. La consulta se rehace solo si el filtro cambia de verdad. */
export function useFilteredNotes(
  filter: NoteFilter,
  { scope = 'active', sortBy }: { scope?: NoteScope; sortBy?: NotesSortBy } = {},
) {
  const key = serializeFilter(filter);
  return useLiveQuery(notesQuery({ scope, filter, sortBy }), [key, scope, sortBy]);
}
