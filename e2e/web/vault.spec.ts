import { expect, test } from '@playwright/test';

import { skipOnboarding } from './helpers';

test('notas seguras: crear la bóveda, bloquear y desbloquear con la contraseña', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await skipOnboarding(page);
  await page.goto('/vault');

  await page.getByTestId('vault-password').fill('frase de prueba larga');
  await page.getByTestId('vault-password-confirm').fill('frase de prueba larga');
  await page.getByTestId('vault-create').click();

  await page.getByTestId('vault-new-note').click();
  await page.getByTestId('secure-note-title').fill('AWS root');
  await page.getByRole('textbox', { name: 'Contenido de la nota' }).click();
  await page.keyboard.type('clave: Hunter2-Prueba');
  await page.goBack();
  await expect(page.getByText('AWS root')).toBeVisible();

  await page.getByRole('button', { name: 'Bloquear' }).click();
  await page.getByTestId('vault-unlock-password').fill('contraseña equivocada');
  await page.getByTestId('vault-unlock').click();
  await expect(page.getByText('Contraseña incorrecta')).toBeVisible();

  await page.getByTestId('vault-unlock-password').fill('frase de prueba larga');
  await page.getByTestId('vault-unlock').click();
  await page.getByText('AWS root').click();
  await expect(page.getByText('clave: Hunter2-Prueba')).toBeVisible();
});
