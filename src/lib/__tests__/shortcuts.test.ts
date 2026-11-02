import { comboOf } from '../use-shortcuts.web';

const key = (init: Partial<KeyboardEvent>) =>
  ({ ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...init }) as KeyboardEvent;

describe('combinaciones de teclas', () => {
  beforeAll(() => {
    Object.defineProperty(global, 'navigator', {
      value: { platform: 'Win32' },
      configurable: true,
    });
  });

  it('reconoce mod, alt y shift', () => {
    expect(comboOf(key({ ctrlKey: true, key: 'z', code: 'KeyZ' }))).toBe('mod+z');
    expect(comboOf(key({ ctrlKey: true, shiftKey: true, key: 'Z', code: 'KeyZ' }))).toBe(
      'mod+shift+z',
    );
    expect(comboOf(key({ altKey: true, key: '˜', code: 'KeyN' }))).toBe('alt+n');
    expect(comboOf(key({ key: 'Escape', code: 'Escape' }))).toBe('escape');
    expect(comboOf(key({ shiftKey: true, key: '?', code: 'Slash' }))).toBe('?');
    expect(comboOf(key({ shiftKey: true, key: '/', code: 'Slash' }))).toBe('?');
    expect(comboOf(key({ shiftKey: true, key: '?', code: 'Minus' }))).toBe('?');
  });
});
