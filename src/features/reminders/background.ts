import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { openDatabase } from '@/db/client';
import { warmUpKvStorage } from '@/lib/kv-storage';
import { capabilities } from '@/lib/capabilities';

import { handleNotificationResponse } from './notifications';
import { rescheduleReminders } from './scheduler';

/**
 * Tareas en segundo plano. Se definen al cargar el módulo (lo importa `app/_layout.tsx`), porque
 * con la app cerrada el sistema arranca el bundle sin montar ningún componente.
 *
 * - `reminders-reschedule`: recalcula la ventana de notificaciones de vez en cuando (iOS solo
 *   permite 64 pendientes, así que los recordatorios lejanos se programan más adelante).
 * - `reminders-response`: "Hecho" y "Posponer" pulsados con la app en segundo plano o cerrada
 *   (Android; en iOS la respuesta se recoge también al volver a abrir la app).
 */

const RESCHEDULE_TASK = 'reminders-reschedule';
const RESPONSE_TASK = 'reminders-response';

if (capabilities.localNotifications) {
  TaskManager.defineTask(RESCHEDULE_TASK, async () => {
    try {
      await openDatabase();
      await rescheduleReminders();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });

  TaskManager.defineTask<Record<string, unknown>>(RESPONSE_TASK, async ({ data, error }) => {
    if (error || !data || !('actionIdentifier' in data)) return;
    await warmUpKvStorage();
    await openDatabase();
    await handleNotificationResponse(data as unknown as Notifications.NotificationResponse);
    await rescheduleReminders();
  });
}

/** Registra las tareas (una vez por arranque; registrar de nuevo no duplica). */
export async function registerReminderTasks() {
  if (!capabilities.localNotifications) return;
  try {
    await Notifications.registerTaskAsync(RESPONSE_TASK);
    if ((await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available) {
      await BackgroundTask.registerTaskAsync(RESCHEDULE_TASK, { minimumInterval: 6 * 60 });
    }
  } catch (e) {
    console.warn('No se pudieron registrar las tareas de recordatorios', e);
  }
}
