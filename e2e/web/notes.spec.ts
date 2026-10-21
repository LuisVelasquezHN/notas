import { expect, test } from '@playwright/test';

import { createTextNote, skipOnboarding } from './helpers';

test.beforeEach(async ({ page }) => {
  await skipOnboarding(page);
});

test('la presentación no vuelve a aparecer', async ({ page }) => {
  await page.reload();
  await expect(page.getByTestId('new-note')).toBeVisible();
  await expect(page).not.toHaveURL(/onboarding/);
});

test('crea una nota y sigue ahí tras recargar', async ({ page }) => {
  await createTextNote(page, 'Ideas para el viaje');
  await page.reload();
  await expect(
    page.getByTestId('note-card').filter({ hasText: 'Ideas para el viaje' }),
  ).toBeVisible();
});

test('busca una nota por el título', async ({ page }) => {
  await createTextNote(page, 'Presupuesto de octubre');
  await createTextNote(page, 'Lista de libros');
  await page.getByTestId('open-search').click();
  await page.getByTestId('search-input').fill('presupuesto');
  // La lista de notas sigue montada (oculta) bajo la búsqueda: solo cuentan las tarjetas visibles.
  const results = page.getByTestId('note-card').filter({ visible: true });
  await expect(results).toHaveCount(1);
  await expect(results).toContainText('Presupuesto de octubre');
});

test('crea una lista y marca un elemento', async ({ page }) => {
  await page.getByTestId('new-checklist').click();
  await page.getByTestId('note-title').fill('Compra');
  await page.getByTestId('checklist-add-item').click();
  const items = page.getByTestId('checklist-item-input');
  await items.first().fill('Leche');
  await items.first().press('Enter');
  await items.nth(1).fill('Pan');
  await page.getByTestId('checklist-item-toggle').first().click();
  await expect(page.getByRole('checkbox', { name: 'Leche' })).toBeChecked();
  await page.goBack();
  const card = page.getByTestId('note-card').filter({ hasText: 'Compra' });
  await expect(card).toContainText('Pan');
});
