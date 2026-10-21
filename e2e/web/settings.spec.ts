import { expect, test } from '@playwright/test';

import { skipOnboarding } from './helpers';

test('cambia el idioma al momento', async ({ page }) => {
  await skipOnboarding(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
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
