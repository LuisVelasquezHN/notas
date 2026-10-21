import { getCalendars } from 'expo-localization';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip, IconButton, Text } from '@/components/ui';
import { currentLocale } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';

/** Paso de los minutos en el selector. */
const MINUTE_STEP = 5;
const QUICK_TIMES = [
  [9, 0],
  [12, 0],
  [18, 0],
  [20, 0],
] as const;

/** Primer día de la semana según la región (0 = domingo, como `Date.getDay()`). Lunes si no se sabe. */
function firstWeekday(): number {
  const first = getCalendars()[0]?.firstWeekday; // 1 = domingo
  return first ? (first - 1) % 7 : 1;
}

/** Iniciales de los días ("L M X J V S D" en español), empezando por `start`. */
function weekdayHeaders(start: number, locale: string): string[] {
  // El 4 de enero de 2026 es domingo.
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2026, 0, 4 + ((start + i) % 7)).toLocaleDateString(locale, { weekday: 'narrow' }),
  );
}

type DateTimePickerProps = {
  value: number;
  onChange: (value: number) => void;
  /** Los días anteriores a este instante no se pueden elegir. */
  min?: number;
};

const pad = (n: number) => String(n).padStart(2, '0');

function withDate(value: number, year: number, month: number, day: number) {
  const d = new Date(value);
  return new Date(year, month, day, d.getHours(), d.getMinutes()).getTime();
}

function withTime(value: number, hour: number, minute: number) {
  const d = new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute).getTime();
}

/**
 * Selector de fecha y hora propio (calendario mensual + horas): funciona igual en iOS, Android y
 * web sin módulos nativos. La hora se elige con pasos de 5 minutos o con los atajos.
 */
export function DateTimePicker({ value, onChange, min }: DateTimePickerProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const locale = currentLocale();
  const weekStart = firstWeekday();
  const selected = new Date(value);
  const [month, setMonth] = useState(() => ({
    year: selected.getFullYear(),
    month: selected.getMonth(),
  }));

  const first = new Date(month.year, month.month, 1);
  const leading = (first.getDay() - weekStart + 7) % 7;
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date();
  const minDay = min === undefined ? null : new Date(min);
  const isBeforeMin = (day: number) =>
    minDay !== null &&
    new Date(month.year, month.month, day) <
      new Date(minDay.getFullYear(), minDay.getMonth(), minDay.getDate());
  const canGoBack =
    minDay === null ||
    month.year > minDay.getFullYear() ||
    (month.year === minDay.getFullYear() && month.month > minDay.getMonth());

  const shiftMonth = (delta: number) =>
    setMonth(({ year, month: m }) => {
      const d = new Date(year, m + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  const hour = selected.getHours();
  const minute = selected.getMinutes();
  const stepMinutes = (delta: number) => onChange(value + delta * 60_000);
  const title = first.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  return (
    <View style={styles.root}>
      <View style={styles.monthHeader}>
        <IconButton
          icon="chevronLeft"
          accessibilityLabel={t('picker.previousMonth')}
          disabled={!canGoBack}
          color={canGoBack ? colors.text : colors.textMuted}
          onPress={() => shiftMonth(-1)}
        />
        <Text variant="bodyStrong" style={styles.monthTitle}>
          {title.charAt(0).toUpperCase() + title.slice(1)}
        </Text>
        <IconButton
          icon="chevronRight"
          accessibilityLabel={t('picker.nextMonth')}
          onPress={() => shiftMonth(1)}
        />
      </View>

      <View style={styles.week}>
        {weekdayHeaders(weekStart, locale).map((d, i) => (
          <Text key={i} variant="label" tone="muted" style={styles.weekday}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={`empty-${i}`} style={styles.cell} />;
          const isSelected =
            selected.getFullYear() === month.year &&
            selected.getMonth() === month.month &&
            selected.getDate() === day;
          const isToday =
            today.getFullYear() === month.year &&
            today.getMonth() === month.month &&
            today.getDate() === day;
          const disabled = isBeforeMin(day);
          return (
            <View key={day} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={new Date(month.year, month.month, day).toLocaleDateString(
                  locale,
                  { weekday: 'long', day: 'numeric', month: 'long' },
                )}
                aria-selected={isSelected}
                aria-disabled={disabled}
                disabled={disabled}
                onPress={() => onChange(withDate(value, month.year, month.month, day))}
                style={({ pressed }) => [
                  styles.day,
                  isToday && { borderColor: colors.primary, borderWidth: 1 },
                  isSelected && { backgroundColor: colors.primary },
                  pressed && !isSelected && { backgroundColor: colors.surfacePressed },
                ]}>
                <Text
                  style={{
                    color: isSelected
                      ? colors.onPrimary
                      : disabled
                        ? colors.textMuted
                        : colors.text,
                  }}>
                  {day}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.timeRow}>
        <IconButton
          icon="minus"
          accessibilityLabel={t('picker.minusMinutes', { count: MINUTE_STEP })}
          onPress={() => stepMinutes(-MINUTE_STEP)}
        />
        <Text variant="title" accessibilityLiveRegion="polite" style={styles.time}>
          {pad(hour)}:{pad(minute)}
        </Text>
        <IconButton
          icon="add"
          accessibilityLabel={t('picker.plusMinutes', { count: MINUTE_STEP })}
          onPress={() => stepMinutes(MINUTE_STEP)}
        />
      </View>
      <View style={styles.hourSteps}>
        <Chip label="−1 h" onPress={() => stepMinutes(-60)} />
        <Chip label="+1 h" onPress={() => stepMinutes(60)} />
        {QUICK_TIMES.map(([h, m]) => (
          <Chip
            key={`${h}:${m}`}
            label={`${pad(h)}:${pad(m)}`}
            selected={hour === h && minute === m}
            onPress={() => onChange(withTime(value, h, m))}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  monthHeader: { flexDirection: 'row', alignItems: 'center' },
  monthTitle: { flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 },
  day: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  time: { minWidth: 72, textAlign: 'center' },
  hourSteps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
