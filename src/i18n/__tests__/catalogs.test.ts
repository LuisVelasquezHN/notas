import { recurrenceLabel } from '@/features/reminders/recurrence';
import { formatRelativeDate } from '@/lib/dates';

import { applyLanguage, currentLocale, resolveLanguage, t } from '..';
import en from '../locales/en';
import es from '../locales/es';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const variables = (text: string) => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();

describe('catálogos', () => {
  const flatEs = flatten(es);
  const flatEn = flatten(en);

  it('tienen las mismas claves', () => {
    expect(Object.keys(flatEn).sort()).toEqual(Object.keys(flatEs).sort());
  });

  it('usan las mismas variables en cada texto', () => {
    for (const key of Object.keys(flatEs)) {
      expect([key, variables(flatEn[key])]).toEqual([key, variables(flatEs[key])]);
    }
  });

  it('ningún texto está vacío', () => {
    for (const [key, value] of [...Object.entries(flatEs), ...Object.entries(flatEn)]) {
      expect([key, value.trim().length > 0]).toEqual([key, true]);
    }
  });

  it('los plurales tienen forma singular y plural', () => {
    for (const key of Object.keys(flatEs)) {
      if (key.endsWith('_one')) expect(flatEs[key.replace(/_one$/, '_other')]).toBeDefined();
      if (key.endsWith('_other')) expect(flatEs[key.replace(/_other$/, '_one')]).toBeDefined();
    }
  });
});

describe('idioma', () => {
  afterEach(() => applyLanguage('es'));

  it('resuelve la preferencia', () => {
    expect(resolveLanguage('en')).toBe('en');
    expect(resolveLanguage('es')).toBe('es');
    expect(['es', 'en']).toContain(resolveLanguage('system'));
  });

  it('cambia los textos y el formato al cambiar de idioma', () => {
    const now = new Date(2026, 9, 18, 15, 0).getTime();
    expect(t('common.undo')).toBe('Deshacer');
    expect(t('noteActions.archived', { count: 3 })).toBe('3 notas archivadas');

    applyLanguage('en');
    expect(currentLocale()).toBe('en');
    expect(t('common.undo')).toBe('Undo');
    expect(t('noteActions.archived', { count: 1 })).toBe('Note archived');
    expect(formatRelativeDate(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(recurrenceLabel('weekly', { year: 2026, month: 9, day: 19, hour: 9, minute: 0 })).toBe(
      'Every week on Monday',
    );
  });
});
