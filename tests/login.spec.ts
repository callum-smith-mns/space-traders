import { test, expect } from '@playwright/test';
import { mockAllApiRoutes, AGENT, AGENT_TOKEN } from './helpers';

test.describe('Login Screen', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllApiRoutes(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('shows the login screen when no token exists', async ({ page }) => {
    await expect(page.locator('.login-title')).toHaveText('SpaceTraders');
    await expect(page.locator('.login-subtitle')).toBeVisible();
  });

  test('shows account token input by default', async ({ page }) => {
    await expect(page.locator('input[placeholder*="account token"]')).toBeVisible();
    await expect(page.getByText('Connect Account')).toBeVisible();
  });

  test('shows error for empty account token', async ({ page }) => {
    await page.getByText('Connect Account').click();
    await expect(page.locator('.login-error')).toContainText('enter your account token');
  });

  test('can switch to agent token view', async ({ page }) => {
    await page.getByText('Existing Agent Token').click();
    await expect(page.locator('input[placeholder*="agent bearer token"]')).toBeVisible();
    await expect(page.getByText('Connect Agent')).toBeVisible();
  });

  test('can go back from agent token view', async ({ page }) => {
    await page.getByText('Existing Agent Token').click();
    await page.getByText('← Back').click();
    await expect(page.locator('input[placeholder*="account token"]')).toBeVisible();
  });

  test('shows error for empty agent token', async ({ page }) => {
    await page.getByText('Existing Agent Token').click();
    await page.getByText('Connect Agent').click();
    await expect(page.locator('.login-error')).toContainText('enter your agent token');
  });

  test('logs in with a valid agent token and enters the game', async ({ page }) => {
    await page.getByText('Existing Agent Token').click();
    await page.locator('input[placeholder*="agent bearer token"]').fill(AGENT_TOKEN);
    await page.getByText('Connect Agent').click();

    // App auto-launches into the game screen after agent token login
    await expect(page.locator('.game-topbar')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.game-topbar-callsign')).toHaveText(AGENT.symbol);
  });

  test('logs in with account token and shows registration screen', async ({ page }) => {
    // An account token causes GET /my/agent to fail
    await page.route('https://api.spacetraders.io/v2/my/agent', (route) => {
      return route.fulfill({
        status: 401,
        json: { error: { code: 4100, message: 'Invalid token' } },
      });
    });

    await page.locator('input[placeholder*="account token"]').fill('account-tok-123');
    await page.getByText('Connect Account').click();

    await expect(page.locator('.agent-title')).toHaveText('Mission Control', { timeout: 10_000 });
    await expect(page.locator('.agent-account-badge')).toHaveText('Account Token');
    await expect(page.getByText('Register new agent')).toBeVisible();
  });
});
