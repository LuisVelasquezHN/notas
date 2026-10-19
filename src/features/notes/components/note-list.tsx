import { FlashList } from '@shopify/flash-list';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useMemo, useState, type ReactElement } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import type { Note } from '@/db/schema';
import { allChecklistItemsQuery, type ChecklistPreviewItem } from '@/features/checklist/repository';
import type { NotesLayout } from '@/stores/settings-store';
import { MAX_CONTENT_WIDTH, spacing } from '@/theme';

import { NoteActionsSheet } from './note-actions-sheet';
import { NoteCard } from './note-card';

type NoteListProps = {
  notes: Note[];
  layout: NotesLayout;
  ListHeaderComponent?: ReactElement | null;
  ListEmptyComponent?: ReactElement | null;
  /** Texto inferior de cada tarjeta. */
  meta?: (note: Note) => string | undefined;
};

/** Columnas de la cuadrícula según el ancho disponible. */
function useGridColumns() {
  const width = Math.min(useWindowDimensions().width, MAX_CONTENT_WIDTH);
  return width >= 720 ? 3 : 2;
}

/**
 * Lista de notas: cuadrícula tipo masonry o lista, con menú de acciones al mantener pulsado.
 * Se usa en Notas, carpetas, búsqueda, archivo y papelera.
 */
export function NoteList({
  notes,
  layout,
  ListHeaderComponent,
  ListEmptyComponent,
  meta,
}: NoteListProps) {
  const columns = useGridColumns();
  const grid = layout === 'grid';
  const [menuNote, setMenuNote] = useState<Note | null>(null);

  const { data: items } = useLiveQuery(allChecklistItemsQuery());
  const itemsByNote = useMemo(() => {
    const map = new Map<string, ChecklistPreviewItem[]>();
    for (const item of items) {
      const list = map.get(item.noteId);
      if (list) list.push(item);
      else map.set(item.noteId, [item]);
    }
    return map;
  }, [items]);

  if (notes.length === 0 && ListEmptyComponent) {
    return (
      <View style={styles.empty}>
        {ListHeaderComponent}
        {ListEmptyComponent}
      </View>
    );
  }

  return (
    <>
      <FlashList
        key={grid ? `grid-${columns}` : 'list'}
        data={notes}
        keyExtractor={(note) => note.id}
        numColumns={grid ? columns : 1}
        masonry={grid}
        // Las vistas previas dependen de los ítems, no solo de la nota.
        extraData={itemsByNote}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          ListHeaderComponent ? <View style={styles.header}>{ListHeaderComponent}</View> : null
        }
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <NoteCard
              note={item}
              items={itemsByNote.get(item.id)}
              meta={meta?.(item)}
              compact={!grid}
              onPress={() => router.push({ pathname: '/note/[id]', params: { id: item.id } })}
              onLongPress={() => setMenuNote(item)}
            />
          </View>
        )}
      />
      <NoteActionsSheet
        // Siempre con los datos actuales de la nota (p. ej. tras anclar desde el propio menú).
        note={menuNote ? (notes.find((n) => n.id === menuNote.id) ?? menuNote) : null}
        onClose={() => setMenuNote(null)}
        onDuplicated={(id) => router.push({ pathname: '/note/[id]', params: { id } })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, paddingHorizontal: spacing.lg },
  content: { paddingHorizontal: spacing.lg - spacing.xs, paddingBottom: 120 },
  header: { paddingHorizontal: spacing.xs },
  cell: { padding: spacing.xs },
});
