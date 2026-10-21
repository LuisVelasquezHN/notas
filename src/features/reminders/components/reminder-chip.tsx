import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

import { formatReminder } from '../format';

type ReminderChipProps = {
  fireAt: number;
  recurring?: boolean;
  now: number;
  /** En tarjetas: más pequeño y sobre el color de la nota. */
  compact?: boolean;
  onPress?: () => void;
};

/** Fecha de un recordatorio con campana; en rojo si está vencido. */
export function ReminderChip({ fireAt, recurring, now, compact, onPress }: ReminderChipProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const overdue = fireAt <= now;
  const color = overdue ? colors.danger : colors.textSecondary;
  const label = formatReminder(fireAt, now, t);
  const content = (
    <View
      style={[
        styles.chip,
        compact && styles.compact,
        { borderColor: overdue ? colors.danger : colors.border },
      ]}>
      <Icon name={overdue ? 'bellFill' : 'bell'} size={compact ? 12 : 14} color={color} />
      <Text variant="caption" style={{ color }} numberOfLines={1}>
        {label}
      </Text>
      {recurring ? <Icon name="repeat" size={compact ? 11 : 13} color={color} /> : null}
    </View>
  );
  const a11y = [
    overdue ? t('reminders.chipOverdue', { when: label }) : t('reminders.chip', { when: label }),
    recurring ? t('reminders.chipRepeats') : null,
  ]
    .filter(Boolean)
    .join(', ');
  if (!onPress) {
    return (
      <View accessible accessibilityLabel={a11y} style={styles.wrap}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint={t('reminders.chipHint')}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.6 }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 1,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  compact: { paddingHorizontal: spacing.xs + 2, paddingVertical: 1 },
});
