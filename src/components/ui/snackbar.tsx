import { useEffect } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useScreenReaderEnabled } from '@/lib/use-screen-reader';
import { SNACKBAR_DURATION_MS, useSnackbarStore } from '@/stores/snackbar-store';
import { MAX_CONTENT_WIDTH, radius, spacing, useTheme } from '@/theme';

import { Text } from './text';

/** Altura aproximada de la tab bar, para no tapar la navegación. */
const TAB_BAR_OFFSET = 64;
/** Con lector de pantalla hace falta más tiempo para llegar a "Deshacer". */
const SCREEN_READER_FACTOR = 3;

/** Mensaje temporal global (con acción opcional, normalmente "Deshacer"). Va en el layout raíz. */
export function SnackbarHost() {
  const current = useSnackbarStore((s) => s.current);
  const dismiss = useSnackbarStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();
  const { scheme } = useTheme();
  const screenReader = useScreenReaderEnabled();

  useEffect(() => {
    if (!current) return;
    // Android lo anuncia por la región "live"; iOS necesita el anuncio explícito.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(current.message);
    const duration = SNACKBAR_DURATION_MS * (screenReader ? SCREEN_READER_FACTOR : 1);
    const timer = setTimeout(() => dismiss(current.id), duration);
    return () => clearTimeout(timer);
  }, [current, dismiss, screenReader]);

  if (!current) return null;

  // Contraste invertido respecto al tema, como en Material.
  const bg = scheme === 'dark' ? '#F2F2EE' : '#2A2A27';
  const fg = scheme === 'dark' ? '#1C1C1A' : '#F2F2EE';
  const accent = scheme === 'dark' ? '#9A6B00' : '#F5B91F';

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { bottom: insets.bottom + TAB_BAR_OFFSET + spacing.sm }]}>
      <Animated.View
        key={current.id}
        entering={FadeInDown.duration(180)}
        exiting={FadeOutDown.duration(150)}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.bar, { backgroundColor: bg }]}>
        <Text style={[styles.message, { color: fg }]} numberOfLines={2}>
          {current.message}
        </Text>
        {current.action ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              dismiss(current.id);
              void current.action?.onPress();
            }}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
            <Text variant="bodyStrong" style={{ color: accent }}>
              {current.action.label}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  bar: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH / 1.5,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  message: { flex: 1 },
  action: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
});
