import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

import { capabilities } from '@/lib/capabilities';

import { SNOOZE_MINUTES } from './format';
import { markReminderDone, snoozeReminder } from './repository';
import { reminderIdFromIdentifier } from './window';

/**
 * Notificaciones del sistema (solo iOS y Android: en web no hay notificaciones locales
 * programadas y los recordatorios se avisan dentro de la app, ver `in-app-alerts.tsx`).
 */

export const REMINDER_CHANNEL_ID = 'reminders';
export const REMINDER_CATEGORY_ID = 'reminder';
export const ACTION_DONE = 'done';
export const ACTION_SNOOZE = 'snooze';
export const ACTION_OPEN = 'open';

export type ReminderNotificationData = { reminderId: string; noteId: string };

let configured: Promise<void> | null = null;

/** Handler en primer plano, canal de Android y categoría con acciones. Idempotente. */
export function configureNotifications(): Promise<void> {
  if (!capabilities.localNotifications) return Promise.resolve();
  configured ??= (async () => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      // En Android 13+ el diálogo de permiso solo aparece si ya existe un canal.
      await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
        name: 'Recordatorios',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    await Notifications.setNotificationCategoryAsync(REMINDER_CATEGORY_ID, [
      {
        identifier: ACTION_DONE,
        buttonTitle: 'Hecho',
        options: { opensAppToForeground: false },
      },
      {
        identifier: ACTION_SNOOZE,
        buttonTitle: `Posponer ${SNOOZE_MINUTES} min`,
        options: { opensAppToForeground: false },
      },
      { identifier: ACTION_OPEN, buttonTitle: 'Abrir', options: { opensAppToForeground: true } },
    ]);
  })().catch((e: unknown) => {
    configured = null;
    throw e;
  });
  return configured;
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

function toState(settings: Notifications.NotificationPermissionsStatus): PermissionState {
  if (settings.granted || settings.ios?.status === IosAuthorizationStatus.PROVISIONAL) {
    return 'granted';
  }
  return settings.canAskAgain ? 'undetermined' : 'denied';
}

export async function getPermissionState(): Promise<PermissionState> {
  if (!capabilities.localNotifications) return 'unavailable';
  return toState(await Notifications.getPermissionsAsync());
}

/** Pide permiso si aún se puede. Devuelve el estado final. */
export async function ensurePermission(): Promise<PermissionState> {
  if (!capabilities.localNotifications) return 'unavailable';
  await configureNotifications();
  const current = await getPermissionState();
  if (current !== 'undetermined') return current;
  return toState(await Notifications.requestPermissionsAsync());
}

/**
 * Android 12+: sin el permiso de alarmas exactas el aviso puede llegar con minutos de retraso.
 * `true` si está concedido (o no aplica).
 */
export async function hasExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.getExactAlarmPermissionsAsync()).granted;
  } catch {
    return true;
  }
}

export async function requestExactAlarmPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    return (await Notifications.requestExactAlarmPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Respuestas ya procesadas (la misma puede llegar por el listener y al arrancar). */
const HANDLED_KEY = 'reminders.handledResponses';
const HANDLED_MAX = 20;

async function alreadyHandled(key: string): Promise<boolean> {
  const raw = (await Storage.getItemAsync(HANDLED_KEY)) ?? '[]';
  let list: string[] = [];
  try {
    list = JSON.parse(raw) as string[];
  } catch {
    list = [];
  }
  if (list.includes(key)) return true;
  await Storage.setItemAsync(HANDLED_KEY, JSON.stringify([...list, key].slice(-HANDLED_MAX)));
  return false;
}

function dataOf(
  response: Pick<Notifications.NotificationResponse, 'notification'>,
): ReminderNotificationData | null {
  const request = response.notification.request;
  const data = request.content.data as Partial<ReminderNotificationData> | undefined;
  const reminderId = data?.reminderId ?? reminderIdFromIdentifier(request.identifier);
  if (!reminderId || !data?.noteId) return null;
  return { reminderId, noteId: data.noteId };
}

/**
 * Aplica la respuesta a una notificación: "Hecho" y "Posponer" cambian la base de datos (el
 * scheduler reprograma después); tocar la notificación o "Abrir" devuelve la nota a abrir.
 */
export async function handleNotificationResponse(
  response: Pick<Notifications.NotificationResponse, 'notification' | 'actionIdentifier'>,
): Promise<{ openNoteId: string | null }> {
  const data = dataOf(response);
  if (!data) return { openNoteId: null };
  const key = `${response.notification.request.identifier}|${response.actionIdentifier}`;
  if (await alreadyHandled(key)) return { openNoteId: null };

  switch (response.actionIdentifier) {
    case ACTION_DONE:
      await markReminderDone(data.reminderId);
      break;
    case ACTION_SNOOZE:
      await snoozeReminder(data.reminderId, SNOOZE_MINUTES);
      break;
    case ACTION_OPEN:
    case Notifications.DEFAULT_ACTION_IDENTIFIER:
      return { openNoteId: data.noteId };
  }
  await Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(
    () => undefined,
  );
  return { openNoteId: null };
}
