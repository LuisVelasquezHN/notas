import * as Notifications from 'expo-notifications';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { Platform } from 'react-native';

import { capabilities } from '@/lib/capabilities';

import {
  REMINDER_CATEGORY_ID,
  REMINDER_CHANNEL_ID,
  configureNotifications,
  getPermissionState,
  hasExactAlarmPermission,
  type ReminderNotificationData,
} from './notifications';
import { loadActiveReminders, rollForwardRecurring } from './repository';
import { diffWindow, planWindow, reminderIdFromIdentifier } from './window';

/**
 * Mantiene programada la ventana de notificaciones (PLAN.md §6) a partir de la base de datos.
 * Se ejecuta al arrancar, al volver a primer plano, en la tarea de segundo plano y tras cualquier
 * cambio en notas, ítems o recordatorios. Es idempotente: solo cancela y programa diferencias.
 */

let running: Promise<void> = Promise.resolve();
let pending = false;

async function reschedule() {
  await rollForwardRecurring();
  const reminders = await loadActiveReminders();
  const now = Date.now();

  const overdue = reminders.filter((r) => r.fireAt <= now).length;
  await Notifications.setBadgeCountAsync(overdue).catch(() => false);

  if ((await getPermissionState()) !== 'granted') return;
  await configureNotifications();

  const planned = planWindow(reminders, now);
  const scheduled = (await Notifications.getAllScheduledNotificationsAsync())
    .map((n) => n.identifier)
    // Solo se tocan las notificaciones de recordatorios.
    .filter((id) => reminderIdFromIdentifier(id) !== null);
  const { cancel, schedule } = diffWindow(scheduled, planned);
  const exact = await hasExactAlarmPermission();

  for (const id of cancel) await Notifications.cancelScheduledNotificationAsync(id);
  for (const item of schedule) {
    const data: ReminderNotificationData = { reminderId: item.reminderId, noteId: item.noteId };
    await Notifications.scheduleNotificationAsync({
      identifier: item.identifier,
      content: {
        title: item.title,
        body: item.body || undefined,
        data,
        sound: 'default',
        categoryIdentifier: REMINDER_CATEGORY_ID,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: item.fireAt,
        channelId: REMINDER_CHANNEL_ID,
        // Android: alarma exacta si hay permiso (si no, el sistema puede retrasarla).
        ...(Platform.OS === 'android' && exact ? { delivery: 'alarmClock' as const } : {}),
      },
    });
  }
}

/**
 * Reprograma la ventana. Las llamadas se encadenan: si llega una mientras otra se ejecuta, se
 * hace una sola pasada más al terminar.
 */
export function rescheduleReminders(): Promise<void> {
  if (!capabilities.localNotifications) return Promise.resolve();
  if (pending) return running;
  pending = true;
  running = running
    .then(() => {
      pending = false;
      return reschedule();
    })
    .catch((e: unknown) => {
      console.warn('No se pudieron reprogramar los recordatorios', e);
    });
  return running;
}

const WATCHED_TABLES = new Set(['notes', 'reminders', 'checklist_items']);
const DEBOUNCE_MS = 800;

/** Reprograma tras los cambios en la base de datos (agrupados). Devuelve la función para parar. */
export function watchDatabaseForReminders(): () => void {
  if (!capabilities.localNotifications) return () => undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const subscription = addDatabaseChangeListener(({ tableName }) => {
    if (!WATCHED_TABLES.has(tableName)) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void rescheduleReminders();
    }, DEBOUNCE_MS);
  });
  return () => {
    if (timer) clearTimeout(timer);
    subscription.remove();
  };
}
