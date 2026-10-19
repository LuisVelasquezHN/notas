import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ColorSwatch, Sheet, SheetItem, afterSheetClose, isIconName } from '@/components/ui';
import type { Note } from '@/db/schema';
import { foldersQuery } from '@/features/folders/repository';
import { buildFolderTree, flattenFolderTree } from '@/features/folders/tree';
import { TagPicker } from '@/features/tags/components/tag-picker';
import { NOTE_COLOR_TOKENS, spacing } from '@/theme';

import * as actions from '../actions';

type Page = 'main' | 'color' | 'folder' | 'tags';

type NoteActionsSheetProps = {
  /** Notas sobre las que se actúa (una, o varias en selección múltiple). `null`: cerrada. */
  notes: Note[] | null;
  onClose: () => void;
  /** Se llama tras una acción que saca las notas de la vista actual (archivar, papelera…). */
  onRemoved?: () => void;
  /** Se llama con el ID de la copia tras duplicar. */
  onDuplicated?: (id: string) => void;
  /** Muestra la opción de anclar (en el editor ya está en la cabecera). */
  showPin?: boolean;
  /** Se llama tras ejecutar cualquier acción (p. ej. para salir de la selección múltiple). */
  onDone?: () => void;
  /** Abre directamente una página (p. ej. las etiquetas desde el editor). */
  initialPage?: Page;
};

/**
 * Menú de acciones de una o varias notas: pulsación larga en la lista, barra de selección
 * múltiple o botón "más" del editor.
 */
export function NoteActionsSheet({
  notes,
  onClose,
  onRemoved,
  onDuplicated,
  onDone,
  showPin = true,
  initialPage = 'main',
}: NoteActionsSheetProps) {
  const [pageState, setPage] = useState<Page | null>(null);
  const page = pageState ?? initialPage;
  const { data: folders } = useLiveQuery(foldersQuery());

  const close = () => {
    onClose();
    setPage(null);
  };
  const run =
    (fn: () => Promise<unknown>, removed = false) =>
    () => {
      close();
      onDone?.();
      afterSheetClose(
        () =>
          void fn().then(() => {
            if (removed) onRemoved?.();
          }),
      );
    };

  const single = notes?.length === 1 ? notes[0] : null;
  const count = notes?.length ?? 0;
  const mainTitle = single ? single.title || 'Nota' : `${count} notas seleccionadas`;
  const title = {
    main: mainTitle,
    color: 'Color',
    folder: 'Mover a carpeta',
    tags: 'Etiquetas',
  }[page];

  const inTrash = notes?.every((n) => n.deletedAt !== null) ?? false;
  const allPinned = notes?.every((n) => n.isPinned) ?? false;
  const allFavorite = notes?.every((n) => n.isFavorite) ?? false;
  const allArchived = notes?.every((n) => n.isArchived) ?? false;
  const sameColor = notes && notes.every((n) => n.color === notes[0].color) ? notes[0].color : null;
  const sameFolder =
    notes && notes.every((n) => n.folderId === notes[0].folderId) ? notes[0].folderId : undefined;

  return (
    <Sheet visible={notes !== null && notes.length > 0} onClose={close} title={title}>
      {notes && page === 'main' ? (
        inTrash ? (
          <>
            <SheetItem
              icon="restore"
              label="Restaurar"
              onPress={run(() => actions.restore(notes), true)}
            />
            <SheetItem
              icon="trash"
              label="Eliminar definitivamente"
              destructive
              onPress={run(async () => {
                if (await actions.deleteForever(notes)) onRemoved?.();
              })}
            />
          </>
        ) : (
          <>
            {showPin ? (
              <SheetItem
                icon={allPinned ? 'pinFill' : 'pin'}
                label={allPinned ? 'Desanclar' : 'Anclar'}
                onPress={run(() => actions.togglePin(notes))}
              />
            ) : null}
            <SheetItem
              icon={allFavorite ? 'starFill' : 'star'}
              label={allFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              onPress={run(() => actions.toggleFavorite(notes))}
            />
            <SheetItem icon="palette" label="Color" onPress={() => setPage('color')} />
            <SheetItem icon="tag" label="Etiquetas" onPress={() => setPage('tags')} />
            <SheetItem icon="move" label="Mover a carpeta" onPress={() => setPage('folder')} />
            {single ? (
              <>
                <SheetItem
                  icon="copy"
                  label="Duplicar"
                  onPress={run(async () => {
                    const id = await actions.duplicate(single);
                    if (id) onDuplicated?.(id);
                  })}
                />
                <SheetItem
                  icon={single.type === 'checklist' ? 'text' : 'checklist'}
                  label={single.type === 'checklist' ? 'Convertir en texto' : 'Convertir en lista'}
                  onPress={run(() => actions.convert(single))}
                />
              </>
            ) : null}
            {allArchived ? (
              <SheetItem
                icon="unarchive"
                label="Desarchivar"
                onPress={run(() => actions.unarchive(notes), true)}
              />
            ) : (
              <SheetItem
                icon="archive"
                label="Archivar"
                onPress={run(() => actions.archive(notes.filter((n) => !n.isArchived)), true)}
              />
            )}
            <SheetItem
              icon="trash"
              label="Mover a la papelera"
              destructive
              onPress={run(() => actions.trash(notes), true)}
            />
          </>
        )
      ) : null}

      {notes && page === 'color' ? (
        <View style={styles.colors}>
          {NOTE_COLOR_TOKENS.map((color) => (
            <ColorSwatch
              key={color}
              color={color}
              size={44}
              selected={sameColor === color}
              onPress={run(() => actions.changeColor(notes, color))}
            />
          ))}
        </View>
      ) : null}

      {notes && page === 'tags' ? <TagPicker notes={notes} /> : null}

      {notes && page === 'folder' ? (
        <>
          <SheetItem
            icon="note"
            label="Sin carpeta"
            selected={sameFolder === null}
            onPress={run(() => actions.move(notes, null, null))}
          />
          {flattenFolderTree(buildFolderTree(folders)).map((folder) => (
            <SheetItem
              key={folder.id}
              icon={isIconName(folder.icon) ? folder.icon : 'folder'}
              label={folder.name}
              inset={folder.depth - 1}
              selected={sameFolder === folder.id}
              onPress={run(() => actions.move(notes, folder.id, folder.name))}
            />
          ))}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  colors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
