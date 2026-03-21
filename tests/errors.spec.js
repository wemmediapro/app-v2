// Tests gestion des erreurs — GNV OnBoard
import { test, expect } from '@playwright/test';
import { acceptConditions } from './fixtures.js';

test.describe('Gestion des erreurs', () => {
  test('route inconnue redirige ou affiche une page cohérente', async ({ page }) => {
    await page.goto('/unknown-page', { waitUntil: 'domcontentloaded' });
    await acceptConditions(page);
    await page.waitForTimeout(2000);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 8000 });
    const path = await page.evaluate(() => {
      const p = new URL(window.location.href).pathname.replace(/\/+$/, '') || '/';
      return p === '' ? '/' : p;
    });
    const isHome = path === '/' || path === '';
    const isKnownPage = /^\/(magazine|restaurant|webtv|movies|radio|shop|favorites|enfant|shipmap|notifications)/.test(
      path
    );
    const isUnknownPath = path.includes('unknown');
    expect(isHome || isKnownPage || isUnknownPath).toBeTruthy();
  });

  test('pas de page blanche avec erreur React visible après chargement home', async ({ page }) => {
    await page.goto('/');
    await acceptConditions(page);
    await page.waitForTimeout(2000);
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/Minified React error|Error: Minified/);
  });
});
