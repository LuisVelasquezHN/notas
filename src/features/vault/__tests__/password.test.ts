import { randomBytes } from 'node:crypto';

import { PASSWORD_SETS, generatePassword } from '../password';

const random = (n: number) => new Uint8Array(randomBytes(n));

describe('generatePassword', () => {
  it('respeta la longitud y los límites', () => {
    expect(
      generatePassword({ length: 20, upper: true, digits: true, symbols: true }, random),
    ).toHaveLength(20);
    expect(
      generatePassword({ length: 2, upper: false, digits: false, symbols: false }, random),
    ).toHaveLength(8);
    expect(
      generatePassword({ length: 500, upper: true, digits: true, symbols: true }, random),
    ).toHaveLength(64);
  });

  it('incluye al menos un carácter de cada grupo elegido y ninguno de los demás', () => {
    for (let i = 0; i < 200; i++) {
      const pw = generatePassword({ length: 8, upper: true, digits: true, symbols: false }, random);
      expect([...pw].some((c) => PASSWORD_SETS.upper.includes(c))).toBe(true);
      expect([...pw].some((c) => PASSWORD_SETS.digits.includes(c))).toBe(true);
      expect([...pw].some((c) => PASSWORD_SETS.lower.includes(c))).toBe(true);
      expect([...pw].some((c) => PASSWORD_SETS.symbols.includes(c))).toBe(false);
    }
  });

  it('reparte los caracteres de forma uniforme', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 2000; i++) {
      for (const c of generatePassword(
        { length: 64, upper: false, digits: true, symbols: false },
        random,
      )) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    const values = [...counts.values()];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(counts.size).toBe(PASSWORD_SETS.lower.length + PASSWORD_SETS.digits.length);
    // Desviación de cada carácter respecto a la media por debajo del 10 % (128 000 muestras).
    for (const v of values) expect(Math.abs(v - mean) / mean).toBeLessThan(0.1);
  });

  it('descarta los bytes que sesgarían el resultado (muestreo por rechazo)', () => {
    // 33 caracteres posibles: 256 % 33 = 25, así que los bytes ≥ 231 se descartan.
    let call = 0;
    const biased = (n: number) => {
      call++;
      return new Uint8Array(n).fill(call === 1 ? 250 : 0);
    };
    const pw = generatePassword({ length: 8, upper: false, digits: true, symbols: false }, biased);
    expect(pw).toHaveLength(8);
  });
});
