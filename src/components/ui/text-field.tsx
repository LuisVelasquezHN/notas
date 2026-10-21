import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { fonts, radius, spacing, typography, useTheme } from '@/theme';

/** Campo de texto con el estilo de la app (formularios: nombre de carpeta, búsqueda…). */
export function TextField({ style, ...rest }: TextInputProps) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textMuted}
      selectionColor={colors.primary}
      style={[
        styles.base,
        typography.body,
        {
          fontFamily: fonts.sans,
          color: colors.text,
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
