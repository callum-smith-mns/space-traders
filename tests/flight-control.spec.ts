import { test, expect } from '@playwright/test';
import { setupGameScreen, SHIPS, WAYPOINTS } from './helpers';

/** Helper: select a ship and verify flight control loaded */
async function selectShip(page: import('@playwright/test').Page, symbol: string) {
  await page.locator('.ship-row').filter({ hasText: symbol }).click();
  await expect(page.locator('.fc-ship-name')).toHaveText(symbol);
}

test.describe('Flight Control', () => {
  test.beforeEach(async ({ page }) => {
    await setupGameScreen(page);
    await selectShip(page, SHIPS[0].symbol);
  });

  test('shows ship header with name and status', async ({ page }) => {
    await expect(page.locator('.fc-ship-name')).toHaveText(SHIPS[0].symbol);
    await expect(page.locator('.fc-ship-role')).toContainText('COMMAND');
    await expect(page.locator('.fc-nav-badge')).toContainText('DOCKED');
  });

  test('shows fuel bar', async ({ page }) => {
    await expect(page.locator('.fc-fuel-label')).toContainText('FUEL');
  });

  test.describe('Details tab', () => {
    test('is shown by default', async ({ page }) => {
      await expect(page.locator('.fc-tab--active')).toHaveText('Details');
      await expect(page.locator('.fc-details')).toBeVisible();
    });

    test('shows frame, reactor, engine info', async ({ page }) => {
      await expect(page.getByText('Frame — Frigate')).toBeVisible();
      await expect(page.getByText('Reactor — Fission Reactor I')).toBeVisible();
      await expect(page.getByText('Engine — Ion Drive II')).toBeVisible();
    });

    test('shows modules and mounts', async ({ page }) => {
      await expect(page.locator('.fc-equip-name').filter({ hasText: 'Cargo Hold II' })).toBeVisible();
      await expect(page.locator('.fc-equip-name').filter({ hasText: 'Mining Laser II' })).toBeVisible();
      await expect(page.locator('.fc-equip-name').filter({ hasText: 'Sensor Array II' })).toBeVisible();
    });

    test('shows cargo summary', async ({ page }) => {
      await expect(page.locator('.fc-cargo-bar-label')).toContainText('CARGO');
    });
  });

  test.describe('Navigation tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('.fc-tab').filter({ hasText: 'Navigation' }).click();
    });

    test('shows orbit and dock buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Orbit' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Dock' })).toBeVisible();
    });

    test('can orbit the ship', async ({ page }) => {
      await page.getByRole('button', { name: 'Orbit' }).click();
      await expect(page.locator('.fc-feedback')).toContainText('orbit', { ignoreCase: true });
    });

    test('shows flight mode buttons', async ({ page }) => {
      for (const mode of ['DRIFT', 'STEALTH', 'CRUISE', 'BURN']) {
        await expect(page.locator('.fc-mode-btn').filter({ hasText: mode })).toBeVisible();
      }
    });

    test('shows navigate section with waypoint select', async ({ page }) => {
      await expect(page.locator('.fc-select')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Go', exact: true })).toBeVisible();
    });

    test('waypoint select has options', async ({ page }) => {
      const options = page.locator('.fc-select option');
      // Placeholder + waypoints
      await expect(options).toHaveCount(WAYPOINTS.length + 1);
    });

    test('can navigate to a waypoint', async ({ page }) => {
      // First orbit the ship
      await page.getByRole('button', { name: 'Orbit' }).click();
      await page.waitForTimeout(300);

      // Select a destination from the dropdown
      await page.locator('.fc-select').selectOption('X1-TEST-B2');
      // Click Go
      await page.getByRole('button', { name: 'Go', exact: true }).click();
      await expect(page.locator('.fc-feedback')).toContainText('route', { ignoreCase: true });
    });
  });

  test.describe('Scan tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('.fc-tab').filter({ hasText: 'Scan' }).click();
    });

    test('shows scan buttons', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Scan Waypoints' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Scan Ships' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Scan Systems' })).toBeVisible();
    });

    test('can scan waypoints', async ({ page }) => {
      // Ship is DOCKED, so first orbit it for scanning
      await page.locator('.fc-tab').filter({ hasText: 'Navigation' }).click();
      await page.getByRole('button', { name: 'Orbit' }).click();
      await page.waitForTimeout(300);
      await page.locator('.fc-tab').filter({ hasText: 'Scan' }).click();

      await page.getByRole('button', { name: 'Scan Waypoints' }).click();
      // Should show results or feedback
      await expect(
        page.locator('.fc-scan-results, .fc-feedback').first(),
      ).toBeVisible();
    });
  });

  test.describe('Extract tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('.fc-tab').filter({ hasText: 'Extract' }).click();
    });

    test('shows extract controls', async ({ page }) => {
      await expect(page.locator('.fc-extract')).toBeVisible();
      await expect(page.getByRole('button', { name: /Mine.*Extract/ })).toBeVisible();
    });

    test('shows survey button', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Survey' })).toBeVisible();
    });
  });

  test.describe('Cargo tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('.fc-tab').filter({ hasText: 'Cargo' }).click();
    });

    test('shows cargo items', async ({ page }) => {
      await expect(page.locator('.fc-cargo-name').filter({ hasText: 'Iron Ore' })).toBeVisible();
      await expect(page.locator('.fc-cargo-units').filter({ hasText: '×5' })).toBeVisible();
    });

    test('shows sell and jettison buttons', async ({ page }) => {
      await expect(page.locator('.fc-btn--accent').filter({ hasText: /Sell/ }).first()).toBeVisible();
      await expect(page.locator('.fc-btn--danger').filter({ hasText: 'Jettison' }).first()).toBeVisible();
    });

    test('can sell cargo', async ({ page }) => {
      await page.locator('.fc-btn--accent').filter({ hasText: /Sell/ }).first().click();
      await expect(page.locator('.fc-feedback')).toContainText('Sold');
    });

    test('can jettison cargo', async ({ page }) => {
      await page.locator('.fc-btn--danger').filter({ hasText: 'Jettison' }).first().click();
      await expect(page.locator('.fc-feedback')).toContainText('Jettisoned');
    });

    test('shows quantity controls', async ({ page }) => {
      await expect(page.locator('.fc-qty-input').first()).toBeVisible();
    });
  });

  test.describe('Market tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('.fc-tab').filter({ hasText: 'Market' }).click();
    });

    test('shows trade goods', async ({ page }) => {
      await expect(page.getByText('Trade Goods')).toBeVisible();
      await expect(page.locator('.fc-market-good').filter({ hasText: 'IRON' }).first()).toBeVisible();
      await expect(page.locator('.fc-market-good').filter({ hasText: 'FOOD' }).first()).toBeVisible();
    });

    test('shows buy and sell buttons', async ({ page }) => {
      await expect(page.locator('.fc-btn--primary').filter({ hasText: 'Buy' }).first()).toBeVisible();
    });

    test('can buy goods', async ({ page }) => {
      await page.locator('.fc-btn--primary').filter({ hasText: 'Buy' }).first().click();
      await expect(page.locator('.fc-feedback')).toContainText('Bought');
    });
  });

  test.describe('Shipyard tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.locator('.fc-tab').filter({ hasText: 'Shipyard' }).click();
    });

    test('shows available ships', async ({ page }) => {
      await expect(page.locator('.fc-shipyard-card-name').filter({ hasText: 'Mining Drone' })).toBeVisible();
    });

    test('shows ship price', async ({ page }) => {
      await expect(page.locator('.fc-shipyard-price').first()).toBeVisible();
    });

    test('can expand ship details', async ({ page }) => {
      await page.locator('.fc-shipyard-card').first().click();
      await expect(page.locator('.fc-shipyard-card-detail')).toBeVisible();
    });

    test('can purchase a ship', async ({ page }) => {
      await page.locator('.fc-shipyard-card').first().click();
      await page.locator('.fc-shipyard-buy-btn').click();
      await expect(page.locator('.fc-feedback')).toContainText('Purchased');
    });
  });
});

test.describe('Flight Control - Second ship', () => {
  test.beforeEach(async ({ page }) => {
    await setupGameScreen(page);
    await selectShip(page, SHIPS[1].symbol);
  });

  test('shows second ship details', async ({ page }) => {
    await expect(page.locator('.fc-ship-name')).toHaveText(SHIPS[1].symbol);
    await expect(page.locator('.fc-ship-role')).toContainText('EXCAVATOR');
  });

  test('shows IN ORBIT status', async ({ page }) => {
    await expect(page.locator('.fc-nav-badge')).toContainText('IN ORBIT');
  });
});
