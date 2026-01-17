import { test, expect } from '@playwright/test';
import { generateUniqueEmail, testProjects } from '../../fixtures/test-data';

/**
 * Full Workflow E2E Test
 * Tests complete user journey from registration to logout
 */

test.describe('Full User Workflow', () => {
  test('complete flow: register → login → create project → dashboard → logout', async ({
    page,
  }) => {
    const email = generateUniqueEmail();
    const password = 'Test123!@#';
    const companyName = 'Full Flow Test Company';

    // Step 1: Register
    await test.step('Register new user', async () => {
      await page.goto('/register');
      await page.getByLabel('Nazwa firmy').fill(companyName);
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Telefon').fill('123456789');
      await page.getByLabel('Hasło').fill(password);
      await page.getByRole('button', { name: /zarejestruj/i }).click();

      // Wait for registration
      await page.waitForTimeout(2000);
    });

    // Step 2: Login
    await test.step('Login with new account', async () => {
      await page.goto('/login');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Hasło').fill(password);
      await page.getByRole('button', { name: /zaloguj/i }).click();

      await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
    });

    // Step 3: Verify Dashboard
    await test.step('Verify dashboard loads', async () => {
      await expect(
        page.getByRole('heading', { name: /witaj|dashboard/i })
      ).toBeVisible();
      await expect(page.getByText(/0.*projekt|brak/i)).toBeVisible();
    });

    // Step 4: Navigate to Projects
    await test.step('Navigate to projects', async () => {
      await page.getByRole('link', { name: /projekty/i }).click();
      await expect(page).toHaveURL('/projects');
    });

    // Step 5: Create Project
    await test.step('Create new project', async () => {
      await page.getByRole('button', { name: /nowy projekt/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      await page.getByLabel('Nazwa projektu').fill(testProjects.medium.name);
      await page.getByLabel(/długość/i).fill('10');
      await page.getByLabel(/szerokość/i).fill('8');
      await page.getByLabel(/grubość/i).fill('0.25');
      await page.getByLabel(/wysokość/i).fill('3');

      await page.getByRole('button', { name: /utwórz|zapisz/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    });

    // Step 6: Verify Project in List
    await test.step('Verify project appears in list', async () => {
      await expect(page.getByText(testProjects.medium.name)).toBeVisible({
        timeout: 5000,
      });
    });

    // Step 7: Open Project Editor
    await test.step('Open project in editor', async () => {
      await page.getByText(testProjects.medium.name).click();
      await expect(page).toHaveURL(/\/projects\//, { timeout: 5000 });
    });

    // Step 8: Return to Dashboard
    await test.step('Return to dashboard', async () => {
      await page.getByRole('link', { name: /dashboard|panel/i }).click();
      await expect(page).toHaveURL('/dashboard');
    });

    // Step 9: Verify Stats Updated
    await test.step('Verify dashboard stats updated', async () => {
      // Should show at least 1 project now
      await expect(
        page.getByText(/1.*projekt|projekt.*1/i).or(page.getByText('1'))
      ).toBeVisible();
    });

    // Step 10: Logout
    await test.step('Logout', async () => {
      await page.getByRole('button', { name: /menu|konto|user/i }).click();
      await page.getByRole('menuitem', { name: /wyloguj/i }).click();

      await expect(page).toHaveURL('/login', { timeout: 5000 });
    });

    // Step 11: Verify Cannot Access After Logout
    await test.step('Verify protected route after logout', async () => {
      await page.goto('/dashboard');
      await expect(page).toHaveURL('/login', { timeout: 5000 });
    });
  });

  test('dashboard quick actions work correctly', async ({ page, request }) => {
    // Setup: Create user and login
    const email = generateUniqueEmail();
    await request.post('http://localhost:3000/auth/register', {
      data: {
        email,
        password: 'Test123!@#',
        companyName: 'Quick Actions Test',
      },
    });

    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Hasło').fill('Test123!@#');
    await page.getByRole('button', { name: /zaloguj/i }).click();
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // Test: New Project quick action
    await test.step('New Project quick action', async () => {
      await page.getByRole('button', { name: /nowy projekt/i }).click();
      await expect(page).toHaveURL(/projects.*new|projects/);
    });

    // Navigate back to dashboard
    await page.goto('/dashboard');

    // Test: Inventory quick action
    await test.step('Inventory quick action', async () => {
      await page.getByRole('button', { name: /magazyn/i }).click();
      await expect(page).toHaveURL('/inventory');
    });
  });
});
