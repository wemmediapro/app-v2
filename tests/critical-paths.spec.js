/**
 * Parcours critiques — alignés sur l’app GNV OnBoard réelle.
 *
 * Important : l’acceptation des CGU redirige vers `/` (voir App.jsx). Toujours :
 * `goto('/')` → `acceptConditions` → puis `goto('/restaurant')` etc.
 *
 * Prérequis : frontend :5173, backend :3000.
 *
 * Dashboard (optionnel) : PLAYWRIGHT_DASHBOARD_URL=http://localhost:5174
 * + PLAYWRIGHT_ADMIN_EMAIL + PLAYWRIGHT_ADMIN_PASSWORD
 */
import { test, expect } from '@playwright/test';
import { acceptConditions } from './fixtures.js';

const hasDashboardCreds = !!(process.env.PLAYWRIGHT_ADMIN_EMAIL && process.env.PLAYWRIGHT_ADMIN_PASSWORD);
const DASHBOARD_URL =
  process.env.PLAYWRIGHT_DASHBOARD_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174';
const isDashboardConfigured =
  !!process.env.PLAYWRIGHT_DASHBOARD_URL ||
  (process.env.PLAYWRIGHT_BASE_URL && String(process.env.PLAYWRIGHT_BASE_URL).includes('5174'));

/** CGU puis navigation vers une route (sans repasser par accept qui renverrait à /). */
async function gotoAfterConditions(page, path) {
  await page.goto('/');
  await acceptConditions(page);
  await page.goto(path);
}

test.describe('Critical paths — passagers (5173)', () => {
  // Évite la pression parallèle sur Vite + API locale (flaky sans ça).
  test.describe.configure({ mode: 'serial' });
  test('deep link /signup redirige vers l’accueil (pas d’inscription publique)', async ({ page }) => {
    await page.goto('/signup');
    await expect(page).not.toHaveURL(/\/signup/i, { timeout: 10000 });
    await acceptConditions(page);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 10000 });
  });

  test('accueil : main visible après CGU', async ({ page }) => {
    await page.goto('/');
    await acceptConditions(page);
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15000 });
  });

  test('restaurants : fin de chargement puis cartes ou liste vide', async ({ page }) => {
    await gotoAfterConditions(page, '/restaurant');

    await expect(page.getByTestId('restaurant-list-loading')).toBeHidden({ timeout: 28000 });

    const cards = page.getByTestId('restaurant-card');
    const empty = page.getByTestId('restaurant-list-empty');
    await expect(cards.or(empty).first()).toBeVisible({ timeout: 5000 });
    const n = await cards.count();
    const e = await empty.isVisible().catch(() => false);
    expect(n > 0 || e).toBeTruthy();
  });

  test('restaurants : filtre catégorie (valeur métier pizzeria)', async ({ page }) => {
    await gotoAfterConditions(page, '/restaurant');

    await expect(page.getByTestId('restaurant-list-loading')).toBeHidden({ timeout: 28000 });

    const filter = page.getByTestId('restaurant-category-filter');
    await expect(filter).toBeVisible({ timeout: 5000 });

    const countBefore = await page.getByTestId('restaurant-card').count();
    await filter.selectOption('pizzeria');
    await page.waitForTimeout(400);
    const countAfter = await page.getByTestId('restaurant-card').count();
    expect(countAfter).toBeLessThanOrEqual(countBefore);
  });

  test('magazine : page accessible', async ({ page }) => {
    await gotoAfterConditions(page, '/magazine');
    await expect(page).toHaveURL(/\/magazine/, { timeout: 10000 });
    await expect(page.getByRole('main')).toBeVisible({ timeout: 15000 });
  });

  test('offline : réseau rétabli, main toujours présent', async ({ page }) => {
    await page.goto('/');
    await acceptConditions(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 20000 });
    await page.context().setOffline(true);
    await page.waitForTimeout(400);
    await page.context().setOffline(false);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 20000 });
  });

  test('mobile : viewport étroit, navigation basse visible', async ({ page }) => {
    await page.goto('/');
    await acceptConditions(page);
    await expect(page.locator('main').first()).toBeVisible({ timeout: 20000 });
    await page.setViewportSize({ width: 375, height: 667 });
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible({ timeout: 8000 });
  });
});

test.describe('Critical paths — dashboard admin (5174)', () => {
  test.use({ baseURL: DASHBOARD_URL });

  test.beforeEach(() => {
    test.skip(
      !isDashboardConfigured,
      'Définir PLAYWRIGHT_DASHBOARD_URL=http://localhost:5174 (dashboard démarré séparément)'
    );
    test.skip(!hasDashboardCreds, 'Définir PLAYWRIGHT_ADMIN_EMAIL et PLAYWRIGHT_ADMIN_PASSWORD pour ce test');
  });

  test('connexion admin affiche le tableau de bord', async ({ page }) => {
    await page.goto('/dashboard/login');
    await expect(page.locator('input#email')).toBeVisible({ timeout: 10000 });
    await page.locator('input#email').fill(process.env.PLAYWRIGHT_ADMIN_EMAIL);
    await page.locator('input#password').fill(process.env.PLAYWRIGHT_ADMIN_PASSWORD);
    await page.getByRole('button', { name: /se connecter|sign in/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/?$/, { timeout: 20000 });
  });
});
