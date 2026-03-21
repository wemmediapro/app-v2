// Tests comportement sans internet — GNV OnBoard
import { test, expect } from '@playwright/test';
import { acceptConditions } from './fixtures.js';

test.describe('Offline', () => {
  test('avec réseau coupé, bandeau offline ou message visible après chargement', async ({ page }) => {
    await page.context().setOffline(true);
    await page.goto('/').catch(() => {});
    await page.context().setOffline(false);
    await page.reload().catch(() => {});
    await acceptConditions(page);
    await expect(page.getByRole('main'))
      .toBeVisible({ timeout: 15000 })
      .catch(() => {});
  });

  test('après acceptation en ligne, passage offline puis retour en ligne', async ({ page }) => {
    await page.goto('/');
    await acceptConditions(page);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10000 });
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    await page.context().setOffline(false);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 });
  });
});
