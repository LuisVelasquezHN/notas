import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

import type { FormatCommand, FormatState } from '../format';

type FormatButton = { command: FormatCommand } & ({ icon: IconName } | { text: string });

const BUTTONS: FormatButton[] = [
  { command: 'heading1', text: 'H1' },
  { command: 'heading2', text: 'H2' },
  { command: 'bold', icon: 'bold' },
  { command: 'italic', icon: 'italic' },
  { command: 'underline', icon: 'underline' },
  { command: 'strike', icon: 'strike' },
  { command: 'bulletList', icon: 'listBullet' },
  { command: 'orderedList', icon: 'listNumber' },
  { command: 'taskList', icon: 'checklist' },
  { command: 'blockquote', icon: 'quote' },
  { command: 'code', icon: 'code' },
  { command: 'clear', icon: 'formatClear' },
];

type FormatBarProps = {
  state: FormatState;
  onFormat: (command: FormatCommand) => void;
};

/** Botones de formato del editor enriquecido; resalta los formatos activos en la selección. */
export function FormatBar({ state, onFormat }: FormatBarProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={styles.row}>
      {BUTTONS.map((button) => {
        const active = button.command !== 'clear' && !!state[button.command];
        const color = active ? colors.onPrimary : colors.text;
        return (
          <Pressable
            key={button.command}
            accessibilityRole="button"
            accessibilityLabel={t(`format.${button.command}`)}
            aria-selected={button.command === 'clear' ? undefined : active}
            onPress={() => onFormat(button.command)}
            style={({ pressed }) => [
              styles.button,
              active && { backgroundColor: colors.primary },
              pressed && !active && { backgroundColor: colors.surfacePressed },
            ]}>
            {'icon' in button ? (
              <Icon name={button.icon} size={20} color={color} />
            ) : (
              <Text variant="bodyStrong" style={{ color }}>
                {button.text}
              </Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingHorizontal: spacing.sm, alignItems: 'center' },
  button: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
