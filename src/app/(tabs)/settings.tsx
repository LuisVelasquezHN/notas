import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip, Icon, Screen, Text, type IconName } from '@/components/ui';
import { useSettingsStore, type ThemePreference } from '@/stores/settings-store';
import { radius, spacing, useTheme } from '@/theme';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

export default function SettingsScreen() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  return (
    <Screen scroll>
      <Text variant="largeTitle" style={styles.title}>
        Ajustes
      </Text>

      <Section title="Apariencia">
        <View style={styles.chips}>
          {THEME_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={theme === option.value}
              onPress={() => setTheme(option.value)}
            />
          ))}
        </View>
      </Section>

      <Section title="Notas">
        <LinkRow href="/archive" icon="archive" label="Archivo" />
        <LinkRow href="/trash" icon="trash" label="Papelera" />
      </Section>

      <Text variant="caption" tone="muted" style={styles.version}>
        Versión {Constants.expoConfig?.version ?? '—'}
      </Text>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="label" tone="secondary">
        {title.toUpperCase()}
      </Text>
      <View style={[styles.sectionBody, { backgroundColor: colors.surface }]}>{children}</View>
    </View>
  );
}

function LinkRow({ href, icon, label }: { href: Href; icon: IconName; label: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}>
      <Icon name={icon} size={20} color={colors.textSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Icon name="chevronRight" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { paddingVertical: spacing.md },
  section: { gap: spacing.sm, marginBottom: spacing.xl },
  sectionBody: { borderRadius: radius.lg, padding: spacing.sm, gap: spacing.xs },
  chips: { flexDirection: 'row', gap: spacing.sm, padding: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  rowLabel: { flex: 1 },
  version: { textAlign: 'center', marginTop: spacing.lg },
});
