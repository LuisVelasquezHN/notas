import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { capabilities } from '@/lib/capabilities';

import {
  ensurePermission,
  getPermissionState,
  hasExactAlarmPermission,
  requestExactAlarmPermission,
  type PermissionState,
} from '../notifications';
import { rescheduleReminders } from '../scheduler';

/**
 * Estado del permiso de notificaciones (y de alarmas exactas en Android). Se vuelve a comprobar al
 * volver a la app, por si el usuario lo cambió en los ajustes del sistema.
 */
export function useNotificationPermission() {
  const [state, setState] = useState<PermissionState | null>(
    capabilities.localNotifications ? null : 'unavailable',
  );
  const [exactAlarms, setExactAlarms] = useState(true);

  useEffect(() => {
    if (!capabilities.localNotifications) return;
    let alive = true;
    const check = () =>
      Promise.all([getPermissionState(), hasExactAlarmPermission()]).then(([next, exact]) => {
        if (!alive) return;
        setState(next);
        setExactAlarms(exact);
      });
    void check();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  /** Pide el permiso; si ya se denegó, abre los ajustes del sistema. */
  const request = useCallback(async () => {
    if (state === 'denied') {
      await Linking.openSettings();
      return;
    }
    const next = await ensurePermission();
    setState(next);
    if (next === 'granted') void rescheduleReminders();
  }, [state]);

  const requestExactAlarms = useCallback(async () => {
    setExactAlarms(await requestExactAlarmPermission());
    void rescheduleReminders();
  }, []);

  return { state, exactAlarms, request, requestExactAlarms };
}
