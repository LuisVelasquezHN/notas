import { FlashList } from '@shopify/flash-list';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { BackHandler, StyleSheet, View, useWindowDimensions } from 'react-native';

import type { Note, Tag } from '@/db/schema';
import { allChecklistItemsQuery, type ChecklistPreviewItem } from '@/features/checklist/repository';
import { activeRemindersQuery } from '@/features/reminders/repository';
import { noteTagsQuery, tagsQuery } from '@/features/tags/repository';
import { useNow } from '@/lib/use-now';
import { useSettingsStore, type NotesLayout } from '@/stores/settings-store';
import { useUiStore } from '@/stores/ui-store';
import { MAX_CONTENT_WIDTH, spacing } from '@/theme';

import { NoteActionsSheet } from './note-actions-sheet';
import { NoteCard } from './note-card';
import { SelectionBar } from './selection-bar';
import { SortableNoteGrid } from './sortable-note-grid';

type NoteListProps = {
  notes: Note[];
  layout: NotesLayout;
  ListHeaderComponent?: ReactElement | null;
  ListEmptyComponent?: ReactElement | null;
  /** Texto inferior de cada tarjeta. */
  meta?: (note: Note) => string | undefined;
  /**
   * La lista sigue el orden de las preferencias: con "Manual" se puede arrastrar.
   * (No en búsqueda ni papelera, que tienen su propio orden.)
   */
  reorderable?: boolean;
};

/** Columnas de la cuadrícula según el ancho disponible. */
function useGridColumns() {
  const width = Math.min(useWindowDimensions().width, MAX_CONTENT_WIDTH);
  return width >= 720 ? 3 : 2;
}

function groupBy<T, V>(rows: T[], key: (row: T) => string, value: (row: T) => V | undefined) {
  const map = new Map<string, V[]>();
  for (const row of rows) {
    const v = value(row);
    if (v === undefined) continue;
    const list = map.get(key(row));
    if (list) list.push(v);
    else map.set(key(row), [v]);
  }
  return map;
}

/**
 * Lista de notas: cuadrícula tipo masonry o lista. Mantener pulsada una nota entra en selección
 * múltiple; con el orden manual, mantener pulsado y arrastrar la mueve.
 * Se usa en Notas, carpetas, etiquetas, carpetas inteligentes, búsqueda, archivo y papelera.
 */
export function NoteList({
  notes,
  layout,
  ListHeaderComponent,
  ListEmptyComponent,
  meta,
  reorderable = false,
}: NoteListProps) {
  const columns = useGridColumns();
  const grid = layout === 'grid';
  const manual = useSettingsStore((s) => s.notesSortBy === 'manual') && reorderable;
  const [menuOpen, setMenuOpen] = useState(false);

  const selectedIds = useUiStore((s) => s.selectedNoteIds);
  const toggleSelection = useUiStore((s) => s.toggleNoteSelection);
  const toggleSelectAll = useUiStore((s) => s.toggleSelectAll);
  const clearSelection = useUiStore((s) => s.clearSelection);
  const selected = useMemo(() => notes.filter((n) => selectedIds.has(n.id)), [notes, selectedIds]);
  const selecting = selected.length > 0;

  // La selección es de esta pantalla: se vacía al salir de ella.
  useFocusEffect(useCallback(() => clearSelection, [clearSelection]));

  // Si las notas seleccionadas desaparecen de la lista (p. ej. se archivan), se sale del modo.
  useEffect(() => {
    if (selectedIds.size > 0 && selected.length === 0) clearSelection();
  }, [selectedIds, selected.length, clearSelection]);

  // Android: el botón "atrás" primero cancela la selección.
  useEffect(() => {
    if (!selecting) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      clearSelection();
      return true;
    });
    return () => sub.remove();
  }, [selecting, clearSelection]);

  const { data: items } = useLiveQuery(allChecklistItemsQuery());
  const itemsByNote = useMemo(
    () =>
      groupBy<ChecklistPreviewItem, ChecklistPreviewItem>(
        items,
        (i) => i.noteId,
        (i) => i,
      ),
    [items],
  );
  const { data: tags } = useLiveQuery(tagsQuery());
  const { data: pairs } = useLiveQuery(noteTagsQuery());
  const tagsByNote = useMemo(() => {
    const byId = new Map(tags.map((t) => [t.id, t]));
    const map = groupBy<(typeof pairs)[number], Tag>(
      pairs,
      (p) => p.noteId,
      (p) => byId.get(p.tagId),
    );
    // Mismo orden alfabético que la lista de etiquetas.
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [tags, pairs]);

  // Próximo recordatorio de cada nota (la consulta viene ordenada por hora).
  const { data: activeReminders } = useLiveQuery(activeRemindersQuery());
  const remindersByNote = useMemo(() => {
    const map = new Map<string, { fireAt: number; recurring: boolean }>();
    for (const r of activeReminders) {
      if (!map.has(r.noteId)) map.set(r.noteId, { fireAt: r.fireAt, recurring: r.rrule !== null });
    }
    return map;
  }, [activeReminders]);
  const now = useNow(60_000);

  const open = (note: Note) => router.push({ pathname: '/note/[id]', params: { id: note.id } });
  const tap = (note: Note) => (selecting ? toggleSelection(note.id) : open(note));

  const card = (note: Note, interactive: boolean) => (
    <NoteCard
      note={note}
      items={itemsByNote.get(note.id)}
      tags={tagsByNote.get(note.id)}
      reminder={remindersByNote.get(note.id)}
      now={now}
      meta={meta?.(note)}
      compact={!grid}
      selected={selectedIds.has(note.id)}
      onPress={interactive ? () => tap(note) : undefined}
      onLongPress={interactive ? () => toggleSelection(note.id) : undefined}
    />
  );

  let body: ReactElement;
  if (notes.length === 0 && ListEmptyComponent) {
    body = (
      <View style={styles.empty}>
        {ListHeaderComponent}
        {ListEmptyComponent}
      </View>
    );
  } else if (manual) {
    body = (
      <SortableNoteGrid
        // Al cambiar de columnas se vuelve a medir la cuadrícula desde cero.
        key={grid ? `grid-${columns}` : 'list'}
        notes={notes}
        columns={grid ? columns : 1}
        selecting={selecting}
        renderCard={(note) => card(note, false)}
        onTap={tap}
        onHold={(note) => toggleSelection(note.id)}
        ListHeaderComponent={ListHeaderComponent}
        contentStyle={styles.content}
      />
    );
  } else {
    body = (
      <FlashList
        key={grid ? `grid-${columns}` : 'list'}
        data={notes}
        keyExtractor={(note) => note.id}
        numColumns={grid ? columns : 1}
        masonry={grid}
        // Las tarjetas dependen también de los ítems, etiquetas, recordatorios y la selección.
        extraData={[itemsByNote, tagsByNote, remindersByNote, now, selectedIds]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          ListHeaderComponent ? <View style={styles.header}>{ListHeaderComponent}</View> : null
        }
        renderItem={({ item }) => <View style={styles.cell}>{card(item, true)}</View>}
      />
    );
  }

  return (
    <>
      {body}
      {selecting ? (
        <SelectionBar
          selected={selected}
          total={notes.length}
          onSelectAll={() => toggleSelectAll(notes.map((n) => n.id))}
          onClear={clearSelection}
          onMore={() => setMenuOpen(true)}
        />
      ) : null}
      <NoteActionsSheet
        notes={menuOpen ? selected : null}
        onClose={() => setMenuOpen(false)}
        onDone={clearSelection}
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
