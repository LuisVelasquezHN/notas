import { AppState, Platform } from 'react-native';

import { useSettingsStore } from '@/stores/settings-store';

import { applyLanguage } from './index';

let started = false;

function apply() {
  const language = applyLanguage(useSettingsStore.getState().language);
  // Lectores de pantalla y traductores del navegador.
  if (Platform.OS === 'web') document.documentElement.lang = language;
}

/**
 * Mantiene el idioma de la app al día con la preferencia guardada y, con "Sistema", con el idioma
 * del dispositivo (en Android se puede cambiar sin cerrar la app). Se llama una vez al arrancar,
 * tras hidratar los ajustes.
 */
export function syncLanguageWithSettings() {
  apply();
  if (started) return;
  started = true;
  useSettingsStore.subscribe((state, previous) => {
    if (state.language !== previous.language) apply();
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active' && useSettingsStore.getState().language === 'system') apply();
  });
}
