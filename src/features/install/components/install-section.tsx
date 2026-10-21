import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { radius, spacing, useTheme } from '@/theme';

import { useInstallPrompt } from '../install-prompt';

/** Enlace al instalador de Android (APK de EAS Build). Sin la variable no se muestra. */
const ANDROID_APK_URL = process.env.EXPO_PUBLIC_ANDROID_APK_URL;

/**
 * Ajustes → Descargar la app (solo en web): el APK de Android y la instalación de la web como app
 * de escritorio. Devuelve `null` si no hay nada que ofrecer (p. ej. ya instalada).
 */
export function InstallSection({ wrap }: { wrap: (body: ReactNode) => ReactNode }) {
  const { t } = useTranslation();
  const install = useInstallPrompt();
  const showDesktop = !install.installed;
  if (!ANDROID_APK_URL && !showDesktop) return null;

  return wrap(
    <>
      {ANDROID_APK_URL ? (
        <Row
          icon="download"
          label={t('install.android')}
          hint={t('install.androidHint')}
          onPress={() => void Linking.openURL(ANDROID_APK_URL)}
        />
      ) : null}
      {showDesktop ? (
        install.prompt ? (
          <Row
            icon="addBox"
            label={t('install.desktop')}
            hint={t('install.desktopHint')}
            onPress={() => void install.prompt?.()}
          />
        ) : (
          <View style={styles.row}>
            <Icon name="addBox" size={20} />
            <View style={styles.label}>
              <Text>{t('install.desktop')}</Text>
              <Text variant="caption" tone="secondary">
                {t('install.desktopManual')}
              </Text>
            </View>
          </View>
        )
      ) : null}
    </>,
  );
}

function Row({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfacePressed }]}>
      <Icon name={icon} size={20} color={colors.textSecondary} />
      <View style={styles.label}>
        <Text>{label}</Text>
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    minHeight: 48,
  },
  label: { flex: 1, gap: spacing.xxs },
});
