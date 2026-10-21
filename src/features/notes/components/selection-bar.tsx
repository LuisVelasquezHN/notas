import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Text } from '@/components/ui';
import type { Note } from '@/db/schema';
import { radius, spacing, useTheme } from '@/theme';

import * as actions from '../actions';

type SelectionBarProps = {
  selected: Note[];
  /** Total de notas visibles (para "seleccionar todo"). */
  total: number;
  onSelectAll: () => void;
  onClear: () => void;
  onMore: () => void;
};

/** Barra flotante del modo selección múltiple, con las acciones en lote más habituales. */
export function SelectionBar({ selected, total, onSelectAll, onClear, onMore }: SelectionBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const inTrash = selected.every((n) => n.deletedAt !== null);
  const allPinned = selected.every((n) => n.isPinned);
  const allArchived = selected.every((n) => n.isArchived);

  const runAndClear = (fn: () => Promise<unknown>) => () => {
    onClear();
    void fn();
  };

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          bottom: insets.bottom + spacing.lg,
        },
      ]}>
      <IconButton icon="close" accessibilityLabel={t('selection.cancel')} onPress={onClear} />
      <Text variant="bodyStrong" style={styles.count} numberOfLines={1}>
        {selected.length}
      </Text>
      <IconButton
        icon="selectAll"
        accessibilityLabel={
          selected.length === total ? t('selection.deselectAll') : t('selection.selectAll')
        }
        onPress={onSelectAll}
      />
      <View style={styles.spacer} />
      {inTrash ? (
        <IconButton
          icon="restore"
          accessibilityLabel={t('common.restore')}
          onPress={runAndClear(() => actions.restore(selected))}
        />
      ) : (
        <>
          <IconButton
            icon={allPinned ? 'pinFill' : 'pin'}
            accessibilityLabel={allPinned ? t('noteActions.unpin') : t('noteActions.pin')}
            onPress={runAndClear(() => actions.togglePin(selected))}
          />
          <IconButton
            icon={allArchived ? 'unarchive' : 'archive'}
            accessibilityLabel={allArchived ? t('noteActions.unarchive') : t('noteActions.archive')}
            onPress={runAndClear(() =>
              allArchived
                ? actions.unarchive(selected)
                : actions.archive(selected.filter((n) => !n.isArchived)),
            )}
          />
          <IconButton
            icon="trash"
            accessibilityLabel={t('noteActions.trash')}
            onPress={runAndClear(() => actions.trash(selected))}
          />
        </>
      )}
      <IconButton icon="more" accessibilityLabel={t('common.moreActions')} onPress={onMore} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    maxWidth: 560,
    marginHorizontal: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  count: { minWidth: 24 },
  spacer: { flex: 1 },
});
