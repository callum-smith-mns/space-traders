import { test, expect } from '@playwright/test';
import { setupGameScreen, AGENT, SHIPS } from './helpers';

test.describe('Game Screen', () => {
  test.beforeEach(async ({ page }) => {
    await setupGameScreen(page);
  });

  test('shows top bar with agent info', async ({ page }) => {
    await expect(page.locator('.game-topbar-callsign')).toHaveText(AGENT.symbol);
    await expect(page.locator('.game-topbar-faction')).toHaveText(AGENT.startingFaction);
    await expect(page.locator('.game-topbar-credits')).toContainText(AGENT.credits.toLocaleString());
  });

  test('shows Fleet window', async ({ page }) => {
    await expect(page.locator('.dw-title').filter({ hasText: 'Fleet' })).toBeVisible();
  });

  test('shows Trade Routes window', async ({ page }) => {
    await expect(page.locator('.dw-title').filter({ hasText: 'Trade Routes' })).toBeVisible();
  });

  test('shows Contracts window', async ({ page }) => {
    await expect(page.locator('.dw-title').filter({ hasText: 'Contracts' })).toBeVisible();
  });

  test('shows Navigation Guide window', async ({ page }) => {
    await expect(page.locator('.dw-title').filter({ hasText: 'Navigation Guide' })).toBeVisible();
  });

  test('shows Flight Control window', async ({ page }) => {
    await expect(page.locator('.dw-title').filter({ hasText: 'Flight Control' })).toBeVisible();
  });

  test('"Mission Control" returns to agent screen', async ({ page }) => {
    await page.locator('.game-topbar-btn').filter({ hasText: 'Mission Control' }).click();
    await expect(page.locator('.agent-title')).toHaveText('Mission Control');
  });

  test('"Reset Windows" resets window positions', async ({ page }) => {
    await page.locator('.game-topbar-btn').filter({ hasText: 'Reset Windows' }).click();
    // Windows should still be visible
    await expect(page.locator('.dw-title').filter({ hasText: 'Fleet' })).toBeVisible();
  });
});

test.describe('Ships Window', () => {
  test.beforeEach(async ({ page }) => {
    await setupGameScreen(page);
    // Bring fleet window to front by its title
    const fleetWindow = page.locator('.dw').filter({ has: page.locator('> .dw-bar .dw-title', { hasText: 'Fleet' }) });
    await fleetWindow.locator('.dw-bar').first().click();
  });

  test('lists all ships', async ({ page }) => {
    const fleetWindow = page.locator('.dw').filter({ has: page.locator('> .dw-bar .dw-title', { hasText: 'Fleet' }) });
    for (const ship of SHIPS) {
      await expect(fleetWindow.getByText(ship.symbol).first()).toBeAttached();
    }
  });

  test('shows ship roles', async ({ page }) => {
    const fleetWindow = page.locator('.dw').filter({ has: page.locator('> .dw-bar .dw-title', { hasText: 'Fleet' }) });
    await expect(fleetWindow.locator('.ship-role').filter({ hasText: 'COMMAND' })).toBeAttached();
    await expect(fleetWindow.locator('.ship-role').filter({ hasText: 'EXCAVATOR' })).toBeAttached();
  });

  test('shows nav status badges', async ({ page }) => {
    await expect(page.locator('.ship-nav-status--docked').first()).toBeAttached();
    await expect(page.locator('.ship-nav-status--in-orbit').first()).toBeAttached();
  });

  test('clicking a ship loads it into Flight Control', async ({ page }) => {
    await page.locator('.ship-row').filter({ hasText: SHIPS[0].symbol }).click();
    await expect(page.locator('.fc-ship-name')).toHaveText(SHIPS[0].symbol);
  });
});
