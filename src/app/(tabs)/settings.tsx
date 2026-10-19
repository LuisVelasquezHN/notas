import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Chip, Icon, Screen, Text, type IconName } from '@/components/ui';
import { useNotificationPermission } from '@/features/reminders/hooks/use-notification-permission';
import { capabilities } from '@/lib/capabilities';
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

      <Section title="Recordatorios">
        <NotificationsRow />
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

const PERMISSION_LABELS = {
  granted: 'Activadas',
  denied: 'Desactivadas en los ajustes del sistema',
  undetermined: 'Sin activar',
  unavailable: 'No disponibles en la web: los avisos aparecen con la app abierta',
} as const;

function NotificationsRow() {
  const permission = useNotificationPermission();
  const state = permission.state;
  return (
    <>
      <View style={styles.row}>
        <Icon name="bell" size={20} />
        <View style={styles.rowLabel}>
          <Text>Notificaciones</Text>
          {state ? (
            <Text variant="caption" tone="secondary">
              {PERMISSION_LABELS[state]}
            </Text>
          ) : null}
        </View>
        {capabilities.localNotifications && (state === 'denied' || state === 'undetermined') ? (
          <Button
            title={state === 'denied' ? 'Ajustes' : 'Activar'}
            variant="secondary"
            onPress={() => void permission.request()}
          />
        ) : null}
      </View>
      {state === 'granted' && !permission.exactAlarms ? (
        <View style={styles.row}>
          <Icon name="clock" size={20} />
          <View style={styles.rowLabel}>
            <Text>Alarmas exactas</Text>
            <Text variant="caption" tone="secondary">
              Sin ellas, los avisos pueden llegar con retraso
            </Text>
          </View>
          <Button
            title="Permitir"
            variant="secondary"
            onPress={() => void permission.requestExactAlarms()}
          />
        </View>
      ) : null}
    </>
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
