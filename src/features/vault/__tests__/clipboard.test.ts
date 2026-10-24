const mockClipboard = { value: '' };
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async (v: string) => {
    mockClipboard.value = v;
    return true;
  }),
  getStringAsync: jest.fn(async () => mockClipboard.value),
}));

// eslint-disable-next-line import/first
import * as Clipboard from 'expo-clipboard';
// eslint-disable-next-line import/first
import { CLIPBOARD_CLEAR_MS, copySecret } from '../clipboard';

describe('copySecret', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('copia marcado como sensible y lo borra pasado el tiempo', async () => {
    await copySecret('Hunter2');
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('Hunter2', {
      android: { isSensitive: true },
    });
    expect(mockClipboard.value).toBe('Hunter2');
    await jest.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);
    expect(mockClipboard.value).toBe('');
  });

  it('no borra lo que el usuario copió después', async () => {
    await copySecret('Hunter2');
    mockClipboard.value = 'otra cosa';
    await jest.advanceTimersByTimeAsync(CLIPBOARD_CLEAR_MS);
    expect(mockClipboard.value).toBe('otra cosa');
  });
});
