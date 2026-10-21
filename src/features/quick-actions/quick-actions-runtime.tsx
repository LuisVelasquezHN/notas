import * as QuickActions from 'expo-quick-actions';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import type { TFunction } from '@/i18n';
import { capabilities } from '@/lib/capabilities';

/**
 * Acciones rápidas del icono de la app (mantener pulsado): iOS y Android.
 * Cada acción lleva un `href` de Expo Router; las de crear pasan por la ruta `/new`.
 * En iOS los iconos son SF Symbols; en Android, sin icono propio por ahora (pendiente, ver PLAN.md).
 * Los títulos se vuelven a registrar al cambiar de idioma.
 */
const actions = (t: TFunction): QuickActions.Action[] => [
  {
    id: 'new-note',
    title: t('newNote.text'),
    icon: ios('symbol:square.and.pencil'),
    params: { href: '/new?kind=text' },
  },
  {
    id: 'new-checklist',
    title: t('newNote.checklist'),
    icon: ios('symbol:checklist'),
    params: { href: '/new?kind=checklist' },
  },
  {
    id: 'new-voice',
    title: t('attachments.voiceNote'),
    icon: ios('symbol:mic'),
    params: { href: '/new?kind=voice' },
  },
  {
    // Apple recomienda "Buscar" como última acción.
    id: 'search',
    title: t('common.search'),
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
  const { t } = useTranslation();

  useEffect(() => {
    void QuickActions.setItems(actions(t)).catch((e: unknown) =>
      console.warn('Acciones rápidas: no se pudieron registrar', e),
    );
  }, [t]);

  useEffect(() => {
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
