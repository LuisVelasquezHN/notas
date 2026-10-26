import { GUEST_SCOPE, attachmentsDirName, databaseName, scopeForAccount } from '../scope';

const ID = '3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b';

describe('ámbitos de datos', () => {
  it('cada cuenta tiene su base de datos y su carpeta; sin cuenta, las de siempre', () => {
    expect(scopeForAccount(null)).toBe(GUEST_SCOPE);
    expect(databaseName(GUEST_SCOPE)).toBe('notas.db');
    expect(attachmentsDirName(GUEST_SCOPE)).toBe('attachments');
    expect(databaseName(scopeForAccount(ID))).toBe(`notas-${ID}.db`);
    expect(attachmentsDirName(scopeForAccount(ID))).toBe(`attachments/${ID}`);
  });

  it('rechaza ids que no son UUID (forman parte de nombres de fichero)', () => {
    expect(() => scopeForAccount('../../x')).toThrow();
    expect(() => scopeForAccount('guest')).toThrow();
  });
});
