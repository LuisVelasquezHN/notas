import { Pressable, StyleSheet, type PressableProps } from 'react-native';

import { radius, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';

type IconButtonProps = Omit<PressableProps, 'children'> & {
  icon: IconName;
  /** Obligatorio: es lo único que leerá el lector de pantalla. */
  accessibilityLabel: string;
  size?: number;
  color?: string;
};

export function IconButton({ icon, size = 22, color, style, ...rest }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      style={(state) => [
        styles.base,
        state.pressed && { backgroundColor: colors.surfacePressed },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}>
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
