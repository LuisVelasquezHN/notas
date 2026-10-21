import { defineConfig, devices } from '@playwright/test';

const PORT = 8090;

/**
 * E2E de la web contra la compilación de producción (`expo export` + `expo serve`), la misma que
 * se publica en EAS Hosting: así también se comprueban las cabeceras COOP/COEP que necesita SQLite.
 * Las pruebas de iOS y Android están en `.maestro/`.
 */
export default defineConfig({
  testDir: './e2e/web',
  // En serie: con varias páginas arrancando a la vez y la CPU saturada, la API síncrona de
  // expo-sqlite en web agota su espera ("Sync operation timeout") y la app no llega a abrir.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // La app sigue el idioma del navegador: las pruebas usan el español (catálogo de referencia).
    locale: 'es-ES',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx expo export -p web && npx expo serve --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
});
