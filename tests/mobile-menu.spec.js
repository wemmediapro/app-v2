// Tests stabilité menu mobile — GNV OnBoard (viewport mobile)
import { test, expect } from '@playwright/test';
import { acceptConditions } from './fixtures.js';

test.use({ viewport: { width: 375, height: 667 } });

test.describe('Menu mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await acceptConditions(page);
  });

  test('zone principale visible sans débordement horizontal', async ({ page }) => {
    const main = page.getByRole('main');
    await expect(main).toBeVisible({ timeout: 10000 });
    const box = await main.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375 + 2);
  });

  test('navigation bottom nav visible et cliquable', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: /principale|main/i }).or(page.locator('nav'));
    await expect(nav.first()).toBeVisible({ timeout: 5000 });
    const buttons = nav.getByRole('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('scroll liste magazine en viewport mobile', async ({ page }) => {
    await page.goto('/magazine');
    await acceptConditions(page);
    await page.getByRole('main').evaluate((el) => el.scrollTo(0, 300));
    await expect(page.getByRole('main')).toBeVisible();
  });
});
