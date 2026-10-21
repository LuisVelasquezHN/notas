import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { CONTACT_EMAIL, PRIVACY_POLICY_DATE } from '@/lib/app-info';
import { currentLocale } from '@/i18n';
import { spacing } from '@/theme';

const SECTIONS = [
  'notes',
  'permissions',
  'crashReports',
  'files',
  'web',
  'sharing',
  'children',
  'changes',
  'contact',
] as const;

/**
 * Política de privacidad. Es pública (fuera de las rutas protegidas): en la web, `/privacy` es la
 * URL que enlazan las fichas de las tiendas.
 */
export default function PrivacyScreen() {
  const { t } = useTranslation();
  const date = new Date(`${PRIVACY_POLICY_DATE}T12:00:00`).toLocaleDateString(currentLocale(), {
    dateStyle: 'long',
  });

  return (
    <Screen scroll edges={[]} contentStyle={styles.content}>
      <Text tone="secondary">{t('privacy.intro')}</Text>
      {SECTIONS.map((section) => (
        <View key={section} style={styles.section}>
          <Text variant="heading">{t(`privacy.sections.${section}.title`)}</Text>
          <Text>{t(`privacy.sections.${section}.body`)}</Text>
          {section === 'contact' ? (
            <Text
              accessibilityRole="link"
              tone="primary"
              onPress={() => void Linking.openURL(`mailto:${CONTACT_EMAIL}`)}>
              {CONTACT_EMAIL}
            </Text>
          ) : null}
        </View>
      ))}
      <Text variant="caption" tone="muted">
        {t('privacy.updated', { date })}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingVertical: spacing.lg },
  section: { gap: spacing.xs },
});
