const mockState = {
  notes: 0,
  pending: false,
  kv: new Map<string, string>(),
  confirmAnswer: true,
  session: null as null | { user: { id: string; email: string; user_metadata: object } },
};
const mockCalls: string[] = [];

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (k: string) => mockState.kv.get(k) ?? null,
    setItemSync: (k: string, v: string) => mockState.kv.set(k, v),
    removeItemSync: (k: string) => mockState.kv.delete(k),
  },
}));
jest.mock('@/db/client', () => ({
  openDatabase: async (scope: string) => {
    mockCalls.push(`open:${scope}`);
    return {};
  },
}));
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({ migrate: async () => {} }));
jest.mock('../../../../drizzle/migrations', () => ({}));
jest.mock('@/features/backup/backup', () => ({
  buildBackup: async () => {
    mockCalls.push('backup');
    return { data: 'copia' };
  },
}));
jest.mock('@/features/vault/store', () => ({ lockVault: () => mockCalls.push('lockVault') }));
jest.mock('@/lib/confirm', () => ({
  confirm: async () => {
    mockCalls.push('confirm');
    return mockState.confirmAnswer;
  },
}));
jest.mock('../engine', () => ({
  LEGACY_OWNER_KEY: 'sync.userId',
  clearLocalData: async () => mockCalls.push('clear'),
  hasPendingChanges: async () => mockState.pending,
  localNoteCount: async () => mockState.notes,
}));
jest.mock('../pending-import', () => ({
  setPendingImport: () => mockCalls.push('pendingImport'),
}));
jest.mock('../supabase', () => ({
  isSyncConfigured: true,
  getSupabase: () => ({
    auth: { getSession: async () => ({ data: { session: mockState.session } }) },
  }),
}));
jest.mock('../auth', () => ({
  accountFromSession: (s: { user: { id: string; email: string } } | null) =>
    s ? { id: s.user.id, email: s.user.email, name: null } : null,
}));

// eslint-disable-next-line import/first
import { resolveInitialScope, scopeForSessionChange } from '../account-scope';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const account = (id: string) => ({ id, email: `${id.slice(0, 4)}@x.com`, name: null });

beforeEach(() => {
  mockCalls.length = 0;
  mockState.notes = 0;
  mockState.pending = false;
  mockState.kv.clear();
  mockState.confirmAnswer = true;
  mockState.session = null;
});

describe('cambio de sesión', () => {
  it('entrar sin notas sin cuenta: cambia de base de datos sin preguntar', async () => {
    expect(await scopeForSessionChange(account(A), 'guest')).toBe(A);
    expect(mockCalls).toEqual(['lockVault']);
  });

  it('entrar con notas sin cuenta: pregunta; si se acepta, las pasa a la cuenta', async () => {
    mockState.notes = 3;
    expect(await scopeForSessionChange(account(A), 'guest')).toBe(A);
    expect(mockCalls).toEqual(['confirm', 'backup', 'pendingImport', 'clear', 'lockVault']);
  });

  it('si no se acepta, se quedan sin cuenta (no se suben)', async () => {
    mockState.notes = 3;
    mockState.confirmAnswer = false;
    expect(await scopeForSessionChange(account(A), 'guest')).toBe(A);
    expect(mockCalls).toEqual(['confirm', 'lockVault']);
  });

  it('de una cuenta a otra nunca pasa datos: cada una tiene su base de datos', async () => {
    mockState.notes = 5;
    expect(await scopeForSessionChange(account(B), A)).toBe(B);
    expect(mockCalls).toEqual(['lockVault']);
  });

  it('al salir (o caducar la sesión) vuelve a la base de datos sin cuenta', async () => {
    expect(await scopeForSessionChange(null, A)).toBe('guest');
  });
});

describe('migración desde una sola base de datos', () => {
  it('sin dueño: los datos son de uso sin cuenta', async () => {
    expect(await resolveInitialScope()).toEqual({ account: null, scope: 'guest' });
    expect(mockCalls).toEqual([]);
  });

  it('el dueño tiene sesión: sus datos pasan a su base de datos', async () => {
    mockState.kv.set('sync.userId', A);
    mockState.session = { user: { id: A, email: 'a@x.com', user_metadata: {} } };
    expect((await resolveInitialScope()).scope).toBe(A);
    expect(mockCalls).toEqual(['open:guest', 'backup', 'pendingImport', 'clear']);
    expect(mockState.kv.has('sync.userId')).toBe(false);
  });

  it('el dueño no tiene sesión y todo estaba en la nube: se quitan del dispositivo', async () => {
    mockState.kv.set('sync.userId', A);
    expect((await resolveInitialScope()).scope).toBe('guest');
    expect(mockCalls).toEqual(['open:guest', 'clear']);
  });

  it('el dueño no tiene sesión y había cambios sin subir: no se pierden', async () => {
    mockState.kv.set('sync.userId', A);
    mockState.pending = true;
    expect((await resolveInitialScope()).scope).toBe('guest');
    expect(mockCalls).toEqual(['open:guest']);
  });
});
