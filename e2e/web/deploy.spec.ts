import { expect, test } from '@playwright/test';

// SQLite en web usa la API síncrona (SharedArrayBuffer): sin estas cabeceras la app no arranca.
test('sirve las cabeceras de aislamiento en todas las rutas', async ({ request }) => {
  for (const path of ['/', '/note/0192', '/privacy']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()['cross-origin-opener-policy'], path).toBe('same-origin');
    expect(response.headers()['cross-origin-embedder-policy'], path).toBe('credentialless');
  }
});

test('la página está aislada y abre la base de datos', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('onboarding-skip')).toBeVisible();
  expect(await page.evaluate(() => self.crossOriginIsolated)).toBe(true);
});

// OPFS solo admite una conexión por fichero: la segunda pestaña espera a que se cierre la primera.
test('una segunda pestaña espera y continúa al cerrar la primera', async ({ context }) => {
  const first = await context.newPage();
  await first.goto('/');
  await expect(first.getByTestId('onboarding-skip')).toBeVisible();

  const second = await context.newPage();
  await second.goto('/');
  await expect(second.getByText('LV Notes ya está abierta en otra pestaña')).toBeVisible();

  await first.close();
  await expect(second.getByTestId('onboarding-skip')).toBeVisible();
});
