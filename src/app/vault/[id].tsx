import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Redirect, Stack, router, useLocalSearchParams } from 'expo-router';
import { usePreventCapture } from '@/lib/use-prevent-capture';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, KeyboardAvoider } from '@/components/ui';
import {
  Editor,
  emptyDoc,
  type EditorDoc,
  type EditorHandle,
  type FormatState,
} from '@/features/editor';
import { FormatBar } from '@/features/editor/components/format-bar';
import { useAutosave } from '@/features/notes/hooks/use-autosave';
import { CLIPBOARD_CLEAR_MS, copySecret } from '@/features/vault/clipboard';
import { PasswordGeneratorSheet } from '@/features/vault/components/password-generator-sheet';
import {
  decryptSecureNote,
  deleteSecureNote,
  saveSecureNote,
  secureNoteQuery,
  type SecureNoteContent,
} from '@/features/vault/repository';
import { useVaultStore } from '@/features/vault/store';
import { confirm } from '@/lib/confirm';
import { showSnackbar } from '@/stores/snackbar-store';
import { MAX_CONTENT_WIDTH, fonts, spacing, typography, useTheme } from '@/theme';

/** Editor de una nota segura (`id = 'new'` para una nueva). Todo se guarda cifrado. */
export default function SecureNoteScreen() {
  usePreventCapture();
  const { id } = useLocalSearchParams<{ id: string }>();
  const unlocked = useVaultStore((s) => s.keys !== null);
  const { data: rows } = useLiveQuery(secureNoteQuery(id ?? ''), [id]);
  const [initial, setInitial] = useState<SecureNoteContent | null>(id === 'new' ? empty() : null);

  useEffect(() => {
    if (id === 'new' || initial || !rows[0] || !unlocked) return;
    void decryptSecureNote(rows[0]).then((note) => setInitial(note.content ?? empty()));
  }, [id, rows, initial, unlocked]);

  // Bloqueada (a mano o al volver tras un rato fuera): a la pantalla de desbloqueo.
  if (!unlocked) return <Redirect href="/vault" />;
  if (!initial) return <ActivityIndicator style={styles.loading} />;
  return <SecureNoteEditor noteId={id === 'new' ? null : id} initial={initial} />;
}

const empty = (): SecureNoteContent => ({ title: '', doc: emptyDoc() });

function isEmpty(content: SecureNoteContent) {
  return !content.title.trim() && JSON.stringify(content.doc) === JSON.stringify(emptyDoc());
}

function SecureNoteEditor({
  noteId,
  initial,
}: {
  noteId: string | null;
  initial: SecureNoteContent;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState(initial.title);
  const [doc, setDoc] = useState<EditorDoc>(initial.doc);
  const [format, setFormat] = useState<FormatState>({});
  const editorRef = useRef<EditorHandle>(null);
  /** Id con el que se guarda (una nota nueva lo recibe al guardarse por primera vez). */
  const savedId = useRef(noteId);
  const deleted = useRef(false);
  const [generator, setGenerator] = useState(false);

  const copy = async (text: string) => {
    if (!text.trim()) {
      showSnackbar(t('vault.selectToCopy'));
      return;
    }
    await copySecret(text);
    showSnackbar(t('vault.copied', { seconds: CLIPBOARD_CLEAR_MS / 1000 }));
  };

  const flush = useAutosave({ title, doc }, async (value) => {
    if (deleted.current) return;
    if (!savedId.current && isEmpty(value)) return;
    savedId.current = await saveSecureNote(savedId.current, value);
  });

  const remove = async () => {
    const ok = await confirm({
      title: t('vault.deleteTitle'),
      message: t('vault.deleteMessage'),
      confirmLabel: t('vault.delete'),
      destructive: true,
    });
    if (!ok) return;
    deleted.current = true;
    if (savedId.current) await deleteSecureNote(savedId.current);
    showSnackbar(t('vault.deleted'));
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <IconButton
              icon="trash"
              accessibilityLabel={t('vault.delete')}
              onPress={() => {
                void flush();
                void remove();
              }}
            />
          ),
        }}
      />
      <KeyboardAvoider style={styles.root} offset={insets.top + 44}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t('vault.titlePlaceholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('vault.titlePlaceholder')}
            autoCorrect={false}
            style={[styles.title, typography.title, { color: colors.text, fontFamily: fonts.sans }]}
            testID="secure-note-title"
          />
          <Editor
            ref={editorRef}
            value={doc}
            onChange={setDoc}
            placeholder={t('vault.bodyPlaceholder')}
            autoFocus={!noteId}
            onFormatChange={setFormat}
            onSelectionText={(text) => void copy(text)}
          />
        </ScrollView>
        <View
          style={[
            styles.toolbar,
            { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.xs) },
          ]}>
          <View style={styles.toolbarRow}>
            <IconButton
              icon="copy"
              accessibilityLabel={t('vault.copy')}
              onPress={() => editorRef.current?.requestSelection?.()}
              testID="secure-note-copy"
            />
            <IconButton
              icon="key"
              accessibilityLabel={t('vault.generator')}
              onPress={() => setGenerator(true)}
              testID="secure-note-generator"
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.root}>
              <FormatBar state={format} onFormat={(action) => editorRef.current?.format(action)} />
            </View>
          </View>
        </View>
      </KeyboardAvoider>
      <PasswordGeneratorSheet
        visible={generator}
        onClose={() => setGenerator(false)}
        onCopy={(password) => void copy(password)}
        onInsert={(password) => {
          setGenerator(false);
          // Tras cerrar la hoja: el editor recupera el foco y el cursor donde estaba.
          setTimeout(() => editorRef.current?.insertText?.(password), 350);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  title: { paddingVertical: spacing.xs },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.xs },
  divider: { width: StyleSheet.hairlineWidth, height: 24, marginHorizontal: spacing.xs },
  toolbar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.xs,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },
});
