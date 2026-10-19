import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

import type { FormatCommand, FormatState } from '../format';

type FormatButton = {
  command: FormatCommand;
  label: string;
} & ({ icon: IconName } | { text: string });

const BUTTONS: FormatButton[] = [
  { command: 'heading1', label: 'Título', text: 'H1' },
  { command: 'heading2', label: 'Subtítulo', text: 'H2' },
  { command: 'bold', label: 'Negrita', icon: 'bold' },
  { command: 'italic', label: 'Cursiva', icon: 'italic' },
  { command: 'underline', label: 'Subrayado', icon: 'underline' },
  { command: 'strike', label: 'Tachado', icon: 'strike' },
  { command: 'bulletList', label: 'Lista con viñetas', icon: 'listBullet' },
  { command: 'orderedList', label: 'Lista numerada', icon: 'listNumber' },
  { command: 'taskList', label: 'Casillas', icon: 'checklist' },
  { command: 'blockquote', label: 'Cita', icon: 'quote' },
  { command: 'code', label: 'Código', icon: 'code' },
  { command: 'clear', label: 'Quitar formato', icon: 'formatClear' },
];

type FormatBarProps = {
  state: FormatState;
  onFormat: (command: FormatCommand) => void;
};

/** Botones de formato del editor enriquecido; resalta los formatos activos en la selección. */
export function FormatBar({ state, onFormat }: FormatBarProps) {
  const { colors } = useTheme();
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
            accessibilityLabel={button.label}
            accessibilityState={button.command === 'clear' ? undefined : { selected: active }}
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
