import { test, expect } from '@playwright/test';
import { mockAllApiRoutes, AGENT, FACTIONS, injectAgentAuth } from './helpers';

test.describe('Agent Screen', () => {
  test.describe('with agent token (Mission Control)', () => {
    test.beforeEach(async ({ page }) => {
      await mockAllApiRoutes(page);
      await page.goto('/');
      await injectAgentAuth(page);
      await page.reload();
      // App auto-launches to GameScreen after token restore, so wait for it
      await page.waitForSelector('.game-topbar', { timeout: 10_000 });
      // Navigate back to Agent Screen via "Mission Control"
      await page.getByText('Mission Control').click();
      await page.waitForSelector('.agent-title');
    });

    test('shows agent info', async ({ page }) => {
      await expect(page.locator('.agent-title')).toHaveText('Mission Control');
      await expect(page.getByText(AGENT.symbol).first()).toBeVisible();
      await expect(page.locator('.agent-info-value').filter({ hasText: AGENT.startingFaction })).toBeVisible();
      await expect(page.locator('.agent-info-value').filter({ hasText: AGENT.headquarters })).toBeVisible();
      await expect(page.getByText(AGENT.credits.toLocaleString())).toBeVisible();
    });

    test('"Continue Mission" launches the game screen', async ({ page }) => {
      await page.getByText('Continue Mission').click();
      await expect(page.locator('.game-topbar')).toBeVisible();
      await expect(page.locator('.game-topbar-callsign')).toHaveText(AGENT.symbol);
    });

    test('Logout returns to login screen', async ({ page }) => {
      await page.locator('.agent-logout').filter({ hasText: 'Logout' }).click();
      await expect(page.locator('.login-title')).toHaveText('SpaceTraders');
    });
  });

  test.describe('with account token (registration mode)', () => {
    test.beforeEach(async ({ page }) => {
      await mockAllApiRoutes(page);
      // Override /my/agent to fail — simulates account token
      await page.route('https://api.spacetraders.io/v2/my/agent', (route) => {
        return route.fulfill({
          status: 401,
          json: { error: { code: 4100, message: 'Not an agent token' } },
        });
      });

      await page.goto('/');
      await page.evaluate(() => localStorage.clear());
      await page.reload();

      // Enter account token via login screen
      await page.locator('input[placeholder*="account token"]').fill('acct-tok-123');
      await page.getByText('Connect Account').click();

      // Should be on agent screen
      await page.waitForSelector('.agent-title');
    });

    test('shows account token badge and registration form', async ({ page }) => {
      await expect(page.locator('.agent-account-badge')).toHaveText('Account Token');
      await expect(page.getByText('Register new agent')).toBeVisible();
    });

    test('shows faction cards', async ({ page }) => {
      for (const f of FACTIONS) {
        await expect(page.locator('.faction-card-name').filter({ hasText: f.name })).toBeVisible();
      }
    });

    test('validates callsign length', async ({ page }) => {
      // Disable native HTML5 validation so JS validation runs
      await page.locator('form.register-section').evaluate(
        (el) => (el as HTMLFormElement).noValidate = true,
      );
      await page.locator('#callsign-input').fill('AB');
      await page.getByText('Register Agent').click();
      await expect(page.locator('.agent-error')).toContainText('3-14 characters');
    });

    test('validates callsign characters', async ({ page }) => {
      await page.locator('form.register-section').evaluate(
        (el) => (el as HTMLFormElement).noValidate = true,
      );
      await page.locator('#callsign-input').fill('BAD AGENT!');
      await page.getByText('Register Agent').click();
      await expect(page.locator('.agent-error')).toContainText('letters, numbers');
    });

    test('registers agent and auto-launches game', async ({ page }) => {
      // Re-enable /my/agent for post-registration
      await page.route('https://api.spacetraders.io/v2/my/agent', (route) => {
        return route.fulfill({ json: { data: AGENT } });
      });

      await page.locator('#callsign-input').fill('NEWPILOT');
      // COSMIC is selected by default
      await page.getByText('Register Agent').click();

      // Should auto-launch the game screen
      await expect(page.locator('.game-topbar')).toBeVisible({ timeout: 10_000 });
    });

    test('can select different factions', async ({ page }) => {
      // Click the VOID faction card
      await page.locator('.faction-card').filter({ hasText: 'Void Traders' }).click();
      // The faction detail should show
      await expect(page.locator('.faction-detail-name')).toHaveText('Void Traders');
    });
  });
});
