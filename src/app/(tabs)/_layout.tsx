import { NativeTabs } from 'expo-router/native-tabs';
import { useTranslation } from 'react-i18next';

import { useOverdueCount } from '@/features/reminders/hooks/use-overdue-count';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  const overdue = useOverdueCount();
  const { t } = useTranslation();
  return (
    <NativeTabs
      backgroundColor={colors.surface}
      indicatorColor={colors.surfaceMuted}
      tintColor={colors.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabs.notes')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'note.text', selected: 'note.text' }}
          md="sticky_note_2"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="folders">
        <NativeTabs.Trigger.Label>{t('tabs.folders')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'folder', selected: 'folder.fill' }} md="folder" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="reminders">
        <NativeTabs.Trigger.Label>{t('tabs.reminders')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={overdue === 0}>
          {String(overdue)}
        </NativeTabs.Trigger.Badge>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bell', selected: 'bell.fill' }}
          md="notifications"
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t('tabs.settings')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          md="settings"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
