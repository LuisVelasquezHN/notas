import { kvStorage } from '@/lib/kv-storage';

import { useSettingsStore } from '../settings-store';

describe('ajustes', () => {
  it('quien ya usaba la app (v1) no ve la presentación', async () => {
    await kvStorage.setItem(
      'settings',
      JSON.stringify({ state: { theme: 'dark', notesLayout: 'list' }, version: 1 }),
    );
    await useSettingsStore.persist.rehydrate();
    const state = useSettingsStore.getState();
    expect(state.onboarded).toBe(true);
    expect(state.theme).toBe('dark');
    expect(state.language).toBe('system');
    expect(state.appLock).toBe(false);
  });

  it('una instalación nueva empieza con la presentación', async () => {
    await kvStorage.removeItem('settings');
    useSettingsStore.setState({ onboarded: false });
    await useSettingsStore.persist.rehydrate();
    expect(useSettingsStore.getState().onboarded).toBe(false);
  });
});
