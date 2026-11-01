import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Sheet, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

import { EDITOR_SHORTCUTS, GENERAL_SHORTCUTS, keyLabel } from '../shortcuts';

/** Lista de atajos de teclado. */
export function ShortcutsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const shift = t('shortcuts.shift');

  const row = (keys: readonly string[], label: string) => (
    <View key={label} style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.keys}>
        {keys.map((key) => (
          <View
            key={key}
            style={[
              styles.key,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            ]}>
            <Text variant="label">{keyLabel(key, shift)}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title={t('shortcuts.title')}>
      <View style={styles.body}>
        <Text variant="label" tone="secondary">
          {t('shortcuts.general').toUpperCase()}
        </Text>
        {GENERAL_SHORTCUTS.map((s) => row(s.keys, t(`shortcuts.actions.${s.label}`)))}
        <Text variant="label" tone="secondary" style={styles.section}>
          {t('shortcuts.editor').toUpperCase()}
        </Text>
        {EDITOR_SHORTCUTS.map((s) => row(s.keys, t(`shortcuts.actions.${s.label}`)))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs },
  section: { marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 36 },
  label: { flex: 1 },
  keys: { flexDirection: 'row', gap: spacing.xxs },
  key: {
    minWidth: 28,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
});
