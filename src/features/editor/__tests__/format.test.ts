import { sameFormatState } from '../format';

describe('sameFormatState', () => {
  it('trata ausente y false como iguales', () => {
    expect(sameFormatState({}, { bold: false, italic: false })).toBe(true);
  });

  it('detecta un formato que cambia', () => {
    expect(sameFormatState({ bold: true }, { bold: false })).toBe(false);
    expect(sameFormatState({ heading1: true }, { heading2: true })).toBe(false);
  });
});
