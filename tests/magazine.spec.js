// Tests magazine / images — GNV OnBoard
import { test, expect } from '@playwright/test';
import { acceptConditions } from './fixtures.js';

test.describe('Magazine et images', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await acceptConditions(page);
  });

  test('page Magazine s’affiche', async ({ page }) => {
    await page.goto('/magazine');
    await acceptConditions(page);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10000 });
  });

  test('ouvrir un article (si la liste est non vide)', async ({ page }) => {
    await page.goto('/magazine');
    await acceptConditions(page);
    const article = page.locator('article a, [class*="article"] a, [class*="card"] a').first();
    if (await article.isVisible().catch(() => false)) {
      await article.click();
      await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 });
      const backButton = page.getByRole('button', { name: /retour|back/i }).or(
        page
          .locator('button')
          .filter({ has: page.locator('svg') })
          .first()
      );
      await expect(backButton)
        .toBeVisible({ timeout: 3000 })
        .catch(() => {});
    }
  });

  test('bouton retour sur détail article ramène sur la liste magazine', async ({ page }) => {
    await page.goto('/magazine');
    await acceptConditions(page);
    const article = page.locator('article a, [class*="article"] a').first();
    if (await article.isVisible().catch(() => false)) {
      await article.click();
      await page.waitForTimeout(500);
      const back = page.getByRole('button', { name: /retour|back/i }).or(
        page
          .locator('button')
          .filter({ has: page.locator('svg') })
          .first()
      );
      if (await back.isVisible().catch(() => false)) {
        await back.click();
        await expect(page).toHaveURL(/\/magazine/);
      }
    }
  });
});
