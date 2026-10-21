import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Button,
  EmptyState,
  Icon,
  IconButton,
  Screen,
  Sheet,
  SheetItem,
  Text,
  afterSheetClose,
} from '@/components/ui';
import * as reminderActions from '@/features/reminders/actions';
import { ReminderSheet } from '@/features/reminders/components/reminder-sheet';
import { formatReminder, formatTime } from '@/features/reminders/format';
import { groupReminders, reminderGroupLabel } from '@/features/reminders/groups';
import { useNotificationPermission } from '@/features/reminders/hooks/use-notification-permission';
import { recurrenceKind, recurrenceShortLabel } from '@/features/reminders/recurrence';
import {
  activeRemindersQuery,
  notificationContent,
  type ActiveReminderRow,
} from '@/features/reminders/repository';
import type { TFunction } from '@/i18n';
import { capabilities } from '@/lib/capabilities';
import { useNow } from '@/lib/use-now';
import { radius, spacing, useTheme } from '@/theme';

/** Atajos de "Posponer" desde la lista. */
function snoozeOptions(now: number, t: TFunction) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return [
    { key: '10m', label: t('reminders.snooze10'), minutes: 10 },
    { key: '1h', label: t('reminders.snooze1h'), minutes: 60 },
    { key: 'tomorrow', label: t('reminders.tomorrowAt9'), at: tomorrow.getTime() },
  ];
}

export default function RemindersScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const now = useNow();
  const { data: rows, updatedAt } = useLiveQuery(activeRemindersQuery());
  const permission = useNotificationPermission();
  const [menuFor, setMenuFor] = useState<ActiveReminderRow | null>(null);
  const [editing, setEditing] = useState<ActiveReminderRow | null>(null);
  const groups = groupReminders(rows, now);

  const runFromMenu = (fn: () => void) => {
    setMenuFor(null);
    afterSheetClose(fn);
  };

  return (
    <Screen scroll>
      <Text variant="largeTitle" style={styles.title}>
        {t('reminders.title')}
      </Text>

      {permission.state === 'denied' || permission.state === 'undetermined' ? (
        <Banner
          icon="bellOff"
          text={
            permission.state === 'denied'
              ? t('reminders.notificationsDenied')
              : t('reminders.notificationsOff')
          }
          action={permission.state === 'denied' ? t('common.openSettings') : t('common.enable')}
          onPress={() => void permission.request()}
        />
      ) : null}
      {permission.state === 'granted' && !permission.exactAlarms ? (
        <Banner
          icon="clock"
          text={t('reminders.exactAlarmsHint')}
          action={t('common.allow')}
          onPress={() => void permission.requestExactAlarms()}
        />
      ) : null}
      {!capabilities.localNotifications && rows.length > 0 ? (
        <Text variant="caption" tone="muted" style={styles.webNote}>
          {t('reminders.webHint')}
        </Text>
      ) : null}

      {rows.length === 0 && updatedAt ? (
        <EmptyState
          icon="bell"
          title={t('reminders.empty')}
          description={t('reminders.emptyHint')}
        />
      ) : null}

      {groups.map(({ group, items }) => (
        <View key={group} style={styles.section}>
          <Text
            variant="label"
            style={{ color: group === 'overdue' ? colors.danger : colors.textSecondary }}>
            {reminderGroupLabel(group, t).toUpperCase()} · {items.length}
          </Text>
          <View style={[styles.sectionBody, { backgroundColor: colors.surface }]}>
            {items.map((row) => (
              <ReminderRow
                key={row.id}
                row={row}
                now={now}
                // Hoy y mañana ya lo dice la cabecera: basta con la hora.
                timeOnly={group === 'today' || group === 'tomorrow'}
                onMore={() => setMenuFor(row)}
              />
            ))}
          </View>
        </View>
      ))}

      <Sheet
        visible={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor ? notificationContent(menuFor).title : undefined}>
        {menuFor ? (
          <>
            {snoozeOptions(now, t).map((option) => (
              <SheetItem
                key={option.key}
                icon="snooze"
                label={option.label}
                onPress={() =>
                  runFromMenu(() =>
                    option.at
                      ? void reminderActions.snoozeUntil(menuFor.id, option.at)
                      : void reminderActions.snooze(menuFor.id, option.minutes!),
                  )
                }
              />
            ))}
            <SheetItem
              icon="edit"
              label={menuFor.checklistItemId ? t('reminders.changeDue') : t('reminders.change')}
              onPress={() => runFromMenu(() => setEditing(menuFor))}
            />
            <SheetItem
              icon="note"
              label={t('reminders.openNote')}
              onPress={() =>
                runFromMenu(() =>
                  router.push({ pathname: '/note/[id]', params: { id: menuFor.noteId } }),
                )
              }
            />
            <SheetItem
              icon="bellOff"
              label={t('common.remove')}
              destructive
              onPress={() => runFromMenu(() => void reminderActions.remove(menuFor.id))}
            />
          </>
        ) : null}
      </Sheet>

      <ReminderSheet
        visible={editing !== null}
        title={editing?.checklistItemId ? t('reminders.due') : t('reminders.reminder')}
        allowRecurrence={!editing?.checklistItemId}
        current={editing ? { fireAt: editing.fireAt, rrule: editing.rrule } : null}
        onClose={() => setEditing(null)}
        onSave={({ fireAt, rrule }) => {
          const row = editing;
          setEditing(null);
          if (!row) return;
          if (row.checklistItemId) {
            void reminderActions.saveItemDue(
              { id: row.checklistItemId, noteId: row.noteId },
              fireAt,
            );
          } else {
            void reminderActions.saveNoteReminder(row.noteId, fireAt, rrule);
          }
        }}
        onRemove={() => {
          const row = editing;
          setEditing(null);
          if (row) void reminderActions.remove(row.id);
        }}
      />
    </Screen>
  );
}

function ReminderRow({
  row,
  now,
  timeOnly,
  onMore,
}: {
  row: ActiveReminderRow;
  now: number;
  timeOnly: boolean;
  onMore: () => void;
}) {
  const { colors, noteColor } = useTheme();
  const { t } = useTranslation();
  const { title } = notificationContent(row);
  const overdue = row.fireAt <= now;
  const kind = recurrenceKind(row.rrule);
  const when = timeOnly ? formatTime(row.fireAt) : formatReminder(row.fireAt, now, t);
  const details = [
    when,
    kind !== 'none' ? recurrenceShortLabel(kind, t) : null,
    row.status === 'snoozed' ? t('reminders.snoozed') : null,
    row.checklistItemId ? row.noteTitle.trim() || t('common.list') : null,
    row.isArchived ? t('reminders.archived') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.row}>
      <IconButton
        icon="checkbox"
        accessibilityLabel={t('reminders.markDone', { title })}
        color={colors.textSecondary}
        onPress={() => void reminderActions.done(row.id)}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(overdue ? 'reminders.rowLabelOverdue' : 'reminders.rowLabel', {
          title,
          details,
        })}
        accessibilityHint={t('reminders.opensNote')}
        onPress={() => router.push({ pathname: '/note/[id]', params: { id: row.noteId } })}
        onLongPress={onMore}
        style={({ pressed }) => [styles.rowBody, pressed && { opacity: 0.6 }]}>
        <View style={styles.rowTitle}>
          <View
            style={[
              styles.dot,
              { backgroundColor: noteColor(row.noteColor), borderColor: colors.border },
            ]}
          />
          {row.checklistItemId ? (
            <Icon name="checklist" size={14} color={colors.textMuted} />
          ) : null}
          <Text numberOfLines={1} style={styles.flex}>
            {title}
          </Text>
        </View>
        <Text
          variant="caption"
          numberOfLines={1}
          style={{ color: overdue ? colors.danger : colors.textSecondary }}>
          {details}
        </Text>
      </Pressable>
      <IconButton
        icon="more"
        accessibilityLabel={t('common.moreOptions')}
        color={colors.textSecondary}
        onPress={onMore}
      />
    </View>
  );
}

function Banner({
  icon,
  text,
  action,
  onPress,
}: {
  icon: 'bellOff' | 'clock';
  text: string;
  action: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: colors.surfaceMuted }]}>
      <Icon name={icon} size={20} color={colors.textSecondary} />
      <Text tone="secondary" style={styles.flex}>
        {text}
      </Text>
      <Button title={action} variant="secondary" onPress={onPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  title: { paddingVertical: spacing.md },
  webNote: { marginBottom: spacing.md },
  section: { gap: spacing.sm, marginBottom: spacing.xl },
  sectionBody: { borderRadius: radius.lg, paddingVertical: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    minHeight: 56,
  },
  rowBody: { flex: 1, gap: spacing.xxs, paddingVertical: spacing.sm },
  rowTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
});
