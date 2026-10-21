// expo-sqlite/kv-store necesita el módulo nativo: en tests usamos un almacén en memoria.
jest.mock('@/lib/kv-storage', () => {
  const store = new Map();
  return {
    kvStorage: {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    },
    warmUpKvStorage: async () => {},
  };
});

// Los tests comprueban los textos en español (el catálogo de referencia) salvo que cambien de idioma.
beforeEach(() => {
  require('@/i18n').applyLanguage('es');
});
