import en from '@/i18n/locales/en';
import es from '@/i18n/locales/es';

import { NOTE_COLOR_TOKENS, isNoteColor, noteColors } from '../tokens';

describe('colores de nota', () => {
  it('cada token tiene color claro, oscuro y etiqueta', () => {
    for (const token of NOTE_COLOR_TOKENS) {
      expect(noteColors.light[token]).toMatch(/^#[0-9A-F]{6}$/i);
      expect(noteColors.dark[token]).toMatch(/^#[0-9A-F]{6}$/i);
      expect(es.colors[token]).toBeTruthy();
      expect(en.colors[token]).toBeTruthy();
    }
  });

  it('valida tokens', () => {
    expect(isNoteColor('yellow')).toBe(true);
    expect(isNoteColor('#FFFF00')).toBe(false);
    expect(isNoteColor(undefined)).toBe(false);
  });
});
