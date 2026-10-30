import { test, expect } from '@playwright/test';

test.describe('Explorer UI (Phase 3-4)', () => {
  test('basic explorer functions', async ({ page }) => {
    test.setTimeout(60000);
    // Adding extra timeout for dev server to compile the page
    await page.goto('/dev/explorer', { timeout: 60000 });

    // Wait for the page to load
    await expect(page.locator('text=Work Drive').first()).toBeVisible({ timeout: 15000 });

    // 1. Switch views
    await page.locator('button').locator('svg.lucide-layout-grid').click(); // Icons view
    await page.waitForTimeout(500);

    await page.locator('button').locator('svg.lucide-image').click(); // Gallery view
    await page.waitForTimeout(500);

    await page.locator('button').locator('svg.lucide-layout-list').click(); // Details view back
    await page.waitForTimeout(500);

    // 2. Sort
    await page.locator('text=Name ').first().click(); // Sort by name desc (initial is name asc)
    await page.waitForTimeout(500);

    // 3. Select row
    await page.locator('div[style*="height: 36px"]').nth(1).click();
    await page.waitForTimeout(200);

    // Test shift selection
    await page.keyboard.down('Shift');
    await page.locator('div[style*="height: 36px"]').nth(3).click();
    await page.keyboard.up('Shift');
    await page.waitForTimeout(200);

    // Select one row specifically again to reset selection
    await page.locator('div[style*="height: 36px"]').nth(5).click();
    await page.waitForTimeout(200);

    // Test ctrl selection
    await page.keyboard.down('Control');
    await page.locator('div[style*="height: 36px"]').nth(6).click();
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);

    // Click in blank space to deselect
    await page.locator('div.outline-none').click();
    await page.waitForTimeout(200);
  });
});
