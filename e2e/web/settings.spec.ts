import { expect, test } from '@playwright/test';

import { skipOnboarding } from './helpers';

test('cambia el idioma al momento', async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('las pestañas se desplazan en una ventana baja', async ({ page }) => {
  // El contenedor de las pestañas crecía con el contenido y Ajustes no bajaba (escritorio).
  await page.setViewportSize({ width: 1280, height: 500 });
  await skipOnboarding(page);
  await page.goto('/settings');
  const last = page.getByText('Ver la presentación');
  await expect(last).not.toBeInViewport();
  await page.mouse.move(640, 300);
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 400);
  await expect(last).toBeInViewport();
});

test('la política de privacidad es pública', async ({ page }) => {
  // Sin pasar por la presentación: es la URL que enlazan las fichas de las tiendas.
  await page.goto('/privacy');
  await expect(page.getByText('Tus notas están en tu dispositivo')).toBeVisible();
  await expect(page).toHaveURL(/\/privacy$/);
});

test.describe('en inglés', () => {
  test.use({ locale: 'en-US' });

  test('la política de privacidad sigue el idioma del navegador', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByText('Your notes live on your device')).toBeVisible();
  });
});
