import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from 'react-native-reanimated';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppLocked } from '@/stores/security-store';
import { radius, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

/**
 * Ejecuta `fn` cuando la hoja ya se ha cerrado. En iOS no se puede presentar otro modal
 * (otra hoja o un `Alert`) mientras el anterior todavía se está ocultando.
 */
export function afterSheetClose(fn: () => void) {
  setTimeout(fn, Platform.OS === 'ios' ? 400 : 0);
}

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/**
 * Hoja inferior modal. Usa `Modal` de React Native para funcionar igual en iOS, Android y web
 * sin añadir dependencias nativas.
 */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  // Con la app bloqueada no se muestra (un modal quedaría encima de la pantalla de bloqueo).
  const appLocked = useAppLocked();
  // Con "Reducir movimiento" la hoja aparece sin deslizarse.
  const reduceMotion = useReducedMotion();
  return (
    <Modal
      visible={visible && !appLocked}
      transparent
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          style={styles.backdrop}
          onPress={onClose}
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md },
          ]}>
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {title ? (
            <Text variant="heading" style={styles.title}>
              {title}
            </Text>
          ) : null}
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type SheetItemProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
  selected?: boolean;
  /** Sangría (p. ej. subcarpetas). */
  inset?: number;
  trailing?: ReactNode;
};

export function SheetItem({
  icon,
  label,
  onPress,
  destructive = false,
  selected = false,
  inset = 0,
  trailing,
}: SheetItemProps) {
  const { colors } = useTheme();
  const color = destructive ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      aria-selected={selected}
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        { paddingLeft: spacing.lg + inset * spacing.xl },
        (pressed || selected) && { backgroundColor: colors.surfaceMuted },
      ]}>
      <Icon name={icon} size={20} color={destructive ? colors.danger : colors.textSecondary} />
      <Text style={[styles.itemLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
      {trailing}
      {selected ? <Icon name="check" size={18} color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '85%',
    alignSelf: 'center',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  title: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingRight: spacing.lg,
    minHeight: 48,
  },
  itemLabel: { flex: 1 },
});
