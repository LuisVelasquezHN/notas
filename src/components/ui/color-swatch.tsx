import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { radius, useTheme, type NoteColor } from '@/theme';

import { Icon } from './icon';

type ColorSwatchProps = {
  color: NoteColor;
  selected?: boolean;
  size?: number;
  onPress?: () => void;
};

export function ColorSwatch({ color, selected = false, size = 36, onPress }: ColorSwatchProps) {
  const { colors, noteColor } = useTheme();
  const { t } = useTranslation();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={t(`colors.${color}`)}
      aria-selected={selected}
      onPress={onPress}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          backgroundColor: noteColor(color),
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
        },
      ]}>
      {selected ? <Icon name="check" size={size * 0.5} color={colors.text} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
