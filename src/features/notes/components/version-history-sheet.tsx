import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Sheet, Text, afterSheetClose } from '@/components/ui';
import { docToText, parseDoc } from '@/features/editor/doc';
import { currentLocale } from '@/i18n';
import { confirm } from '@/lib/confirm';
import { showSnackbar } from '@/stores/snackbar-store';
import { spacing, useTheme } from '@/theme';

import { noteVersionsQuery, restoreVersion } from '../versions';

type VersionHistorySheetProps = {
  noteId: string;
  visible: boolean;
  onClose: () => void;
  /** Tras restaurar, con la fecha de la nota restaurada (la pantalla vuelve a cargarla). */
  onRestored: (updatedAt: number) => void;
  /** Guarda lo pendiente antes de restaurar. */
  flush: () => Promise<void>;
};

const formatWhen = (timestamp: number) =>
  new Date(timestamp).toLocaleString(currentLocale(), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Versiones anteriores de una nota de texto; tocar una la restaura (con confirmación). */
export function VersionHistorySheet({
  noteId,
  visible,
  onClose,
  onRestored,
  flush,
}: VersionHistorySheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data } = useLiveQuery(noteVersionsQuery(noteId), [noteId]);
  const versions = useMemo(
    () =>
      data.map((v) => ({
        ...v,
        preview: docToText(parseDoc(v.contentJson)).trim().replace(/\n+/g, ' · '),
      })),
    [data],
  );

  const restore = (id: string, when: string) => {
    onClose();
    afterSheetClose(async () => {
      const ok = await confirm({
        title: t('versions.restoreTitle'),
        message: t('versions.restoreMessage', { when }),
        confirmLabel: t('versions.restore'),
      });
      if (!ok) return;
      await flush();
      const restored = await restoreVersion(id);
      if (restored) {
        onRestored(restored.updatedAt);
        showSnackbar(t('versions.restored'));
      }
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('versions.title')}>
      <Text variant="caption" tone="secondary" style={styles.hint}>
        {t('versions.hint')}
      </Text>
      {versions.length === 0 ? (
        <Text tone="muted" style={styles.empty}>
          {t('versions.empty')}
        </Text>
      ) : (
        versions.map((version) => {
          const when = formatWhen(version.createdAt);
          return (
            <Pressable
              key={version.id}
              accessibilityRole="button"
              accessibilityLabel={t('versions.a11yVersion', { when })}
              onPress={() => restore(version.id, when)}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: colors.surfaceMuted },
              ]}>
              <Icon name="clock" size={20} color={colors.textSecondary} />
              <View style={styles.body}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {when}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={2}>
                  {[version.title.trim(), version.preview].filter(Boolean).join(' — ') ||
                    t('card.empty')}
                </Text>
              </View>
              <Icon name="restore" size={20} color={colors.textMuted} />
            </Pressable>
          );
        })
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  empty: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  body: { flex: 1, gap: 2 },
});
