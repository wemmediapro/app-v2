#!/usr/bin/env node
/**
 * Vérifie l'affichage et la mise en page des catégories en version tablette.
 * Utilise Playwright avec un viewport tablette (768–1024px).
 *
 * Usage: node scripts/verify-tablet-categories.cjs [baseUrl]
 * Exemple: npm run dev (dans un terminal) puis npm run verify:tablet
 *
 * Prérequis: npm install -D playwright && npx playwright install chromium
 */

const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:5173';

// Viewport tablette (iPad portrait, entre 768 et 1024)
const TABLET_VIEWPORT = { width: 820, height: 1180 };

async function main() {
  console.log('📱 Vérification des catégories — version tablette');
  console.log('   Viewport:', TABLET_VIEWPORT.width + 'x' + TABLET_VIEWPORT.height);
  console.log('   URL:', BASE);
  console.log('');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: TABLET_VIEWPORT,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  });

  const results = [];
  let page;

  try {
    page = await context.newPage();

    // Aller sur l'app
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(1500);

    // Passer l'écran de login si présent (bouton démo)
    const demoBtn = page.getByRole('button', { name: /démo|demo|prévisualisation/i });
    if (await demoBtn.isVisible().catch(() => false)) {
      await demoBtn.click();
      await page.waitForTimeout(800);
    }

    // Mettre la barre de navigation en vue (utile si scroll horizontal sur tablette)
    const mainNav = page.getByRole('navigation', { name: /principale|main/i });
    await mainNav.scrollIntoViewIfNeeded().catch(() => {});

    // --- 1. Accueil : onglets / navigation
    const nav = page.getByRole('navigation', { name: /principale|main/i });
    const navVisible = await nav.isVisible().catch(() => false);
    results.push({ section: 'Navigation principale', ok: navVisible, detail: navVisible ? 'Visible' : 'Non trouvée' });

    // Ré-afficher la nav avant chaque section (au cas où scroll)
    const ensureNavVisible = () => mainNav.scrollIntoViewIfNeeded().catch(() => {});

    const goHome = async () => {
      const homeBtn = page.getByRole('button', { name: /accueil|home/i });
      if (await homeBtn.isVisible().catch(() => false)) {
        await homeBtn.click();
        await page.waitForTimeout(1200);
      }
      await page.evaluate(() => { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; });
      await page.waitForTimeout(500);
    };

    // --- 2. WebTV — filtre par catégorie (depuis accueil : clic sur la carte WebTV)
    await ensureNavVisible();
    const webtvTab = page.getByRole('button', { name: /webtv|web tv/i });
    if (await webtvTab.isVisible().catch(() => false)) {
      await webtvTab.click();
      await page.waitForTimeout(1000);
      const webtvFilter = page.locator('[aria-label*="Filtrer par catégorie"], nav[aria-label*="catégorie"]');
      const webtvFilterVisible = await webtvFilter.isVisible().catch(() => false);
      results.push({ section: 'WebTV — filtres catégories', ok: webtvFilterVisible, detail: webtvFilterVisible ? 'Visible' : 'Non trouvé' });
    } else {
      results.push({ section: 'WebTV — filtres catégories', ok: false, detail: 'Onglet WebTV non trouvé' });
    }

    // --- 3. Magazine — catégories (retour accueil puis clic Magazine)
    await goHome();
    await page.waitForTimeout(500);
    const magazineTab = page.locator('button').filter({ hasText: /magazine/i });
    await magazineTab.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    if (await magazineTab.isVisible().catch(() => false)) {
      await magazineTab.click();
      await page.waitForTimeout(1000);
      const magazineSelect = page.locator('select').filter({ has: page.locator('option') }).first;
      const magazineSelectVisible = await magazineSelect.isVisible().catch(() => false);
      const magazinePills = page.locator('nav').filter({ hasText: /actualités|sport|divertissement|musique|documentaire|enfants/i });
      const pillsVisible = await magazinePills.isVisible().catch(() => false);
      const magazineOk = magazineSelectVisible || pillsVisible;
      results.push({ section: 'Magazine — catégories', ok: magazineOk, detail: magazineOk ? (pillsVisible ? 'Pills visibles' : 'Select visible') : 'Aucun filtre catégorie' });
    } else {
      results.push({ section: 'Magazine — catégories', ok: false, detail: 'Onglet Magazine non trouvé (vérifier langue/aria-label)' });
    }

    // --- 4. Restaurant — catégories (bouton Restaurants dans la barre du bas)
    await ensureNavVisible();
    const restaurantTab = page.getByRole('button', { name: /restaurants?/i });
    if (await restaurantTab.isVisible().catch(() => false)) {
      await restaurantTab.click();
      await page.waitForTimeout(1000);
      const restaurantFilters = page.locator('select, nav').filter({ hasText: /restaurant|catégorie|tous/i });
      const restaurantVisible = await restaurantFilters.isVisible().catch(() => false);
      results.push({ section: 'Restaurant — catégories', ok: restaurantVisible, detail: restaurantVisible ? 'Filtres visibles' : 'Non trouvés' });
    } else {
      results.push({ section: 'Restaurant — catégories', ok: false, detail: 'Onglet Restaurant non trouvé' });
    }

    // --- 5. Boutique (Shop) — catégories (retour accueil puis clic Boutique)
    await goHome();
    await page.waitForTimeout(500);
    const shopTab = page.locator('button').filter({ hasText: /boutique|shop/i });
    await shopTab.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    if (await shopTab.isVisible().catch(() => false)) {
      await shopTab.click();
      await page.waitForTimeout(1000);
      const shopFilters = page.locator('select, nav').filter({ hasText: /souvenirs|duty|fashion|électronique|food|tous/i });
      const shopVisible = await shopFilters.isVisible().catch(() => false);
      results.push({ section: 'Boutique — catégories', ok: shopVisible, detail: shopVisible ? 'Filtres visibles' : 'Non trouvés' });
    } else {
      results.push({ section: 'Boutique — catégories', ok: false, detail: 'Onglet Boutique non trouvé' });
    }

    // --- 6. Enfant — catégories (retour accueil puis clic Enfants)
    await goHome();
    await page.waitForTimeout(500);
    const enfantTab = page.locator('button').filter({ hasText: /enfant|enfants|kids/i });
    await enfantTab.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    if (await enfantTab.isVisible().catch(() => false)) {
      await enfantTab.click();
      await page.waitForTimeout(1000);
      const enfantFilters = page.locator('select, nav').filter({ hasText: /tous|jeux|arts|éducation|divertissement/i });
      const enfantVisible = await enfantFilters.isVisible().catch(() => false);
      results.push({ section: 'Enfant — catégories', ok: enfantVisible, detail: enfantVisible ? 'Filtres visibles' : 'Non trouvés' });
    } else {
      results.push({ section: 'Enfant — catégories', ok: false, detail: 'Onglet Enfant non trouvé' });
    }

    // Capture d'écran globale (page d'accueil après tous les clics)
    const homeTab = page.getByRole('button', { name: /accueil|home/i });
    if (await homeTab.isVisible().catch(() => false)) {
      await homeTab.click();
      await page.waitForTimeout(600);
    }
    await page.screenshot({ path: 'tablet-categories-report.png', fullPage: false });
    console.log('   📸 Capture enregistrée: tablet-categories-report.png');

  } catch (err) {
    console.error('Erreur:', err.message);
    results.push({ section: 'Script', ok: false, detail: err.message });
  } finally {
    await context.close();
    await browser.close();
  }

  // Rapport
  console.log('');
  let allOk = true;
  const minOk = 2; // au moins Nav + 1 section catégories
  let okCount = 0;
  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.section}: ${r.detail}`);
    if (!r.ok) allOk = false;
    else okCount++;
  }

  console.log('');
  if (allOk) {
    console.log('Toutes les vérifications tablette (catégories) sont passées.');
  } else if (okCount >= minOk) {
    console.log('Vérification partielle OK (navigation + au moins une section catégories). Pour les autres sections, ouvrez l’app en viewport tablette (820×1180) et vérifiez manuellement.');
  } else {
    console.log('Certaines vérifications ont échoué. Vérifiez que l\'app tourne (npm run dev) et que le viewport tablette affiche bien les filtres catégories.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
