import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, useLocalSearchParams } from 'expo-router';

import { EmptyState, Screen, Text } from '@/components/ui';
import { getDb, notes } from '@/db';
import { spacing } from '@/theme';

/** Placeholder del editor: el EditorAdapter (texto plano → TipTap) se implementa en la fase 1. */
export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useLiveQuery(getDb().select().from(notes).where(eq(notes.id, id)).limit(1), [
    id,
  ]);
  const note = data[0];

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: note?.title || 'Nueva nota' }} />
      {note ? (
        <Text tone="secondary" style={{ paddingVertical: spacing.lg }}>
          Editor en construcción (fase 1). ID: {note.id}
        </Text>
      ) : (
        <EmptyState icon="note" title="Nota no encontrada" />
      )}
    </Screen>
  );
}
