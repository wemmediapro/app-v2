// Fixtures et helpers partagés — GNV OnBoard
import { test as base } from '@playwright/test';

/**
 * Accepte les conditions d'utilisation (CGU) pour accéder à l'app.
 * Coche la case puis clique sur le bouton (obligatoire pour que le formulaire soumette).
 */
export async function acceptConditions(page) {
  const checkbox = page.locator('#accept-conditions');
  const acceptButton = page.getByRole('button', { name: /accepter|accept/i });
  if (await acceptButton.isVisible().catch(() => false)) {
    await checkbox.check().catch(() => {});
    await acceptButton.click();
    await page.waitForURL(/\/(\?|$)/, { waitUntil: 'networkidle' }).catch(() => {});
  }
}

export const test = base.extend({
  pageWithConditions: async ({ page }, use) => {
    await page.goto('/');
    await acceptConditions(page);
    await use(page);
  },
});

export { expect } from '@playwright/test';
