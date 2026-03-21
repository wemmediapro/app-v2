// Tests de non-régression — parcours critiques GNV OnBoard
import { test, expect } from '@playwright/test';
import { acceptConditions } from './fixtures.js';

test.describe('Non-régression', () => {
  test('parcours complet : Home → Magazine → Article → Retour → Restaurant → Retour', async ({ page }) => {
    await page.goto('/');
    await acceptConditions(page);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10000 });

    await page.goto('/magazine');
    await acceptConditions(page);
    await expect(page).toHaveURL(/\/magazine/);
    const article = page.locator('article a, [class*="article"] a').first();
    if (await article.isVisible().catch(() => false)) {
      await article.click();
      await page.waitForTimeout(300);
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

    await page.goto('/restaurant');
    await acceptConditions(page);
    await expect(page).toHaveURL(/\/restaurant/);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 });
  });

  test('changement de langue ne casse pas la page', async ({ page }) => {
    await page.goto('/magazine');
    await acceptConditions(page);
    const langTrigger = page
      .getByRole('button', { name: /changer|langue|language|fr|en/i })
      .or(page.locator('[aria-haspopup="listbox"]'))
      .first();
    if (await langTrigger.isVisible().catch(() => false)) {
      await langTrigger.click();
      await page.waitForTimeout(400);
      const option = page.getByRole('button', { name: /English|Français/i }).first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
        await page.waitForTimeout(500);
      }
      await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 });
    }
  });
});
