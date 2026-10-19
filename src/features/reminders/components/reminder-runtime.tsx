import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { capabilities } from '@/lib/capabilities';
import { showSnackbar } from '@/stores/snackbar-store';

import { registerReminderTasks } from '../background';
import { configureNotifications, handleNotificationResponse } from '../notifications';
import { activeRemindersQuery, notificationContent, rollForwardRecurring } from '../repository';
import { rescheduleReminders, watchDatabaseForReminders } from '../scheduler';

const MAX_TIMEOUT = 2 ** 31 - 1;

const openNote = (id: string) => router.push({ pathname: '/note/[id]', params: { id } });

/**
 * Motor de recordatorios mientras la app está abierta (se monta una vez, dentro de AppBootstrap):
 * - nativo: configura las notificaciones, mantiene la ventana programada y atiende las respuestas
 *   (incluida la que abrió la app);
 * - web: sin notificaciones del sistema, avisa con un snackbar cuando vence un recordatorio.
 */
export function ReminderRuntime() {
  return capabilities.localNotifications ? <NativeRuntime /> : <InAppAlerts />;
}

function NativeRuntime() {
  useEffect(() => {
    void (async () => {
      await configureNotifications();
      await registerReminderTasks();
      await rescheduleReminders();
    })().catch((e: unknown) => console.warn('Recordatorios: error al arrancar', e));

    const stopWatching = watchDatabaseForReminders();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void rescheduleReminders();
    });

    const respond = async (response: Notifications.NotificationResponse) => {
      const { openNoteId } = await handleNotificationResponse(response);
      if (openNoteId) openNote(openNoteId);
    };
    const responses = Notifications.addNotificationResponseReceivedListener((r) => void respond(r));
    // La respuesta que abrió la app (o que llegó con la app cerrada, p. ej. "Hecho" en iOS).
    void Notifications.getLastNotificationResponseAsync().then(async (r) => {
      if (!r) return;
      await respond(r);
      await Notifications.clearLastNotificationResponseAsync();
    });

    return () => {
      stopWatching();
      appState.remove();
      responses.remove();
    };
  }, []);
  return null;
}

/** Web: un temporizador hasta el próximo recordatorio; al vencer, snackbar con "Abrir". */
function InAppAlerts() {
  const { data: rows } = useLiveQuery(activeRemindersQuery());
  const alerted = useRef(new Set<string>());
  // Tras cada aviso se vuelve a calcular el siguiente.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    void rollForwardRecurring();
  }, []);

  useEffect(() => {
    const now = Date.now();
    const next = rows.find((r) => r.fireAt > now && !alerted.current.has(`${r.id}@${r.fireAt}`));
    if (!next) return;
    // `setTimeout` admite como mucho ~24,8 días: si es más tarde, solo se vuelve a calcular.
    const delay = next.fireAt - now;
    const timer = setTimeout(
      () => {
        if (delay <= MAX_TIMEOUT) {
          alerted.current.add(`${next.id}@${next.fireAt}`);
          showSnackbar(`🔔 ${notificationContent(next).title}`, {
            label: 'Abrir',
            onPress: () => openNote(next.noteId),
          });
        }
        setTick((t) => t + 1);
      },
      Math.min(delay, MAX_TIMEOUT),
    );
    return () => clearTimeout(timer);
  }, [rows, tick]);

  return null;
}
