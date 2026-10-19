import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ColorSwatch, Sheet, SheetItem, afterSheetClose, isIconName } from '@/components/ui';
import type { Note } from '@/db/schema';
import { foldersQuery } from '@/features/folders/repository';
import { buildFolderTree, flattenFolderTree } from '@/features/folders/tree';
import { NOTE_COLOR_TOKENS, spacing } from '@/theme';

import * as actions from '../actions';

type Page = 'main' | 'color' | 'folder';

type NoteActionsSheetProps = {
  note: Note | null;
  onClose: () => void;
  /** Se llama tras una acción que saca la nota de la vista actual (archivar, papelera…). */
  onRemoved?: () => void;
  /** Se llama con el ID de la copia tras duplicar. */
  onDuplicated?: (id: string) => void;
  /** Muestra la opción de anclar (en el editor ya está en la cabecera). */
  showPin?: boolean;
};

/** Menú de acciones de una nota (pulsación larga en la lista o botón "más" del editor). */
export function NoteActionsSheet({
  note,
  onClose,
  onRemoved,
  onDuplicated,
  showPin = true,
}: NoteActionsSheetProps) {
  const [page, setPage] = useState<Page>('main');
  const { data: folders } = useLiveQuery(foldersQuery());

  const close = () => {
    onClose();
    setPage('main');
  };
  const run =
    (fn: () => Promise<unknown>, removed = false) =>
    () => {
      close();
      afterSheetClose(
        () =>
          void fn().then(() => {
            if (removed) onRemoved?.();
          }),
      );
    };

  const title =
    page === 'color' ? 'Color' : page === 'folder' ? 'Mover a carpeta' : note?.title || 'Nota';

  return (
    <Sheet visible={note !== null} onClose={close} title={title}>
      {note && page === 'main' ? (
        note.deletedAt !== null ? (
          <>
            <SheetItem
              icon="restore"
              label="Restaurar"
              onPress={run(() => actions.restore(note), true)}
            />
            <SheetItem
              icon="trash"
              label="Eliminar definitivamente"
              destructive
              onPress={run(async () => {
                if (await actions.deleteForever(note)) onRemoved?.();
              })}
            />
          </>
        ) : (
          <>
            {showPin ? (
              <SheetItem
                icon={note.isPinned ? 'pinFill' : 'pin'}
                label={note.isPinned ? 'Desanclar' : 'Anclar'}
                onPress={run(() => actions.togglePin(note))}
              />
            ) : null}
            <SheetItem icon="palette" label="Color" onPress={() => setPage('color')} />
            <SheetItem icon="move" label="Mover a carpeta" onPress={() => setPage('folder')} />
            <SheetItem
              icon="copy"
              label="Duplicar"
              onPress={run(async () => {
                const id = await actions.duplicate(note);
                if (id) onDuplicated?.(id);
              })}
            />
            <SheetItem
              icon={note.type === 'checklist' ? 'text' : 'checklist'}
              label={note.type === 'checklist' ? 'Convertir en texto' : 'Convertir en lista'}
              onPress={run(() => actions.convert(note))}
            />
            {note.isArchived ? (
              <SheetItem
                icon="unarchive"
                label="Desarchivar"
                onPress={run(() => actions.unarchive(note), true)}
              />
            ) : (
              <SheetItem
                icon="archive"
                label="Archivar"
                onPress={run(() => actions.archive(note), true)}
              />
            )}
            <SheetItem
              icon="trash"
              label="Mover a la papelera"
              destructive
              onPress={run(() => actions.trash(note), true)}
            />
          </>
        )
      ) : null}

      {note && page === 'color' ? (
        <View style={styles.colors}>
          {NOTE_COLOR_TOKENS.map((color) => (
            <ColorSwatch
              key={color}
              color={color}
              size={44}
              selected={note.color === color}
              onPress={run(() => actions.changeColor(note, color))}
            />
          ))}
        </View>
      ) : null}

      {note && page === 'folder' ? (
        <>
          <SheetItem
            icon="note"
            label="Sin carpeta"
            selected={note.folderId === null}
            onPress={run(() => actions.move(note, null, null))}
          />
          {flattenFolderTree(buildFolderTree(folders)).map((folder) => (
            <SheetItem
              key={folder.id}
              icon={isIconName(folder.icon) ? folder.icon : 'folder'}
              label={folder.name}
              inset={folder.depth - 1}
              selected={note.folderId === folder.id}
              onPress={run(() => actions.move(note, folder.id, folder.name))}
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
