import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  EmptyState,
  Icon,
  IconButton,
  KeyboardAvoider,
  Screen,
  Text,
} from '@/components/ui';
import type { Note } from '@/db';
import { addInlineImages } from '@/features/attachments/actions';
import { AttachSheet } from '@/features/attachments/components/attach-sheet';
import { useInlineImageSources } from '@/features/attachments/hooks/use-inline-images';
import { AudioList } from '@/features/attachments/components/audio-list';
import { ImageGallery } from '@/features/attachments/components/image-gallery';
import { ImageViewer } from '@/features/attachments/components/image-viewer';
import { VoiceRecorderSheet } from '@/features/attachments/components/voice-recorder-sheet';
import { noteAttachmentsQuery } from '@/features/attachments/repository';
import { ChecklistEditor } from '@/features/checklist/components/checklist-editor';
import {
  Editor,
  docToText,
  editorCapabilities,
  type EditorHandle,
  type EditorShortcut,
  type FormatState,
} from '@/features/editor';
import * as actions from '@/features/notes/actions';
import {
  NoteActionsSheet,
  type NoteActionsPage,
} from '@/features/notes/components/note-actions-sheet';
import { NoteLinkSheet } from '@/features/notes/components/note-link-sheet';
import { NoteToolbar } from '@/features/notes/components/note-toolbar';
import { VersionHistorySheet } from '@/features/notes/components/version-history-sheet';
import { useAutosave } from '@/features/notes/hooks/use-autosave';
import { useNoteDraft, type NoteDraft } from '@/features/notes/hooks/use-note-draft';
import {
  discardIfEmpty,
  noteQuery,
  saveNoteContent,
  updateNote,
} from '@/features/notes/repository';
import { ReminderChip } from '@/features/reminders/components/reminder-chip';
import { LockedNote } from '@/features/security/components/locked-note';
import { noteReminderQuery } from '@/features/reminders/repository';
import { TagPill } from '@/features/tags/components/tag-pill';
import { tagsForNoteQuery } from '@/features/tags/repository';
import { daysLeftInTrash, formatRelativeDate } from '@/lib/dates';
import { consumeWebEnter } from '@/lib/keyboard';
import { useAutoGrow } from '@/lib/use-auto-grow';
import { useKeyboardVisible } from '@/lib/use-keyboard-visible';
import { useNow } from '@/lib/use-now';
import { useShortcuts } from '@/lib/use-shortcuts';
import { countWords } from '@/lib/words';
import { showSnackbar } from '@/stores/snackbar-store';
import { useSecurityStore } from '@/stores/security-store';
import { MAX_CONTENT_WIDTH, fonts, radius, spacing, typography, useTheme } from '@/theme';

/** Margen bajo el cursor al hacer scroll para seguirlo (deja ver la línea siguiente). */
const CARET_MARGIN = 48;

export default function NoteScreen() {
  // `record=1`: abrir la grabadora al entrar (acción rápida "Nota de voz").
  const { id, record } = useLocalSearchParams<{ id: string; record?: string }>();
  const { t } = useTranslation();
  const { data, updatedAt } = useLiveQuery(noteQuery(id), [id]);
  const note = data[0];
  const unlocked = useSecurityStore((s) => (note ? s.unlockedNoteIds.includes(note.id) : false));
  /** Al restaurar una versión: el editor se vuelve a montar cuando llega el contenido restaurado. */
  const [restoredAt, setRestoredAt] = useState(0);

  if (!note) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        {/* `updatedAt` indica que la consulta ya respondió: antes no se muestra "no encontrada". */}
        {updatedAt ? <EmptyState icon="note" title={t('editor.notFound')} /> : null}
      </Screen>
    );
  }
  // Bloqueada: no se monta el editor (ni se lee el contenido) hasta verificar.
  if (note.isLocked && !unlocked) return <LockedNote note={note} />;
  if (note.updatedAt < restoredAt) return <Screen edges={[]}>{null}</Screen>;
  // Al convertir texto ↔ checklist (o restaurar una versión) se vuelve a montar el editor con el
  // contenido nuevo.
  return (
    <NoteEditor
      key={`${note.id}:${note.type}:${restoredAt}`}
      note={note}
      autoRecord={record === '1'}
      onRestored={setRestoredAt}
    />
  );
}

function NoteEditor({
  note,
  autoRecord,
  onRestored,
}: {
  note: Note;
  autoRecord: boolean;
  onRestored: (updatedAt: number) => void;
}) {
  const { colors, noteColor } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [menu, setMenu] = useState<NoteActionsPage | null>(null);
  const { data: tags } = useLiveQuery(tagsForNoteQuery(note.id), [note.id]);
  const { data: reminderRows } = useLiveQuery(noteReminderQuery(note.id), [note.id]);
  const reminder = reminderRows[0];
  const now = useNow();
  const titleAutoGrow = useAutoGrow();
  const { draft, setTitle, setDoc, undo, redo, canUndo, canRedo } = useNoteDraft(note);
  const { data: attachmentRows } = useLiveQuery(noteAttachmentsQuery(note.id), [note.id]);
  // Las imágenes del texto no van en la galería de arriba (portada).
  const images = useMemo(
    () => attachmentRows.filter((a) => a.kind === 'image' && a.placement !== 'inline'),
    [attachmentRows],
  );
  const inlineImages = useInlineImageSources(note.id);
  const inlineRows = useMemo(
    () => attachmentRows.filter((a) => a.kind === 'image' && a.placement === 'inline'),
    [attachmentRows],
  );
  const [openInline, setOpenInline] = useState<number | null>(null);
  const words = useMemo(() => countWords(docToText(draft.doc)), [draft.doc]);
  const audios = useMemo(() => attachmentRows.filter((a) => a.kind === 'audio'), [attachmentRows]);

  const inTrash = note.deletedAt !== null;
  /** Modo lectura: sin teclado ni barras, imágenes y enlaces se abren con un toque. */
  const [reading, setReading] = useState(false);
  const editable = !inTrash && !reading;
  const isText = note.type === 'text';
  const background = noteColor(note.color);

  const [attachOpen, setAttachOpen] = useState(false);
  const [recording, setRecording] = useState(autoRecord && editable);
  const [formatOpen, setFormatOpen] = useState(false);
  const [formatState, setFormatState] = useState<FormatState>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [linkPicker, setLinkPicker] = useState(false);
  /** Nota elegida para enlazar: se inserta cuando la hoja termina de cerrarse. */
  const pendingLink = useRef<Note | null>(null);
  const insertPendingLink = () => {
    const target = pendingLink.current;
    pendingLink.current = null;
    if (target) {
      editorRef.current?.insertNoteLink?.(target.id, target.title.trim() || t('card.untitled'));
    }
  };
  const editorRef = useRef<EditorHandle>(null);
  const keyboardVisible = useKeyboardVisible();

  // Seguir el cursor del editor enriquecido (en nativo vive en una webview sin scroll propio).
  const scrollY = useRef(0);
  const viewportHeight = useRef(0);
  /** Alto visible: el editor no crece más (se desplaza por dentro, ver `RichTextEditor`). */
  const [viewport, setViewport] = useState(0);
  const editorY = useRef(0);
  const followCaret = (bottom: number) => {
    const caret = editorY.current + bottom + CARET_MARGIN;
    const visibleBottom = scrollY.current + viewportHeight.current;
    if (viewportHeight.current > 0 && caret > visibleBottom) {
      scrollRef.current?.scrollTo({ y: caret - viewportHeight.current, animated: true });
    }
  };

  const flush = useAutosave<NoteDraft>(
    draft,
    (value) =>
      isText
        ? saveNoteContent(note.id, value.title, value.doc)
        : updateNote(note.id, { title: value.title }),
    {
      // Una nota nueva que se deja en blanco no se queda en la lista.
      onUnmount: () => {
        if (!inTrash) void discardIfEmpty(note.id);
      },
    },
  );

  /** Atajos dentro del editor (con teclado, también en el móvil) y fuera (web, `useShortcuts`). */
  const handleShortcut = (shortcut: EditorShortcut) => {
    if (shortcut === 'undo') undo();
    else if (shortcut === 'redo') redo();
    else if (shortcut === 'reading') toggleReading();
    else void flush().then(() => showSnackbar(t('editor.saved')));
  };
  useShortcuts(
    {
      'mod+z': () => handleShortcut('undo'),
      'mod+shift+z': () => handleShortcut('redo'),
      'mod+y': () => handleShortcut('redo'),
      'mod+s': () => handleShortcut('save'),
    },
    editable && !menu && !attachOpen && !recording,
  );
  const sheetOpen =
    !!menu || attachOpen || recording || historyOpen || linkPicker || openInline !== null;
  const toggleReading = () => {
    void flush();
    setFormatOpen(false);
    setReading((r) => !r);
  };
  useShortcuts(
    {
      'alt+r': toggleReading,
      escape: () => {
        if (router.canGoBack()) router.back();
      },
    },
    !inTrash && !sheetOpen,
  );

  const openLinkedNote = (id: string) => {
    void flush();
    router.push({ pathname: '/note/[id]', params: { id } });
  };

  const openMenu = (page: NoteActionsPage = 'main') => {
    void flush();
    setMenu(page);
  };

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: background },
          headerShadowVisible: false,
          headerRight: () => (
            <View style={styles.headerActions}>
              {editable && isText ? (
                <>
                  <IconButton
                    icon="undo"
                    accessibilityLabel={t('common.undo')}
                    disabled={!canUndo}
                    color={canUndo ? colors.text : colors.textMuted}
                    onPress={undo}
                  />
                  <IconButton
                    icon="redo"
                    accessibilityLabel={t('common.redo')}
                    disabled={!canRedo}
                    color={canRedo ? colors.text : colors.textMuted}
                    onPress={redo}
                  />
                </>
              ) : null}
              {!inTrash ? (
                <IconButton
                  icon={reading ? 'edit' : 'reading'}
                  accessibilityLabel={reading ? t('editor.editMode') : t('editor.readingMode')}
                  aria-selected={reading}
                  onPress={toggleReading}
                  testID="reading-mode"
                />
              ) : null}
              {!inTrash ? (
                <IconButton
                  icon={reminder ? 'bellFill' : 'bell'}
                  accessibilityLabel={
                    reminder ? t('editor.changeReminder') : t('editor.addReminder')
                  }
                  onPress={() => openMenu('reminder')}
                />
              ) : null}
              {!inTrash ? (
                <IconButton
                  icon={note.isPinned ? 'pinFill' : 'pin'}
                  accessibilityLabel={note.isPinned ? t('editor.unpin') : t('editor.pin')}
                  aria-selected={note.isPinned}
                  onPress={() => void actions.togglePin([note])}
                />
              ) : null}
              <IconButton
                icon="more"
                accessibilityLabel={t('common.moreActions')}
                onPress={() => openMenu()}
              />
            </View>
          ),
        }}
      />

      <KeyboardAvoider style={styles.root} offset={insets.top + 44}>
        <Animated.ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onLayout={(e) => {
            viewportHeight.current = e.nativeEvent.layout.height;
            setViewport(e.nativeEvent.layout.height);
          }}
          onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={32}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: (editable ? 0 : insets.bottom) + spacing.xxxl },
          ]}>
          {inTrash ? (
            <View style={[styles.banner, { backgroundColor: colors.surfaceMuted }]}>
              <Text tone="secondary" style={styles.bannerText}>
                {t('editor.inTrash', { count: daysLeftInTrash(note.deletedAt!) })}
              </Text>
              <Button
                title={t('common.restore')}
                variant="secondary"
                icon="restore"
                onPress={() => void actions.restore([note])}
              />
            </View>
          ) : null}

          <ImageGallery images={images} editable={editable} />

          <TextInput
            accessibilityLabel={t('editor.titlePlaceholder')}
            testID="note-title"
            value={draft.title}
            onChangeText={setTitle}
            editable={editable}
            placeholder={t('editor.titlePlaceholder')}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            multiline
            scrollEnabled={false}
            submitBehavior="blurAndSubmit"
            // El título es de una sola línea lógica: Intro no inserta saltos.
            onKeyPress={consumeWebEnter}
            onContentSizeChange={titleAutoGrow.onContentSizeChange}
            numberOfLines={titleAutoGrow.numberOfLines}
            style={[
              styles.title,
              typography.title,
              { fontFamily: fonts.sans, color: colors.text },
              titleAutoGrow.style,
            ]}
          />

          {isText ? (
            <View onLayout={(e) => (editorY.current = e.nativeEvent.layout.y)}>
              <Editor
                ref={editorRef}
                value={draft.doc}
                onChange={setDoc}
                editable={editable}
                autoFocus={!note.title && !note.contentText && !autoRecord}
                onFormatChange={setFormatState}
                onCaret={followCaret}
                maxHeight={viewport || undefined}
                images={inlineImages}
                onShortcut={handleShortcut}
                onImageFiles={(files) => {
                  void addInlineImages(note.id, files).then((rows) =>
                    editorRef.current?.insertImages?.(rows.map((r) => r.id)),
                  );
                }}
                onOpenImage={(id) => {
                  const index = inlineRows.findIndex((a) => a.id === id);
                  if (index !== -1) setOpenInline(index);
                }}
                onOpenNote={openLinkedNote}
                onLinkRequest={() => setLinkPicker(true)}
              />
            </View>
          ) : (
            <ChecklistEditor note={note} editable={editable} scrollableRef={scrollRef} />
          )}

          <AudioList audios={audios} editable={editable} />

          {reminder && !inTrash ? (
            <ReminderChip
              fireAt={reminder.fireAt}
              recurring={reminder.rrule !== null}
              now={now}
              onPress={() => openMenu('reminder')}
            />
          ) : null}

          {tags.length > 0 || editable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                tags.length > 0
                  ? t('editor.tagsLabel', { tags: tags.map((tag) => tag.name).join(', ') })
                  : t('editor.addTags')
              }
              disabled={!editable}
              onPress={() => openMenu('tags')}
              style={({ pressed }) => [styles.tags, pressed && { opacity: 0.6 }]}>
              {tags.map((tag) => (
                <TagPill key={tag.id} tag={tag} onCard />
              ))}
              {editable && tags.length === 0 ? (
                <>
                  <Icon name="tag" size={14} color={colors.textMuted} />
                  <Text variant="caption" tone="muted">
                    {t('editor.addTags')}
                  </Text>
                </>
              ) : null}
            </Pressable>
          ) : null}

          <Text variant="caption" tone="muted" style={styles.meta}>
            {t('editor.edited', { when: formatRelativeDate(note.updatedAt, now, t).toLowerCase() })}
            {isText ? ` · ${t('editor.words', { count: words })}` : ''}
          </Text>
        </Animated.ScrollView>

        {editable ? (
          <NoteToolbar
            background={background}
            bottomInset={keyboardVisible ? 0 : insets.bottom}
            onAttach={() => {
              void flush();
              setAttachOpen(true);
            }}
            onRecord={() => {
              void flush();
              setRecording(true);
            }}
            format={
              isText && editorCapabilities.richText
                ? {
                    open: formatOpen,
                    state: formatState,
                    onToggle: () => setFormatOpen((open) => !open),
                    onFormat: (command) => editorRef.current?.format(command),
                  }
                : undefined
            }
          />
        ) : null}
      </KeyboardAvoider>

      <AttachSheet
        noteId={note.id}
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        onRecord={() => setRecording(true)}
        onInlineImages={
          isText && editorCapabilities.richText
            ? (rows) => editorRef.current?.insertImages?.(rows.map((r) => r.id))
            : undefined
        }
        onNoteLink={isText && editorCapabilities.richText ? () => setLinkPicker(true) : undefined}
      />
      <NoteLinkSheet
        visible={linkPicker}
        currentNoteId={note.id}
        onClose={() => setLinkPicker(false)}
        // Con la hoja ya cerrada (mientras se cierra, en web retiene el foco): el editor lo recupera
        // con el cursor tras el enlace. Android no avisa del cierre.
        onDismiss={insertPendingLink}
        onPick={(target) => {
          pendingLink.current = target;
          setLinkPicker(false);
          if (Platform.OS === 'android') setTimeout(insertPendingLink, 350);
        }}
      />
      {isText ? (
        <VersionHistorySheet
          noteId={note.id}
          visible={historyOpen}
          onClose={() => setHistoryOpen(false)}
          flush={flush}
          onRestored={onRestored}
        />
      ) : null}
      <ImageViewer
        key={`inline-${openInline ?? 'closed'}`}
        images={inlineRows}
        index={openInline}
        // Se quitan del texto (y se deshacen) desde el propio editor.
        editable={false}
        onClose={() => setOpenInline(null)}
      />
      <VoiceRecorderSheet
        noteId={note.id}
        visible={recording}
        onClose={() => setRecording(false)}
      />

      <NoteActionsSheet
        key={menu ?? 'closed'}
        notes={menu ? [note] : null}
        initialPage={menu ?? 'main'}
        showPin={false}
        onHistory={isText ? () => setHistoryOpen(true) : undefined}
        onClose={() => setMenu(null)}
        onRemoved={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        onDuplicated={(copyId) =>
          router.replace({ pathname: '/note/[id]', params: { id: copyId } })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  content: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  bannerText: { flex: 1 },
  title: { padding: 0, outlineStyle: 'none' } as object,
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  meta: { textAlign: 'center', marginTop: spacing.xl },
});
