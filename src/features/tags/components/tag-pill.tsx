import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import type { Tag } from '@/db/schema';
import { radius, spacing, useTheme } from '@/theme';

/** Etiqueta compacta (tarjetas de nota y editor). */
export function TagPill({
  tag,
  onCard = false,
}: {
  tag: Pick<Tag, 'name' | 'color'>;
  onCard?: boolean;
}) {
  const { colors, noteColor } = useTheme();
  // Sobre una tarjeta de color, un fondo translúcido se ve mejor que el color de la etiqueta.
  const backgroundColor =
    tag.color === 'default'
      ? onCard
        ? 'rgba(127,127,127,0.14)'
        : colors.surfaceMuted
      : noteColor(tag.color);
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor, borderColor: onCard ? 'rgba(127,127,127,0.25)' : colors.border },
      ]}>
      <Icon name="tag" size={11} color={colors.textSecondary} />
      <Text variant="caption" tone="secondary" numberOfLines={1} style={styles.label}>
        {tag.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 160,
  },
  label: { flexShrink: 1 },
});
