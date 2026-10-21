import { useSyncExternalStore } from 'react';

/**
 * Instalar la web como app de escritorio (PWA, ver `public/manifest.json`). Chrome y Edge lanzan
 * `beforeinstallprompt` pronto, a veces antes de abrir Ajustes: se escucha al cargar el módulo
 * (se importa desde el layout raíz) y se guarda para mostrar el botón cuando haga falta.
 */
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const isStandalone = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches;

export function useInstallPrompt() {
  const event = useSyncExternalStore(
    subscribe,
    () => deferred,
    () => null,
  );
  return {
    available: event !== null,
    /** Ya se está usando instalada (ventana propia): no se ofrece instalar. */
    installed: isStandalone(),
    prompt: event
      ? async () => {
          await event.prompt();
          deferred = null;
          notify();
        }
      : null,
  };
}
