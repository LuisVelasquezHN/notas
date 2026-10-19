import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { fonts, typography, useTheme, type TypographyVariant } from '@/theme';

type Tone = 'default' | 'secondary' | 'muted' | 'primary' | 'danger';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  tone?: Tone;
};

export function Text({ variant = 'body', tone = 'default', style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const color = {
    default: colors.text,
    secondary: colors.textSecondary,
    muted: colors.textMuted,
    primary: colors.primary,
    danger: colors.danger,
  }[tone];

  return (
    <RNText style={[{ fontFamily: fonts.sans, color }, typography[variant], style]} {...rest} />
  );
}
