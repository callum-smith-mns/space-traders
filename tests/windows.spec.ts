import { test, expect, type Page } from '@playwright/test';
import { setupGameScreen, CONTRACT, SHIPS } from './helpers';

/** Helper to get a DraggableWindow by its exact title */
function getWindow(page: Page, title: string) {
  return page.locator('.dw').filter({
    has: page.locator('.dw-title', { hasText: new RegExp(`^${title}`, 'i') }),
  });
}

test.describe('Contracts Window', () => {
  test.beforeEach(async ({ page }) => {
    await setupGameScreen(page);
    // Bring contracts window to front
    const cw = getWindow(page, 'Contracts');
    await cw.locator('.dw-bar').click();
  });

  test('shows contracts list', async ({ page }) => {
    await expect(page.locator('.contract-type-badge').filter({ hasText: 'PROCUREMENT' }).first()).toBeAttached();
  });

  test('shows contract faction', async ({ page }) => {
    await expect(page.locator('.contract-faction').filter({ hasText: CONTRACT.factionSymbol }).first()).toBeAttached();
  });

  test('shows payment info', async ({ page }) => {
    const total = CONTRACT.terms.payment.onAccepted + CONTRACT.terms.payment.onFulfilled;
    await expect(page.locator('.contract-payment-value').first()).toContainText(total.toLocaleString());
  });

  test('can expand contract to see details', async ({ page }) => {
    await page.locator('.contract-row').first().click();
    await expect(page.locator('.contract-detail')).toBeVisible();
  });

  test('can accept a contract', async ({ page }) => {
    await page.locator('.contract-row').first().click();
    await page.locator('.contract-accept-btn').click();
    // After accepting, status changes to ACTIVE
    await expect(page.locator('.contract-status--active').first()).toBeAttached();
  });

  test('shows refresh button', async ({ page }) => {
    await expect(page.locator('.contracts-refresh-btn')).toBeAttached();
  });
});

test.describe('Trade Routes Window', () => {
  test.beforeEach(async ({ page }) => {
    await setupGameScreen(page);
    // Select a ship first — trade routes requires a selected ship
    await page.locator('.ship-row').filter({ hasText: SHIPS[0].symbol }).click();
  });

  test('shows hint or trade routes view', async ({ page }) => {
    const trWindow = getWindow(page, 'Trade Routes');
    // After selecting a ship, the trade routes window should load data
    // It may show toggle buttons or a loading state
    await expect(trWindow).toBeVisible();
    // Wait for either the toggle buttons or the hint to appear
    await expect(
      trWindow.locator('.tr-toggle-btn, .tr-hint, .tr-routes').first(),
    ).toBeAttached({ timeout: 10_000 });
  });
});

test.describe('Navigation Guide', () => {
  test.beforeEach(async ({ page }) => {
    await setupGameScreen(page);
  });

  test('shows navigation guide tabs', async ({ page }) => {
    const navGuide = getWindow(page, 'Navigation Guide');
    await expect(navGuide).toBeVisible();
    await expect(navGuide.locator('.navguide-tab').filter({ hasText: 'System Map' })).toBeVisible();
    await expect(navGuide.locator('.navguide-tab').filter({ hasText: 'List' })).toBeVisible();
    await expect(navGuide.locator('.navguide-tab').filter({ hasText: 'Guide' })).toBeVisible();
    await expect(navGuide.locator('.navguide-tab').filter({ hasText: 'Planner' })).toBeVisible();
  });

  test('can switch to guide tab', async ({ page }) => {
    const navGuide = getWindow(page, 'Navigation Guide');
    await navGuide.locator('.navguide-tab').filter({ hasText: 'Guide' }).click();
    await expect(navGuide.locator('.navguide-mode-name').filter({ hasText: 'CRUISE' })).toBeVisible();
  });
});

test.describe('Draggable Windows', () => {
  test.beforeEach(async ({ page }) => {
    await setupGameScreen(page);
  });

  test('can minimize and restore a window', async ({ page }) => {
    const cw = getWindow(page, 'Contracts');
    // Click minimize button
    await cw.locator('.dw-btn[title="Minimize"]').click();
    await expect(cw).toHaveClass(/dw--minimized/);

    // Click restore button
    await cw.locator('.dw-btn[title="Restore"]').click();
    await expect(cw).not.toHaveClass(/dw--minimized/);
  });

  test('clicking a window brings it to front', async ({ page }) => {
    const fleet = getWindow(page, 'Fleet');
    const contracts = getWindow(page, 'Contracts');

    await fleet.locator('.dw-bar').click();
    const fleetZ = await fleet.evaluate((el) => getComputedStyle(el).zIndex);
    await contracts.locator('.dw-bar').click();
    const contractsZ = await contracts.evaluate((el) => getComputedStyle(el).zIndex);
    expect(Number(contractsZ)).toBeGreaterThanOrEqual(Number(fleetZ));
  });
});
