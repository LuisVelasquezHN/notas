import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, Icon, IconButton, Screen, Text } from '@/components/ui';
import type { Note } from '@/db';
import { ChecklistEditor } from '@/features/checklist/components/checklist-editor';
import { Editor } from '@/features/editor';
import * as actions from '@/features/notes/actions';
import { NoteActionsSheet } from '@/features/notes/components/note-actions-sheet';
import { useAutosave } from '@/features/notes/hooks/use-autosave';
import { useNoteDraft, type NoteDraft } from '@/features/notes/hooks/use-note-draft';
import {
  discardIfEmpty,
  noteQuery,
  saveNoteContent,
  updateNote,
} from '@/features/notes/repository';
import { TagPill } from '@/features/tags/components/tag-pill';
import { tagsForNoteQuery } from '@/features/tags/repository';
import { daysLeftInTrash, formatRelativeDate } from '@/lib/dates';
import { consumeWebEnter } from '@/lib/keyboard';
import { useAutoGrow } from '@/lib/use-auto-grow';
import { MAX_CONTENT_WIDTH, fonts, radius, spacing, typography, useTheme } from '@/theme';

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, updatedAt } = useLiveQuery(noteQuery(id), [id]);
  const note = data[0];

  if (!note) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        {/* `updatedAt` indica que la consulta ya respondió: antes no se muestra "no encontrada". */}
        {updatedAt ? <EmptyState icon="note" title="Nota no encontrada" /> : null}
      </Screen>
    );
  }
  // Al convertir texto ↔ checklist se vuelve a montar el editor con el contenido nuevo.
  return <NoteEditor key={`${note.id}:${note.type}`} note={note} />;
}

function NoteEditor({ note }: { note: Note }) {
  const { colors, noteColor } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const [menu, setMenu] = useState<'main' | 'tags' | null>(null);
  const { data: tags } = useLiveQuery(tagsForNoteQuery(note.id), [note.id]);
  const titleAutoGrow = useAutoGrow();
  const { draft, setTitle, setDoc, undo, redo, canUndo, canRedo } = useNoteDraft(note);

  const inTrash = note.deletedAt !== null;
  const editable = !inTrash;
  const isText = note.type === 'text';
  const background = noteColor(note.color);

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

  const openMenu = (page: 'main' | 'tags' = 'main') => {
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
                    accessibilityLabel="Deshacer"
                    disabled={!canUndo}
                    color={canUndo ? colors.text : colors.textMuted}
                    onPress={undo}
                  />
                  <IconButton
                    icon="redo"
                    accessibilityLabel="Rehacer"
                    disabled={!canRedo}
                    color={canRedo ? colors.text : colors.textMuted}
                    onPress={redo}
                  />
                </>
              ) : null}
              {editable ? (
                <IconButton
                  icon={note.isPinned ? 'pinFill' : 'pin'}
                  accessibilityLabel={note.isPinned ? 'Desanclar' : 'Anclar'}
                  accessibilityState={{ selected: note.isPinned }}
                  onPress={() => void actions.togglePin([note])}
                />
              ) : null}
              <IconButton
                icon="more"
                accessibilityLabel="Más acciones"
                onPress={() => openMenu()}
              />
            </View>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 44}>
        <Animated.ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxxl }]}>
          {inTrash ? (
            <View style={[styles.banner, { backgroundColor: colors.surfaceMuted }]}>
              <Text tone="secondary" style={styles.bannerText}>
                En la papelera · se eliminará en {daysLeftInTrash(note.deletedAt!)} días
              </Text>
              <Button
                title="Restaurar"
                variant="secondary"
                icon="restore"
                onPress={() => void actions.restore([note])}
              />
            </View>
          ) : null}

          <TextInput
            accessibilityLabel="Título"
            value={draft.title}
            onChangeText={setTitle}
            editable={editable}
            placeholder="Título"
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
            <Editor
              value={draft.doc}
              onChange={setDoc}
              editable={editable}
              autoFocus={!note.title && !note.contentText}
            />
          ) : (
            <ChecklistEditor note={note} editable={editable} scrollableRef={scrollRef} />
          )}

          {tags.length > 0 || editable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                tags.length > 0
                  ? `Etiquetas: ${tags.map((t) => t.name).join(', ')}`
                  : 'Añadir etiquetas'
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
                    Añadir etiquetas
                  </Text>
                </>
              ) : null}
            </Pressable>
          ) : null}

          <Text variant="caption" tone="muted" style={styles.meta}>
            Editada {formatRelativeDate(note.updatedAt).toLowerCase()}
          </Text>
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      <NoteActionsSheet
        key={menu ?? 'closed'}
        notes={menu ? [note] : null}
        initialPage={menu ?? 'main'}
        showPin={false}
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
