import 'i18next';

import type es from './locales/es';

// Claves tipadas: `t('notes.title')` se comprueba contra el catálogo en español.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof es };
  }
}
