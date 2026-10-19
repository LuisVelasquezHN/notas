import type { ComponentRef, Ref } from 'react';
import {
  TabList,
  TabSlot,
  TabTrigger,
  Tabs,
  type TabListProps,
  type TabTriggerSlotProps,
} from 'expo-router/ui';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import { MAX_CONTENT_WIDTH, radius, spacing, useTheme } from '@/theme';

/** Por debajo de este ancho, la barra pasa abajo y en formato compacto (como en móvil). */
const COMPACT_BREAKPOINT = 640;

function useCompact() {
  return useWindowDimensions().width < COMPACT_BREAKPOINT;
}

/**
 * En web, NativeTabs no tiene tab bar del sistema: barra propia con tabs headless.
 * Arriba en pantallas anchas; abajo en móvil.
 */
export default function TabsLayout() {
  const compact = useCompact();
  return (
    <Tabs>
      {compact ? <TabSlot /> : null}
      {/* Los TabTrigger deben ser hijos directos de la lista para que TabList registre las rutas. */}
      <TabList asChild>
        <TabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="note">Notas</TabButton>
          </TabTrigger>
          <TabTrigger name="folders" href="/folders" asChild>
            <TabButton icon="folder">Carpetas</TabButton>
          </TabTrigger>
          <TabTrigger name="reminders" href="/reminders" asChild>
            <TabButton icon="bell">Recordatorios</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon="settings">Ajustes</TabButton>
          </TabTrigger>
        </TabBar>
      </TabList>
      {compact ? null : <TabSlot />}
    </Tabs>
  );
}

function TabBar({ children, ...props }: TabListProps) {
  const { colors } = useTheme();
  const compact = useCompact();
  return (
    <View
      {...props}
      // Los hijos de <Slot> (asChild) no aceptan arrays de estilos.
      style={StyleSheet.flatten([
        styles.bar,
        compact ? styles.barCompact : styles.barWide,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ])}>
      <View style={[styles.inner, compact && styles.innerCompact]}>
        {compact ? null : (
          <Text variant="heading" style={styles.brand}>
            Notas
          </Text>
        )}
        {children}
      </View>
    </View>
  );
}

function TabButton({
  children,
  isFocused,
  icon,
  ref,
  ...props
}: TabTriggerSlotProps & { icon: IconName }) {
  const { colors } = useTheme();
  const compact = useCompact();
  const color = isFocused ? colors.text : colors.textSecondary;
  return (
    <Pressable
      {...props}
      // `TabTriggerSlotProps` tipa la ref como componente; en runtime es la vista nativa.
      ref={ref as unknown as Ref<ComponentRef<typeof Pressable>>}
      style={StyleSheet.flatten([
        styles.tab,
        compact && styles.tabCompact,
        isFocused && { backgroundColor: colors.surfaceMuted },
      ])}>
      <Icon name={icon} size={18} color={color} />
      <Text variant="label" style={{ color }}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { alignItems: 'center' },
  barWide: { borderBottomWidth: StyleSheet.hairlineWidth },
  barCompact: { borderTopWidth: StyleSheet.hairlineWidth },
  inner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  innerCompact: { paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  brand: { marginRight: 'auto' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  tabCompact: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
});
