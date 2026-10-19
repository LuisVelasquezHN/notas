import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppBootstrap } from '@/components/app-bootstrap';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

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
            <Stack.Screen name="folder/[id]" options={{ title: 'Carpeta' }} />
            <Stack.Screen name="search" options={{ title: 'Buscar' }} />
            <Stack.Screen name="archive" options={{ title: 'Archivo' }} />
            <Stack.Screen name="trash" options={{ title: 'Papelera' }} />
          </Stack>
        </AppBootstrap>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
