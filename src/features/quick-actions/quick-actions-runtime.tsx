import * as QuickActions from 'expo-quick-actions';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { capabilities } from '@/lib/capabilities';

/**
 * Acciones rápidas del icono de la app (mantener pulsado): iOS y Android.
 * Cada acción lleva un `href` de Expo Router; las de crear pasan por la ruta `/new`.
 * En iOS los iconos son SF Symbols; en Android, sin icono propio por ahora (pendiente, ver PLAN.md).
 */
const ACTIONS: QuickActions.Action[] = [
  {
    id: 'new-note',
    title: 'Nueva nota',
    icon: ios('symbol:square.and.pencil'),
    params: { href: '/new?kind=text' },
  },
  {
    id: 'new-checklist',
    title: 'Nueva lista',
    icon: ios('symbol:checklist'),
    params: { href: '/new?kind=checklist' },
  },
  {
    id: 'new-voice',
    title: 'Nota de voz',
    icon: ios('symbol:mic'),
    params: { href: '/new?kind=voice' },
  },
  {
    // Apple recomienda "Buscar" como última acción.
    id: 'search',
    title: 'Buscar',
    icon: ios('symbol:magnifyingglass'),
    params: { href: '/search' },
  },
];

function ios(icon: string) {
  return Platform.OS === 'ios' ? icon : null;
}

/** La acción que abrió la app se atiende una sola vez (no otra vez con recargas en desarrollo). */
let initialHandled = false;

export function QuickActionsRuntime() {
  return capabilities.quickActions ? <NativeQuickActions /> : null;
}

function NativeQuickActions() {
  useEffect(() => {
    void QuickActions.setItems(ACTIONS).catch((e: unknown) =>
      console.warn('Acciones rápidas: no se pudieron registrar', e),
    );

    const handle = (action: QuickActions.Action) => {
      const href = action.params?.href;
      // Tras el primer render del navegador (si la acción abrió la app).
      if (typeof href === 'string') setTimeout(() => router.push(href as Href));
    };
    if (QuickActions.initial && !initialHandled) {
      initialHandled = true;
      handle(QuickActions.initial);
    }
    const sub = QuickActions.addListener(handle);
    return () => sub.remove();
  }, []);
  return null;
}
