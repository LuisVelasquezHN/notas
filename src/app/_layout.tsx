import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppBootstrap } from '@/components/app-bootstrap';
import { SnackbarHost } from '@/components/ui';
// Define las tareas en segundo plano al cargar el bundle (también con la app cerrada).
import '@/features/reminders/background';
import { QuickActionsRuntime } from '@/features/quick-actions/quick-actions-runtime';
import { ReminderRuntime } from '@/features/reminders/components/reminder-runtime';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

// Los enlaces que entran directamente en una pantalla (p. ej. `notas://new`) tienen las pestañas
// debajo, para poder volver.
export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const { scheme, colors } = useTheme();
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
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="note/[id]" options={{ title: '' }} />
            <Stack.Screen name="folder/[id]" options={{ title: '' }} />
            <Stack.Screen name="tag/[id]" options={{ title: '' }} />
            <Stack.Screen name="smart/[id]" options={{ title: '' }} />
            <Stack.Screen name="favorites" options={{ title: 'Favoritas' }} />
            <Stack.Screen name="search" options={{ title: 'Buscar' }} />
            <Stack.Screen name="archive" options={{ title: 'Archivo' }} />
            <Stack.Screen name="trash" options={{ title: 'Papelera' }} />
            <Stack.Screen name="new" options={{ title: '', animation: 'none' }} />
          </Stack>
          <ReminderRuntime />
          <QuickActionsRuntime />
          <SnackbarHost />
        </AppBootstrap>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
