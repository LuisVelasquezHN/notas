import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppLogo, Button, Chip, Icon, Screen, Text, type IconName } from '@/components/ui';
import { exportBackup, importBackupFromFile } from '@/features/backup/actions';
import { InstallSection } from '@/features/install/components/install-section';
import { useNotificationPermission } from '@/features/reminders/hooks/use-notification-permission';
import { confirmIdentity } from '@/features/security/actions';
import { authenticate, getAuthSupport, type BiometryKind } from '@/features/security/auth';
import { AccountSection } from '@/features/sync/components/account-section';
import { isSyncConfigured } from '@/features/sync/supabase';
import { LANGUAGES, LANGUAGE_NAMES, type LanguagePreference } from '@/i18n';
import { APP_NAME, AUTHOR_NAME, AUTHOR_URL } from '@/lib/app-info';
import { capabilities } from '@/lib/capabilities';
import { useSettingsStore, type LockAfter, type ThemePreference } from '@/stores/settings-store';
import { ACCENTS, ACCENT_NAMES, radius, spacing, useTheme, type EditorTextSize } from '@/theme';

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];
const LOCK_AFTER_OPTIONS: LockAfter[] = ['immediately', 'oneMinute', 'fiveMinutes'];
const TEXT_SIZE_OPTIONS: EditorTextSize[] = ['small', 'normal', 'large', 'xlarge'];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const editorTextSize = useSettingsStore((s) => s.editorTextSize);
  const setEditorTextSize = useSettingsStore((s) => s.setEditorTextSize);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setOnboarded = useSettingsStore((s) => s.setOnboarded);
  const languageOptions: LanguagePreference[] = ['system', ...LANGUAGES];

  return (
    <Screen scroll>
      <Text variant="largeTitle" style={styles.title}>
        {t('settings.title')}
      </Text>

      {isSyncConfigured ? (
        <Section title={t('account.title')}>
          <AccountSection />
        </Section>
      ) : null}

      {Platform.OS === 'web' ? (
        <InstallSection wrap={(body) => <Section title={t('install.title')}>{body}</Section>} />
      ) : null}

      <Section title={t('settings.appearance')}>
        <ChipGroup label={t('settings.appearance')}>
          {THEME_OPTIONS.map((option) => (
            <Chip
              key={option}
              label={t(`settings.theme.${option}`)}
              selected={theme === option}
              onPress={() => setTheme(option)}
            />
          ))}
        </ChipGroup>
        <AccentPicker />
        <View style={styles.subRow}>
          <Text variant="caption" tone="secondary">
            {t('settings.editorTextSize')}
          </Text>
          <ChipGroup label={t('settings.editorTextSize')}>
            {TEXT_SIZE_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={t(`settings.textSizes.${option}`)}
                selected={editorTextSize === option}
                onPress={() => setEditorTextSize(option)}
              />
            ))}
          </ChipGroup>
        </View>
      </Section>

      <Section title={t('settings.language')}>
        <ChipGroup label={t('settings.language')}>
          {languageOptions.map((option) => (
            <Chip
              key={option}
              label={option === 'system' ? t('settings.languageSystem') : LANGUAGE_NAMES[option]}
              selected={language === option}
              onPress={() => setLanguage(option)}
            />
          ))}
        </ChipGroup>
      </Section>

      {capabilities.biometrics ? (
        <Section title={t('settings.security')}>
          <AppLockRows />
        </Section>
      ) : null}

      <Section title={t('settings.reminders')}>
        <NotificationsRow />
      </Section>

      <Section title={t('settings.data')}>
        <ActionRow
          icon="backup"
          label={t('backup.export')}
          hint={t('backup.exportHint')}
          onPress={() => void exportBackup()}
        />
        <ActionRow
          icon="importFile"
          label={t('backup.import')}
          hint={t('backup.importHint')}
          onPress={() => void importBackupFromFile()}
        />
      </Section>

      <Section title={t('settings.privacy')}>
        <CrashReportsRow />
        <LinkRow href="/privacy" icon="shield" label={t('settings.privacyPolicy')} />
      </Section>

      <Section title={t('settings.notes')}>
        <LinkRow href="/archive" icon="archive" label={t('screens.archive')} />
        <LinkRow href="/trash" icon="trash" label={t('screens.trash')} />
      </Section>

      <Section title={t('settings.help')}>
        <ActionRow
          icon="sparkles"
          label={t('settings.showOnboarding')}
          onPress={() => setOnboarded(false)}
        />
      </Section>

      <View style={styles.footer}>
        <AppLogo size={40} />
        <Text variant="caption" tone="muted">
          {APP_NAME} · {t('settings.version', { version: Constants.expoConfig?.version ?? '—' })}
        </Text>
        <Text
          variant="caption"
          tone="primary"
          accessibilityRole="link"
          onPress={() => void Linking.openURL(AUTHOR_URL)}>
          {t('settings.madeBy', { name: AUTHOR_NAME })}
        </Text>
        <Text variant="caption" tone="muted">
          {t('settings.copyright', { year: new Date().getFullYear(), name: AUTHOR_NAME })}
        </Text>
      </View>
    </Screen>
  );
}

/** Color de acento: botones, selección, cursor, pestañas. */
function AccentPicker() {
  const { t } = useTranslation();
  const { scheme, colors } = useTheme();
  const accent = useSettingsStore((s) => s.accent);
  const setAccent = useSettingsStore((s) => s.setAccent);
  return (
    <View style={styles.subRow}>
      <Text variant="caption" tone="secondary">
        {t('settings.accent')}
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('settings.accent')}
        style={styles.chips}>
        {ACCENT_NAMES.map((name) => {
          const selected = accent === name;
          const color = scheme === 'dark' ? ACCENTS[name].dark : ACCENTS[name].light;
          return (
            <Pressable
              key={name}
              accessibilityRole="radio"
              accessibilityLabel={t(`settings.accents.${name}`)}
              aria-checked={selected}
              onPress={() => setAccent(name)}
              style={[
                styles.accent,
                { backgroundColor: color, borderColor: selected ? colors.text : 'transparent' },
              ]}>
              {selected ? (
                <Icon
                  name="check"
                  size={16}
                  color={scheme === 'dark' ? ACCENTS[name].onDark : ACCENTS[name].onLight}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="label" tone="secondary" accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      <View style={[styles.sectionBody, { backgroundColor: colors.surface }]}>{children}</View>
    </View>
  );
}

/** Opciones excluyentes: los lectores de pantalla las anuncian como un grupo de radio. */
function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.chips}>
      {children}
    </View>
  );
}

function AppLockRows() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const appLock = useSettingsStore((s) => s.appLock);
  const setAppLock = useSettingsStore((s) => s.setAppLock);
  const lockAfter = useSettingsStore((s) => s.lockAfter);
  const setLockAfter = useSettingsStore((s) => s.setLockAfter);
  const [biometry, setBiometry] = useState<BiometryKind>(null);

  useEffect(() => {
    void getAuthSupport().then((support) => setBiometry(support.biometry));
  }, []);

  const toggle = async (enabled: boolean) => {
    // Activarlo comprueba que el desbloqueo funciona; desactivarlo también pide verificación.
    const ok = enabled
      ? await confirmIdentity(t('lock.enableAppLockReason'))
      : await authenticate(t('lock.disableAppLockReason'));
    if (ok) setAppLock(enabled);
  };

  return (
    <>
      <View style={styles.row}>
        <Icon name={biometry === 'face' ? 'faceId' : biometry ? 'fingerprint' : 'lock'} size={20} />
        <View style={styles.rowLabel}>
          <Text>{t('settings.appLock')}</Text>
          <Text variant="caption" tone="secondary">
            {t(`settings.appLockHint.${biometry ?? 'passcode'}`)}
          </Text>
        </View>
        <Switch
          value={appLock}
          onValueChange={(value) => void toggle(value)}
          accessibilityLabel={t('settings.appLock')}
          trackColor={{ true: colors.primary }}
        />
      </View>
      {appLock ? (
        <View style={styles.subRow}>
          <Text variant="caption" tone="secondary">
            {t('settings.lockAfter')}
          </Text>
          <ChipGroup label={t('settings.lockAfter')}>
            {LOCK_AFTER_OPTIONS.map((option) => (
              <Chip
                key={option}
                label={t(`settings.lockAfterOptions.${option}`)}
                selected={lockAfter === option}
                onPress={() => setLockAfter(option)}
              />
            ))}
          </ChipGroup>
        </View>
      ) : null}
      <Text variant="caption" tone="muted" style={styles.note}>
        {t('settings.noteLockHint')}
      </Text>
    </>
  );
}

function NotificationsRow() {
  const { t } = useTranslation();
  const permission = useNotificationPermission();
  const state = permission.state;
  return (
    <>
      <View style={styles.row}>
        <Icon name="bell" size={20} />
        <View style={styles.rowLabel}>
          <Text>{t('settings.notifications')}</Text>
          {state ? (
            <Text variant="caption" tone="secondary">
              {t(`settings.permission.${state}`)}
            </Text>
          ) : null}
        </View>
        {capabilities.localNotifications && (state === 'denied' || state === 'undetermined') ? (
          <Button
            title={state === 'denied' ? t('common.settings') : t('common.enable')}
            variant="secondary"
            onPress={() => void permission.request()}
          />
        ) : null}
      </View>
      {state === 'granted' && !permission.exactAlarms ? (
        <View style={styles.row}>
          <Icon name="clock" size={20} />
          <View style={styles.rowLabel}>
            <Text>{t('settings.exactAlarms')}</Text>
            <Text variant="caption" tone="secondary">
              {t('settings.exactAlarmsHint')}
            </Text>
          </View>
          <Button
            title={t('common.allow')}
            variant="secondary"
            onPress={() => void permission.requestExactAlarms()}
          />
        </View>
      ) : null}
    </>
  );
}

function CrashReportsRow() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const crashReports = useSettingsStore((s) => s.crashReports);
  const setCrashReports = useSettingsStore((s) => s.setCrashReports);
  return (
    <View style={styles.row}>
      <Icon name="bug" size={20} color={colors.textSecondary} />
      <View style={styles.rowLabel}>
        <Text>{t('settings.crashReports')}</Text>
        <Text variant="caption" tone="secondary">
          {t('settings.crashReportsHint')}
        </Text>
      </View>
      <Switch
        value={crashReports}
        onValueChange={setCrashReports}
        accessibilityLabel={t('settings.crashReports')}
        trackColor={{ true: colors.primary }}
      />
    </View>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: IconName;
  label: string;
  hint?: string;
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
      <View style={styles.rowLabel}>
        <Text>{label}</Text>
        {hint ? (
          <Text variant="caption" tone="secondary">
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, padding: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    minHeight: 48,
  },
  rowLabel: { flex: 1, gap: spacing.xxs },
  subRow: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  note: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  accent: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { alignItems: 'center', gap: spacing.xxs, marginTop: spacing.lg },
});
