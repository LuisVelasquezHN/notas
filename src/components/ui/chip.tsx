import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

type ChipProps = Omit<PressableProps, 'children'> & {
  label: string;
  selected?: boolean;
  icon?: IconName;
};

export function Chip({ label, selected = false, icon, style, ...rest }: ChipProps) {
  const { colors } = useTheme();
  const fg = selected ? colors.onPrimary : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={selected}
      // 32 pt de alto: el área táctil llega a 44 pt.
      hitSlop={{ top: 6, bottom: 6 }}
      style={(state) => [
        styles.base,
        {
          backgroundColor: selected ? colors.primary : colors.surfaceMuted,
          borderColor: selected ? colors.primary : colors.border,
          opacity: state.pressed ? 0.8 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text variant="label" style={{ color: fg }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
