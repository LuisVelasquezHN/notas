import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Chip, Sheet, SheetItem, Text, type IconName } from '@/components/ui';
import { useNow } from '@/lib/use-now';
import { spacing, useTheme } from '@/theme';

import { defaultCustomTime, formatReminder, reminderPresets } from '../format';
import {
  RECURRENCE_KINDS,
  buildRecurrence,
  nextOccurrence,
  parseRecurrence,
  recurrenceKind,
  recurrenceLabel,
  type RecurrenceKind,
} from '../recurrence';
import { deviceTimeZone, toWallTime } from '../zoned-time';
import { DateTimePicker } from './date-time-picker';

const PRESET_ICONS: Record<string, IconName> = {
  afternoon: 'sunset',
  evening: 'sunset',
  tomorrow: 'sunrise',
  nextWeek: 'nextWeek',
};

export type ReminderValue = { fireAt: number; rrule: string | null };

type ReminderEditorProps = {
  /** Recordatorio actual (para editarlo o quitarlo). */
  current?: ReminderValue | null;
  /** Fechas límite de ítems: sin recurrencia. */
  allowRecurrence?: boolean;
  onSave: (value: ReminderValue) => void;
  onRemove?: () => void;
};

/**
 * Contenido del selector de recordatorio: atajos ("Esta tarde", "Mañana"…) y, en "Elegir fecha
 * y hora", calendario, hora y repetición. Se usa dentro de una hoja (`ReminderSheet` o el menú de
 * la nota).
 */
export function ReminderEditor({
  current,
  allowRecurrence = true,
  onSave,
  onRemove,
}: ReminderEditorProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const now = useNow();
  const [custom, setCustom] = useState(false);
  const [value, setValue] = useState(() =>
    current && current.fireAt > Date.now() ? current.fireAt : defaultCustomTime(),
  );
  const [kind, setKind] = useState<RecurrenceKind>(() => recurrenceKind(current?.rrule));

  if (!custom) {
    const currentKind = recurrenceKind(current?.rrule);
    return (
      <View>
        {current ? (
          <Text tone="secondary" style={styles.current}>
            {formatReminder(current.fireAt, now, t)}
            {currentKind !== 'none'
              ? ` · ${recurrenceLabel(currentKind, parseRecurrence(current.rrule)!.start, t)}`
              : ''}
          </Text>
        ) : null}
        {reminderPresets(now, t).map((preset) => (
          <SheetItem
            key={preset.key}
            icon={PRESET_ICONS[preset.key] ?? 'clock'}
            label={preset.label}
            trailing={
              <Text variant="caption" tone="muted">
                {formatReminder(preset.at, now, t)}
              </Text>
            }
            onPress={() => onSave({ fireAt: preset.at, rrule: null })}
          />
        ))}
        <SheetItem
          icon="calendar"
          label={t('reminders.pickDate')}
          onPress={() => setCustom(true)}
        />
        {current && onRemove ? (
          <SheetItem
            icon="bellOff"
            label={allowRecurrence ? t('reminders.removeReminder') : t('reminders.removeDue')}
            destructive
            onPress={onRemove}
          />
        ) : null}
      </View>
    );
  }

  const timeZone = deviceTimeZone();
  const start = toWallTime(value, timeZone);
  const rrule = allowRecurrence ? buildRecurrence(kind, start) : null;
  // Con repetición, el primer aviso es la primera ocurrencia futura (p. ej. el lunes siguiente).
  const fireAt = rrule ? nextOccurrence(rrule, timeZone, Math.max(value, now), true) : value;
  const valid = fireAt !== null && fireAt > now;

  return (
    <View style={styles.custom}>
      <DateTimePicker value={value} onChange={setValue} min={now} />
      {allowRecurrence ? (
        <View style={styles.repeat}>
          <Text variant="label" tone="secondary">
            {t('reminders.repeat').toUpperCase()}
          </Text>
          <View style={styles.chips}>
            {RECURRENCE_KINDS.map((k) => (
              <Chip
                key={k}
                label={recurrenceLabel(k, start, t)}
                icon={k === 'none' ? undefined : 'repeat'}
                selected={kind === k}
                onPress={() => setKind(k)}
              />
            ))}
          </View>
        </View>
      ) : null}
      <Text
        variant="caption"
        style={[styles.summary, { color: valid ? colors.textSecondary : colors.danger }]}>
        {valid
          ? t('reminders.firesAt', { when: formatReminder(fireAt, now, t) })
          : t('reminders.pickFuture')}
      </Text>
      <View style={styles.buttons}>
        <Button title={t('common.back')} variant="secondary" onPress={() => setCustom(false)} />
        <Button
          title={t('common.save')}
          disabled={!valid}
          style={styles.save}
          onPress={() => {
            if (valid) onSave({ fireAt, rrule });
          }}
        />
      </View>
    </View>
  );
}

type ReminderSheetProps = Omit<ReminderEditorProps, 'onSave'> & {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onSave: (value: ReminderValue) => void;
};

/** Hoja con el selector de recordatorio (editor de la nota, fechas límite, lista de recordatorios). */
export function ReminderSheet({ visible, title, onClose, ...editor }: ReminderSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} onClose={onClose} title={title ?? t('reminders.reminder')}>
      {visible ? <ReminderEditor {...editor} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  current: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  custom: { paddingHorizontal: spacing.lg, gap: spacing.md },
  repeat: { gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  summary: { textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm },
  save: { flex: 1 },
});
