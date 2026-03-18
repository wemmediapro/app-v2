// Tests chargement Home — GNV OnBoard
import { test, expect } from '@playwright/test';
import { acceptConditions } from './fixtures.js';

test.describe('Chargement Home', () => {
  test('affiche l’écran CGU au premier chargement', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /conditions/i })).toBeVisible({ timeout: 15000 });
  });

  test('après acceptation CGU, la home s’affiche', async ({ page }) => {
    await page.goto('/');
    await acceptConditions(page);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/(\?|$)/);
  });

  test('home contient une zone principale et pas d’erreur visible', async ({ page }) => {
    await page.goto('/');
    await acceptConditions(page);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Erreur de chargement')).not.toBeVisible();
  });

  test('temps de chargement home raisonnable', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await acceptConditions(page);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15000 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(15000);
  });
});
