import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppBootstrap } from '@/components/app-bootstrap';
import { SnackbarHost } from '@/components/ui';
// Define las tareas en segundo plano al cargar el bundle (también con la app cerrada).
import '@/features/reminders/background';
import { QuickActionsRuntime } from '@/features/quick-actions/quick-actions-runtime';
import { ReminderRuntime } from '@/features/reminders/components/reminder-runtime';
import { AppLockGate } from '@/features/security/components/app-lock-gate';
import { useSettingsStore } from '@/stores/settings-store';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

// Los enlaces que entran directamente en una pantalla (p. ej. `notas://new`) tienen las pestañas
// debajo, para poder volver.
export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const { scheme, colors } = useTheme();
  const { t } = useTranslation();
  const onboarded = useSettingsStore((s) => s.onboarded);
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <AppBootstrap>
          <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}>
            {/* Primer arranque: solo la presentación; al terminarla, el resto de la app. */}
            <Stack.Protected guard={!onboarded}>
              <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
            </Stack.Protected>
            <Stack.Protected guard={onboarded} redirectTo="/onboarding">
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="note/[id]" options={{ title: '' }} />
              <Stack.Screen name="folder/[id]" options={{ title: '' }} />
              <Stack.Screen name="tag/[id]" options={{ title: '' }} />
              <Stack.Screen name="smart/[id]" options={{ title: '' }} />
              <Stack.Screen name="favorites" options={{ title: t('screens.favorites') }} />
              <Stack.Screen name="search" options={{ title: t('screens.search') }} />
              <Stack.Screen name="archive" options={{ title: t('screens.archive') }} />
              <Stack.Screen name="trash" options={{ title: t('screens.trash') }} />
              <Stack.Screen name="new" options={{ title: '', animation: 'none' }} />
            </Stack.Protected>
          </Stack>
          <ReminderRuntime />
          <QuickActionsRuntime />
          <SnackbarHost />
          <AppLockGate />
        </AppBootstrap>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
