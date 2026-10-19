import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

type EmptyStateProps = {
  icon: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
        <Icon name={icon} size={32} color={colors.textSecondary} />
      </View>
      <Text variant="heading" style={styles.center}>
        {title}
      </Text>
      {description ? (
        <Text tone="secondary" style={styles.center}>
          {description}
        </Text>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center', maxWidth: 320 },
  action: { marginTop: spacing.md },
});
