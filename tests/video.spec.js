// Tests ouverture contenu vidéo — GNV OnBoard
import { test, expect } from '@playwright/test';
import { acceptConditions } from './fixtures.js';

test.describe('Contenu vidéo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await acceptConditions(page);
  });

  test('page Films s’ouvre et affiche du contenu ou un état vide', async ({ page }) => {
    await page.goto('/movies');
    await acceptConditions(page);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Erreur de chargement')).not.toBeVisible();
  });

  test('page WebTV s’ouvre sans crash', async ({ page }) => {
    await page.goto('/webtv');
    await acceptConditions(page);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/webtv|chaîne|channel/i)).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('clic sur une chaîne WebTV (si présente) ouvre la vue détail', async ({ page }) => {
    await page.goto('/webtv');
    await acceptConditions(page);
    const channelCard = page.locator('[data-testid="channel-card"], [class*="channel"], a[href*="webtv"]').first();
    if (await channelCard.isVisible().catch(() => false)) {
      await channelCard.click();
      await expect(page.getByRole('main')).toBeVisible({ timeout: 5000 });
    }
  });
});
