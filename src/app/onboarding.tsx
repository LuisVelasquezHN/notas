import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, Icon, Text, type IconName } from '@/components/ui';
import { useNotificationPermission } from '@/features/reminders/hooks/use-notification-permission';
import { LANGUAGES, LANGUAGE_NAMES, type LanguagePreference } from '@/i18n';
import { capabilities } from '@/lib/capabilities';
import { useSettingsStore } from '@/stores/settings-store';
import { MAX_CONTENT_WIDTH, radius, spacing, useTheme } from '@/theme';

type Page = { key: 'welcome' | 'organize' | 'remember'; icon: IconName };

const PAGES: Page[] = [
  { key: 'welcome', icon: 'note' },
  { key: 'organize', icon: 'folder' },
  { key: 'remember', icon: 'bell' },
];

/**
 * Presentación del primer arranque (también desde Ajustes → "Ver la presentación"). Tres páginas
 * que se pasan deslizando o con los botones; al terminar, `onboarded` y el layout raíz lleva a
 * las notas (rutas protegidas).
 */
export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);
  const last = page === PAGES.length - 1;

  const goTo = (index: number) => {
    setPage(index);
    scrollRef.current?.scrollTo({ x: index * width, animated: !reduceMotion });
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    if (index !== page) setPage(index);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        {!last ? (
          <Button title={t('onboarding.skip')} variant="ghost" onPress={() => setOnboarded(true)} />
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        onScroll={process.env.EXPO_OS === 'web' ? onScroll : undefined}
        scrollEventThrottle={64}
        style={styles.pages}>
        {PAGES.map((item, index) => (
          <View
            key={item.key}
            style={[styles.page, { width }]}
            // Solo la página visible es accesible (las demás quedan fuera de la pantalla).
            importantForAccessibility={index === page ? 'auto' : 'no-hide-descendants'}
            accessibilityElementsHidden={index !== page}>
            <View style={styles.pageInner}>
              <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
                <Icon name={item.icon} size={44} color={colors.primary} />
              </View>
              <Text variant="title" style={styles.center}>
                {t(`onboarding.${item.key}.title`)}
              </Text>
              <Text tone="secondary" style={styles.center}>
                {t(`onboarding.${item.key}.body`)}
              </Text>
              {item.key === 'welcome' ? <LanguagePicker /> : null}
              {item.key === 'remember' ? <NotificationsPrompt /> : null}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={t('onboarding.pageOf', { page: page + 1, total: PAGES.length })}>
          {PAGES.map((item, index) => (
            <View
              key={item.key}
              style={[
                styles.dot,
                { backgroundColor: index === page ? colors.primary : colors.border },
              ]}
            />
          ))}
        </View>
        <Button
          title={last ? t('onboarding.start') : t('onboarding.next')}
          onPress={() => (last ? setOnboarded(true) : goTo(page + 1))}
          style={styles.next}
        />
      </View>
    </SafeAreaView>
  );
}

function LanguagePicker() {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const options: LanguagePreference[] = ['system', ...LANGUAGES];
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('settings.language')}
      style={styles.chips}>
      {options.map((option) => (
        <Chip
          key={option}
          icon={option === 'system' ? 'language' : undefined}
          label={option === 'system' ? t('settings.languageSystem') : LANGUAGE_NAMES[option]}
          selected={language === option}
          onPress={() => setLanguage(option)}
        />
      ))}
    </View>
  );
}

function NotificationsPrompt() {
  const { t } = useTranslation();
  const permission = useNotificationPermission();
  if (!capabilities.localNotifications) {
    return (
      <Text variant="caption" tone="muted" style={styles.center}>
        {t('reminders.webHint')}
      </Text>
    );
  }
  if (permission.state === 'granted') {
    return (
      <View style={styles.granted}>
        <Icon name="check" size={18} />
        <Text tone="secondary">{t('onboarding.notificationsOn')}</Text>
      </View>
    );
  }
  return (
    <Button
      title={t('onboarding.enableNotifications')}
      icon="bell"
      variant="secondary"
      onPress={() => void permission.request()}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { minHeight: 52, alignItems: 'flex-end', paddingHorizontal: spacing.md },
  pages: { flex: 1 },
  page: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  pageInner: { width: '100%', maxWidth: 440, alignItems: 'center', gap: spacing.lg },
  badge: {
    width: 104,
    height: 104,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  center: { textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  granted: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bottom: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  next: { alignSelf: 'stretch' },
});
