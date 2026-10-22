import { parseFormatAction, sameFormatState, styleVar, tokenFromVar } from '../format';

describe('sameFormatState', () => {
  it('trata ausente y false como iguales', () => {
    expect(sameFormatState({}, { bold: false, italic: false })).toBe(true);
  });

  it('detecta un formato que cambia', () => {
    expect(sameFormatState({ bold: true }, { bold: false })).toBe(false);
    expect(sameFormatState({ heading1: true }, { heading2: true })).toBe(false);
  });
});

describe('estilos con valor', () => {
  it('compara también color, resaltado, fuente y tamaño', () => {
    expect(sameFormatState({ textColor: 'red' }, { textColor: 'red' })).toBe(true);
    expect(sameFormatState({ textColor: 'red' }, {})).toBe(false);
    expect(sameFormatState({ fontSize: null }, {})).toBe(true);
  });

  it('valida las acciones que cruzan el puente de la webview', () => {
    expect(parseFormatAction('bold')).toBe('bold');
    expect(parseFormatAction({ style: 'textColor', value: 'red' })).toEqual({
      style: 'textColor',
      value: 'red',
    });
    expect(parseFormatAction({ style: 'highlight', value: null })).toEqual({
      style: 'highlight',
      value: null,
    });
    expect(parseFormatAction('rm -rf')).toBeNull();
    expect(parseFormatAction({ style: 'textColor', value: 'url(evil)' })).toBeNull();
    expect(parseFormatAction({ style: 'onclick', value: 'red' })).toBeNull();
  });

  it('convierte tokens en variables CSS y solo reconoce las suyas', () => {
    expect(styleVar('textColor', 'red')).toBe('var(--lv-text-red)');
    expect(tokenFromVar('textColor', 'var(--lv-text-red)')).toBe('red');
    expect(tokenFromVar('highlight', 'var(--lv-mark-yellow)')).toBe('yellow');
    expect(tokenFromVar('textColor', '#ff0000')).toBeNull();
    expect(tokenFromVar('fontSize', undefined)).toBeNull();
  });
});
