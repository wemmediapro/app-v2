// Tests accès dashboard admin — GNV OnBoard (dashboard sur port séparé)
// À lancer avec le dashboard sur 5174 : PLAYWRIGHT_DASHBOARD_URL=http://localhost:5174 npx playwright test tests/dashboard-auth.spec.js
import { test, expect } from '@playwright/test';

const DASHBOARD_URL = process.env.PLAYWRIGHT_DASHBOARD_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174';
const isDashboardTarget = !!process.env.PLAYWRIGHT_DASHBOARD_URL || (process.env.PLAYWRIGHT_BASE_URL && process.env.PLAYWRIGHT_BASE_URL.includes('5174'));

test.describe('Dashboard admin', () => {
  test.use({ baseURL: DASHBOARD_URL });
  test.beforeEach(() => {
    test.skip(!isDashboardTarget, 'Dashboard tests require PLAYWRIGHT_DASHBOARD_URL or PLAYWRIGHT_BASE_URL=...5174 (dashboard server on 5174)');
  });

  test('sans auth, redirection vers login ou formulaire visible', async ({ page }) => {
    await page.goto('/dashboard/');
    await expect(page.getByRole('heading', { name: /connexion|login|sign in|gnv dashboard/i }).first()).toBeVisible({ timeout: 10000 });
  });

  test('page login contient email et mot de passe', async ({ page }) => {
    await page.goto('/dashboard/login');
    await expect(page.getByRole('form', { name: /connexion/i })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input#email')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input#password')).toBeVisible({ timeout: 5000 });
  });
});
