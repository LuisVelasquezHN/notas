import { useMemo } from 'react';
import { Text as RNText } from 'react-native';

import { Text, type TextProps } from '@/components/ui';
import { STYLE_VALUES } from '@/features/editor/format';
import { useTheme } from '@/theme';

import { highlightSegments } from '../highlight';

type HighlightedTextProps = TextProps & {
  children: string;
  /** Palabras buscadas; sin ninguna, es un `Text` normal. */
  terms?: string[];
};

/** Texto con las palabras buscadas resaltadas (como un rotulador amarillo). */
export function HighlightedText({ children, terms, ...rest }: HighlightedTextProps) {
  const { scheme, colors } = useTheme();
  const segments = useMemo(
    () => (terms?.length ? highlightSegments(children, terms) : null),
    [children, terms],
  );
  if (!segments) return <Text {...rest}>{children}</Text>;
  const mark = { backgroundColor: STYLE_VALUES.highlight[scheme].yellow, color: colors.text };
  return (
    <Text {...rest}>
      {segments.map((s, i) =>
        s.match ? (
          <RNText key={i} style={mark}>
            {s.text}
          </RNText>
        ) : (
          s.text
        ),
      )}
    </Text>
  );
}
