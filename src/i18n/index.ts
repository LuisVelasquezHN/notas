import { getLocales } from 'expo-localization';
import { createInstance, type TFunction } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en';
import es from './locales/es';

export const LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
export type LanguagePreference = 'system' | Language;

/** Nombre de cada idioma en su propio idioma (no se traduce). */
export const LANGUAGE_NAMES: Record<Language, string> = { es: 'Español', en: 'English' };

const isLanguage = (value: unknown): value is Language =>
  typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);

/** Primer idioma del sistema que la app sabe hablar; si no hay ninguno, inglés. */
export function systemLanguage(): Language {
  for (const locale of getLocales()) {
    if (isLanguage(locale.languageCode)) return locale.languageCode;
  }
  return 'en';
}

export function resolveLanguage(preference: LanguagePreference): Language {
  return preference === 'system' ? systemLanguage() : preference;
}

const i18n = createInstance();

// `initAsync: false`: con los recursos ya cargados, la inicialización es síncrona y `t` funciona
// desde el primer render (y en código fuera de React, como el scheduler de recordatorios).
void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: systemLanguage(),
  fallbackLng: 'es',
  supportedLngs: LANGUAGES,
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});

/** Aplica la preferencia de idioma. Devuelve el idioma resultante. */
export function applyLanguage(preference: LanguagePreference): Language {
  const language = resolveLanguage(preference);
  if (i18n.language !== language) void i18n.changeLanguage(language);
  return language;
}

/** Idioma actual, para `Intl` y `toLocale*String`. */
export function currentLocale(): Language {
  return isLanguage(i18n.language) ? i18n.language : 'es';
}

/**
 * `t` global, para código fuera de los componentes (acciones, notificaciones, diálogos).
 * En el render se usa `useTranslation()`: los helpers que formatean texto reciben ese `t` para
 * que el React Compiler los vuelva a calcular al cambiar de idioma.
 */
export const t: TFunction = i18n.t.bind(i18n);

export type { TFunction };
export default i18n;
