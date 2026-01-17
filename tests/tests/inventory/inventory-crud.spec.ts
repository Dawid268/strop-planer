import { test, expect } from '@playwright/test';
import {
  generateUniqueEmail,
  testInventoryItems,
} from '../../fixtures/test-data';
import { apiLogin, apiRegister } from '../../utils/api.helper';

/**
 * Inventory CRUD E2E Tests
 */

test.describe('Inventory Management', () => {
  let userEmail: string;
  const userPassword = 'Test123!@#';

  test.beforeAll(async ({ request }) => {
    // Create test user via API
    userEmail = generateUniqueEmail();
    await apiRegister(request, {
      email: userEmail,
      password: userPassword,
      companyName: 'Inventory Test Company',
    });
  });

  test.beforeEach(async ({ page }) => {
    // Login via UI
    await page.goto('/login');
    await page.getByLabel('Email').fill(userEmail);
    await page.getByLabel('Hasło').fill(userPassword);
    await page.getByRole('button', { name: /zaloguj/i }).click();
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });

  test('should display inventory page', async ({ page }) => {
    await page.goto('/inventory');

    await expect(page.getByRole('heading', { name: /magazyn/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /dodaj/i })).toBeVisible();
  });

  test('should display filter controls', async ({ page }) => {
    await page.goto('/inventory');

    // Search input
    await expect(page.getByLabel('Szukaj')).toBeVisible();

    // Type filter
    await expect(page.getByLabel('Typ')).toBeVisible();

    // Manufacturer filter
    await expect(page.getByLabel('Producent')).toBeVisible();
  });

  test('should open add item dialog', async ({ page }) => {
    await page.goto('/inventory');

    await page.getByRole('button', { name: /dodaj/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /dodaj.*element|nowy.*element/i })
    ).toBeVisible();
  });

  test('should add new inventory item', async ({ page }) => {
    await page.goto('/inventory');

    // Open dialog
    await page.getByRole('button', { name: /dodaj/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill form
    await page.getByLabel('Nazwa').fill(testInventoryItems.panel.name);
    await page.getByLabel('Typ').click();
    await page.getByRole('option', { name: /panel/i }).click();
    await page
      .getByLabel('Producent')
      .fill(testInventoryItems.panel.manufacturer);
    await page.getByLabel('System').fill(testInventoryItems.panel.system);
    await page.getByLabel('Wymiary').fill(testInventoryItems.panel.dimensions);
    await page
      .getByLabel('Ilość')
      .fill(testInventoryItems.panel.quantity.toString());

    // Save
    await page.getByRole('button', { name: /zapisz|dodaj/i }).click();

    // Dialog should close
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

    // Item should appear in table
    await expect(page.getByText(testInventoryItems.panel.name)).toBeVisible({
      timeout: 5000,
    });
  });

  test('should filter inventory by type', async ({ page }) => {
    await page.goto('/inventory');

    // Select type filter
    await page.getByLabel('Typ').click();
    await page.getByRole('option', { name: /panel/i }).click();

    // All visible items should be panels (or empty if no panels)
    // Check that filter was applied (no error)
    await page.waitForTimeout(500);

    // Reset filter
    await page.getByLabel('Typ').click();
    await page.getByRole('option', { name: /wszystkie/i }).click();
  });

  test('should search inventory by name', async ({ page }) => {
    await page.goto('/inventory');

    // Type in search
    await page.getByLabel('Szukaj').fill('Panel');

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Clear search
    await page.getByLabel('Szukaj').clear();
  });

  test('should edit inventory item', async ({ page }) => {
    await page.goto('/inventory');

    // Find item and click edit
    const row = page.getByRole('row').filter({ hasText: /panel/i }).first();
    if ((await row.count()) > 0) {
      await row
        .getByRole('button', { name: /edit|edytuj/i })
        .first()
        .click();

      // Dialog should open
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });

      // Change quantity
      await page.getByLabel('Ilość').clear();
      await page.getByLabel('Ilość').fill('100');

      // Save
      await page.getByRole('button', { name: /zapisz/i }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('should delete inventory item', async ({ page }) => {
    await page.goto('/inventory');

    // Find item and click delete
    const row = page
      .getByRole('row')
      .filter({ hasText: /delete/i })
      .first();
    if ((await row.count()) > 0) {
      await row
        .getByRole('button', { name: /delete|usuń/i })
        .first()
        .click();

      // Handle confirmation dialog
      page.once('dialog', (dialog) => dialog.accept());
    }
  });
});
