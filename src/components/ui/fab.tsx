import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';

type FabProps = {
  icon?: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  /** Espacio extra para no quedar bajo la tab bar. */
  bottomOffset?: number;
};

export function Fab({ icon = 'add', accessibilityLabel, onPress, bottomOffset = 0 }: FabProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colors.primary,
          bottom: insets.bottom + spacing.lg + bottomOffset,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
      ]}>
      <Icon name={icon} size={26} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    position: 'absolute',
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
