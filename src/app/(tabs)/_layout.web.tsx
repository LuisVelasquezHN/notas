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
import { useTranslation } from 'react-i18next';

import { Icon, Text, type IconName } from '@/components/ui';
import { useOverdueCount } from '@/features/reminders/hooks/use-overdue-count';
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
  const overdue = useOverdueCount();
  const { t } = useTranslation();
  return (
    <Tabs>
      {compact ? <TabSlot style={styles.slot} /> : null}
      {/* Los TabTrigger deben ser hijos directos de la lista para que TabList registre las rutas. */}
      <TabList asChild>
        <TabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="note">{t('tabs.notes')}</TabButton>
          </TabTrigger>
          <TabTrigger name="folders" href="/folders" asChild>
            <TabButton icon="folder">{t('tabs.folders')}</TabButton>
          </TabTrigger>
          <TabTrigger name="reminders" href="/reminders" asChild>
            <TabButton icon="bell" badge={overdue}>
              {t('tabs.reminders')}
            </TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon="settings">{t('tabs.settings')}</TabButton>
          </TabTrigger>
        </TabBar>
      </TabList>
      {compact ? null : <TabSlot style={styles.slot} />}
    </Tabs>
  );
}

function TabBar({ children, ...props }: TabListProps) {
  const { colors } = useTheme();
  const compact = useCompact();
  const { t } = useTranslation();
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
            {t('tabs.notes')}
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
  badge = 0,
  ref,
  ...props
}: TabTriggerSlotProps & { icon: IconName; badge?: number }) {
  const { colors } = useTheme();
  const compact = useCompact();
  const { t } = useTranslation();
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
      <View>
        <Icon name={icon} size={18} color={color} />
        {badge > 0 ? (
          <View
            accessibilityLabel={t('tabs.overdueBadge', { count: badge })}
            style={[styles.badge, { backgroundColor: colors.danger }]}>
            <Text variant="label" style={styles.badgeText}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="label" style={{ color }}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // El contenedor de TabSlot no encoge (`flexShrink: 0`): crecía con la pantalla y los
  // ScrollView de las pestañas nunca se desplazaban. Se limita al alto disponible.
  slot: { flexShrink: 1, flexBasis: 0, minHeight: 0 },
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
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, lineHeight: 12 },
  tabCompact: {
    flex: 1,
    flexDirection: 'column',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs,
  },
});
