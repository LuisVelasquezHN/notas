import { normalizeSupabaseUrl } from '../url';

describe('normalizeSupabaseUrl', () => {
  it('quita la ruta del API REST y las barras finales', () => {
    const base = 'https://abc.supabase.co';
    expect(normalizeSupabaseUrl(base)).toBe(base);
    expect(normalizeSupabaseUrl(`${base}/`)).toBe(base);
    expect(normalizeSupabaseUrl(`${base}/rest/v1/`)).toBe(base);
    expect(normalizeSupabaseUrl(` ${base}/rest/v1 `)).toBe(base);
    expect(normalizeSupabaseUrl('')).toBeUndefined();
    expect(normalizeSupabaseUrl(undefined)).toBeUndefined();
  });
});
