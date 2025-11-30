import { test, expect } from '@playwright/test';

/**
 * E2E tests for wallet functionality
 */

test.describe('Wallet Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('shows landing page with generate wallet option', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('LUMENITOS')).toBeVisible();
    await expect(page.getByText('generate wallet')).toBeVisible();
    await expect(page.getByText('import')).toBeVisible();
  });

  test('creates a new wallet', async ({ page }) => {
    await page.goto('/');

    await page.getByText('generate wallet').click();

    // Wait for wallet to be created
    await expect(page.getByText(/^C[A-Z0-9]{4}/)).toBeVisible({ timeout: 10000 });

    // Should show balance
    await expect(page.getByText(/XLM/)).toBeVisible();

    // Should show action links
    await expect(page.getByText('receive')).toBeVisible();
    await expect(page.getByText('send')).toBeVisible();
  });

  test('persists wallet across page reload', async ({ page }) => {
    await page.goto('/');
    await page.getByText('generate wallet').click();

    // Wait for wallet address
    await expect(page.getByText(/^C[A-Z0-9]{4}/)).toBeVisible({ timeout: 10000 });

    // Get the wallet address
    const addressText = await page.getByText(/^C[A-Z0-9]{4}/).textContent();

    // Reload page
    await page.reload();

    // Wallet should still be there
    await expect(page.getByText(addressText.substring(0, 10))).toBeVisible();
  });
});

test.describe('Wallet Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Create a wallet first
    await page.getByText('generate wallet').click();
    await expect(page.getByText(/^C[A-Z0-9]{4}/)).toBeVisible({ timeout: 10000 });
  });

  test('opens receive QR modal', async ({ page }) => {
    // Click on receive (contract account)
    const receiveLinks = page.getByText('receive');
    await receiveLinks.last().click();

    // QR code should be visible
    await expect(page.locator('svg')).toBeVisible();

    // Close button should work
    await page.getByText('close').click();
    await expect(page.locator('.modal-overlay')).not.toBeVisible();
  });

  test('opens send modal', async ({ page }) => {
    const sendLinks = page.getByText('send');
    await sendLinks.last().click();

    await expect(page.getByText('send xlm (contract account)')).toBeVisible();
    await expect(page.getByPlaceholder('GXXX...')).toBeVisible();
  });

  test('copies address to clipboard', async ({ page }) => {
    const copyLinks = page.getByText('copy');
    await copyLinks.first().click();

    await expect(page.getByText('copied!')).toBeVisible();
  });

  test('shows export mnemonic modal', async ({ page }) => {
    await page.getByText('export').click();

    await expect(page.getByText('recovery phrase')).toBeVisible();
    await expect(page.getByText(/write these 12 words/)).toBeVisible();

    // Should show 12 words
    const wordElements = page.locator('.mnemonic-word');
    await expect(wordElements).toHaveCount(12);
  });

  test('shows forget wallet confirmation', async ({ page }) => {
    await page.getByText('forget').click();

    await expect(page.getByText('forget wallet')).toBeVisible();
    await expect(page.getByText(/permanently delete/)).toBeVisible();
  });

  test('forgets wallet and returns to landing', async ({ page }) => {
    await page.getByText('forget').click();

    // Click confirm in modal
    const forgetButtons = page.getByText('forget');
    await forgetButtons.last().click();

    // Should be back to landing page
    await expect(page.getByText('generate wallet')).toBeVisible();
  });
});

test.describe('Import Wallet Flow', () => {
  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('opens import modal', async ({ page }) => {
    await page.getByText('import').click();

    await expect(page.getByText('import wallet')).toBeVisible();
    await expect(page.getByPlaceholder('word1 word2 word3 ...')).toBeVisible();
  });

  test('imports wallet from valid mnemonic', async ({ page }) => {
    await page.getByText('import').click();

    await page.getByPlaceholder('word1 word2 word3 ...').fill(testMnemonic);
    await page.getByRole('link', { name: 'import' }).last().click();

    // Should show wallet
    await expect(page.getByText(/^C[A-Z0-9]{4}/)).toBeVisible({ timeout: 10000 });
  });

  test('shows error for invalid mnemonic', async ({ page }) => {
    await page.getByText('import').click();

    await page.getByPlaceholder('word1 word2 word3 ...').fill('invalid mnemonic');
    await page.getByRole('link', { name: 'import' }).last().click();

    await expect(page.getByText(/invalid mnemonic/i)).toBeVisible();
  });

  test('imports same wallet consistently', async ({ page }) => {
    // Import first time
    await page.getByText('import').click();
    await page.getByPlaceholder('word1 word2 word3 ...').fill(testMnemonic);
    await page.getByRole('link', { name: 'import' }).last().click();
    await expect(page.getByText(/^C[A-Z0-9]{4}/)).toBeVisible({ timeout: 10000 });

    const firstAddress = await page.getByText(/^C[A-Z0-9]{4}/).textContent();

    // Forget and import again
    await page.getByText('forget').click();
    await page.getByText('forget').last().click();
    await expect(page.getByText('generate wallet')).toBeVisible();

    await page.getByText('import').click();
    await page.getByPlaceholder('word1 word2 word3 ...').fill(testMnemonic);
    await page.getByRole('link', { name: 'import' }).last().click();
    await expect(page.getByText(/^C[A-Z0-9]{4}/)).toBeVisible({ timeout: 10000 });

    const secondAddress = await page.getByText(/^C[A-Z0-9]{4}/).textContent();

    expect(firstAddress).toBe(secondAddress);
  });
});

test.describe('Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByText('generate wallet').click();
    await expect(page.getByText(/^C[A-Z0-9]{4}/)).toBeVisible({ timeout: 10000 });
  });

  test('toggles between light and dark themes', async ({ page }) => {
    // Default should be dark
    await expect(page.getByText('bright')).toBeVisible();

    // Click to switch to light
    await page.getByText('bright').click();
    await expect(page.getByText('dark')).toBeVisible();

    // Click to switch back to dark
    await page.getByText('dark').click();
    await expect(page.getByText('bright')).toBeVisible();
  });

  test('persists theme preference', async ({ page }) => {
    await page.getByText('bright').click();
    await expect(page.getByText('dark')).toBeVisible();

    await page.reload();

    // Should still be in light mode
    await expect(page.getByText('dark')).toBeVisible();
  });
});

test.describe('Testnet Funding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByText('generate wallet').click();
    await expect(page.getByText(/^C[A-Z0-9]{4}/)).toBeVisible({ timeout: 10000 });
  });

  test('shows fund button when balance is zero', async ({ page }) => {
    // New wallet should have 0 balance
    await expect(page.getByText('fund')).toBeVisible();
  });
});
