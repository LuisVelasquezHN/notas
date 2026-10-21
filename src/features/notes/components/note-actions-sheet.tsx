import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  ColorSwatch,
  Sheet,
  SheetItem,
  afterSheetClose,
  isIconName,
  type IconName,
} from '@/components/ui';
import type { Note } from '@/db/schema';
import { exportNote, type ExportFormat } from '@/features/export/actions';
import { canShareText } from '@/features/export/share';
import { foldersQuery } from '@/features/folders/repository';
import * as reminderActions from '@/features/reminders/actions';
import { ReminderEditor } from '@/features/reminders/components/reminder-sheet';
import { noteReminderQuery } from '@/features/reminders/repository';
import { buildFolderTree, flattenFolderTree } from '@/features/folders/tree';
import * as securityActions from '@/features/security/actions';
import { TagPicker } from '@/features/tags/components/tag-picker';
import { capabilities } from '@/lib/capabilities';
import { useEntitlement } from '@/lib/entitlements';
import { NOTE_COLOR_TOKENS, spacing } from '@/theme';

import * as actions from '../actions';

export type NoteActionsPage = 'main' | 'color' | 'folder' | 'tags' | 'reminder' | 'export';
type Page = NoteActionsPage;

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
  const { t } = useTranslation();
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
  const { data: reminderRows } = useLiveQuery(noteReminderQuery(single?.id ?? ''), [single?.id]);
  const reminder = single ? reminderRows[0] : undefined;
  const count = notes?.length ?? 0;
  const mainTitle = single
    ? single.title || t('common.note')
    : t('noteActions.selected', { count });
  const title = {
    main: mainTitle,
    color: t('noteActions.color'),
    folder: t('noteActions.move'),
    tags: t('noteActions.tags'),
    reminder: t('reminders.reminder'),
    export: t('export.title'),
  }[page];

  const inTrash = notes?.every((n) => n.deletedAt !== null) ?? false;
  const allPinned = notes?.every((n) => n.isPinned) ?? false;
  const allFavorite = notes?.every((n) => n.isFavorite) ?? false;
  const allArchived = notes?.every((n) => n.isArchived) ?? false;
  const allLocked = notes?.every((n) => n.isLocked) ?? false;
  const canLock = useEntitlement('noteLock') && capabilities.biometrics;
  const canExport = useEntitlement('export');
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
              label={t('common.restore')}
              onPress={run(() => actions.restore(notes), true)}
            />
            <SheetItem
              icon="trash"
              label={t('noteActions.deleteForever')}
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
                label={allPinned ? t('noteActions.unpin') : t('noteActions.pin')}
                onPress={run(() => actions.togglePin(notes))}
              />
            ) : null}
            <SheetItem
              icon={allFavorite ? 'starFill' : 'star'}
              label={allFavorite ? t('noteActions.unfavorite') : t('noteActions.favorite')}
              onPress={run(() => actions.toggleFavorite(notes))}
            />
            {single ? (
              <SheetItem
                icon={reminder ? 'bellFill' : 'bell'}
                label={reminder ? t('editor.changeReminder') : t('editor.addReminder')}
                onPress={() => setPage('reminder')}
              />
            ) : null}
            <SheetItem
              icon="palette"
              label={t('noteActions.color')}
              onPress={() => setPage('color')}
            />
            <SheetItem icon="tag" label={t('noteActions.tags')} onPress={() => setPage('tags')} />
            <SheetItem
              icon="move"
              label={t('noteActions.move')}
              onPress={() => setPage('folder')}
            />
            {single ? (
              <>
                <SheetItem
                  icon="copy"
                  label={t('noteActions.duplicate')}
                  onPress={run(async () => {
                    const id = await actions.duplicate(single);
                    if (id) onDuplicated?.(id);
                  })}
                />
                {canExport ? (
                  <SheetItem
                    icon="share"
                    label={t('export.title')}
                    onPress={() => setPage('export')}
                  />
                ) : null}
                <SheetItem
                  icon={single.type === 'checklist' ? 'text' : 'checklist'}
                  label={
                    single.type === 'checklist'
                      ? t('noteActions.toText')
                      : t('noteActions.toChecklist')
                  }
                  onPress={run(() => actions.convert(single))}
                />
              </>
            ) : null}
            {canLock || allLocked ? (
              <SheetItem
                icon={allLocked ? 'lockOpen' : 'lock'}
                label={allLocked ? t('lock.unlockNote') : t('lock.lockNote')}
                onPress={run(() => securityActions.toggleLock(notes))}
              />
            ) : null}
            {allArchived ? (
              <SheetItem
                icon="unarchive"
                label={t('noteActions.unarchive')}
                onPress={run(() => actions.unarchive(notes), true)}
              />
            ) : (
              <SheetItem
                icon="archive"
                label={t('noteActions.archive')}
                onPress={run(() => actions.archive(notes.filter((n) => !n.isArchived)), true)}
              />
            )}
            <SheetItem
              icon="trash"
              label={t('noteActions.trash')}
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

      {single && page === 'export'
        ? EXPORT_OPTIONS.filter((o) => o.format !== 'share' || canShareText).map((option) => (
            <SheetItem
              key={option.format}
              icon={option.icon}
              label={t(`export.${option.format}`)}
              onPress={run(() => exportNote(single, option.format))}
            />
          ))
        : null}

      {single && page === 'reminder' ? (
        <ReminderEditor
          current={reminder}
          onSave={(value) =>
            run(() => reminderActions.saveNoteReminder(single.id, value.fireAt, value.rrule))()
          }
          onRemove={reminder ? run(() => reminderActions.remove(reminder.id)) : undefined}
        />
      ) : null}

      {notes && page === 'folder' ? (
        <>
          <SheetItem
            icon="note"
            label={t('noteActions.noFolder')}
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

const EXPORT_OPTIONS: { format: ExportFormat; icon: IconName }[] = [
  { format: 'share', icon: 'share' },
  { format: 'markdown', icon: 'markdown' },
  { format: 'text', icon: 'text' },
  { format: 'pdf', icon: 'pdf' },
];

const styles = StyleSheet.create({
  colors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
