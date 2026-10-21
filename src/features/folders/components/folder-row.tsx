import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text, isIconName, type IconName } from '@/components/ui';
import type { NoteColor } from '@/theme';
import { radius, spacing, useTheme } from '@/theme';

type FolderRowProps = {
  name: string;
  icon: string | null;
  color: NoteColor;
  count?: number;
  depth?: number;
  onPress: () => void;
  onLongPress?: () => void;
};

export function FolderIcon({
  icon,
  color,
  size = 36,
}: {
  icon: string | null;
  color: NoteColor;
  size?: number;
}) {
  const { noteColor, colors } = useTheme();
  const name: IconName = isIconName(icon) ? icon : 'folder';
  return (
    <View
      style={[
        styles.icon,
        {
          width: size,
          height: size,
          backgroundColor: color === 'default' ? colors.surfaceMuted : noteColor(color),
        },
      ]}>
      <Icon name={name} size={size * 0.5} color={colors.text} />
    </View>
  );
}

export function FolderRow({
  name,
  icon,
  color,
  count,
  depth = 1,
  onPress,
  onLongPress,
}: FolderRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? name : `${name}, ${count} notas`}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.row,
        { paddingLeft: spacing.md + (depth - 1) * spacing.xl },
        pressed && { backgroundColor: colors.surfacePressed },
      ]}>
      <FolderIcon icon={icon} color={color} />
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      {count !== undefined && count > 0 ? (
        <Text variant="caption" tone="muted">
          {count}
        </Text>
      ) : null}
      <Icon name="chevronRight" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minHeight: 52,
  },
  icon: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1 },
});
