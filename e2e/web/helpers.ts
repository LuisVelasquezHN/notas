import { expect, type Page } from '@playwright/test';

/** Primer arranque: salta la presentación y espera a la lista de notas. */
export async function skipOnboarding(page: Page) {
  await page.goto('/');
  await page.getByTestId('onboarding-skip').click();
  await expect(page.getByTestId('new-note')).toBeVisible();
}

/** Crea una nota de texto con ese título y vuelve a la lista. */
export async function createTextNote(page: Page, title: string) {
  await page.getByTestId('new-note').click();
  await page.getByTestId('note-title').fill(title);
  await page.goBack();
  await expect(page.getByTestId('note-card').filter({ hasText: title })).toBeVisible();
}
