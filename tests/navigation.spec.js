// Tests navigation entre pages — GNV OnBoard
import { test, expect } from '@playwright/test';
import { acceptConditions } from './fixtures.js';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await acceptConditions(page);
  });

  test('deep link /magazine affiche la page magazine', async ({ page }) => {
    await page.goto('/magazine');
    await acceptConditions(page);
    await expect(page).toHaveURL(/\/magazine/);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 });
  });

  test('deep link /restaurant affiche la page restaurants', async ({ page }) => {
    await page.goto('/restaurant');
    await acceptConditions(page);
    await expect(page).toHaveURL(/\/restaurant/);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 });
  });

  test('deep link /webtv affiche la page webtv', async ({ page }) => {
    await page.goto('/webtv');
    await acceptConditions(page);
    await expect(page).toHaveURL(/\/webtv/);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 });
  });

  test('navigation par boutons bottom nav vers radio puis movies', async ({ page }) => {
    await page.getByRole('button', { name: /radio/i }).first().click();
    await expect(page).toHaveURL(/\/radio/);

    await page
      .getByRole('button', { name: /films|séries|movies/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/movies/);
  });

  test('retour navigateur après navigation', async ({ page }) => {
    await page.goto('/magazine');
    await acceptConditions(page);
    await page.goto('/restaurant');
    await acceptConditions(page);
    await page.goBack();
    await expect(page).toHaveURL(/\/magazine/);
  });
});
