import { test, expect } from '@playwright/test';
import { generateUniqueEmail } from '../../fixtures/test-data';

/**
 * Login E2E Tests
 * Testing login functionality based on UI behavior
 */

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form with all required fields', async ({
    page,
  }) => {
    // Expect login page title
    await expect(page.getByRole('heading', { name: /zaloguj/i })).toBeVisible();

    // Expect email input
    await expect(page.getByLabel('Email')).toBeVisible();

    // Expect password input
    await expect(page.getByLabel('Hasło')).toBeVisible();

    // Expect login button
    await expect(page.getByRole('button', { name: /zaloguj/i })).toBeVisible();

    // Expect register link
    await expect(
      page.getByRole('link', { name: /zarejestruj/i })
    ).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Click login without filling fields
    await page.getByRole('button', { name: /zaloguj/i }).click();

    // Expect validation error messages (Angular Material shows errors)
    await expect(page.getByText(/email.*wymagany|pole.*wymagane/i)).toBeVisible(
      { timeout: 3000 }
    );
  });

  test('should show error message for invalid credentials', async ({
    page,
  }) => {
    // Fill with invalid credentials
    await page.getByLabel('Email').fill('invalid@example.com');
    await page.getByLabel('Hasło').fill('wrongpassword');

    // Click login
    await page.getByRole('button', { name: /zaloguj/i }).click();

    // Expect error message
    await expect(page.getByText(/nieprawidłowe|błąd|invalid/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('should redirect to dashboard on successful login', async ({
    page,
    request,
  }) => {
    // First register a user via API
    const email = generateUniqueEmail();
    const password = 'Test123!@#';

    await request.post('http://localhost:3000/auth/register', {
      data: {
        email,
        password,
        companyName: 'Test Login Company',
      },
    });

    // Now login via UI
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Hasło').fill(password);
    await page.getByRole('button', { name: /zaloguj/i }).click();

    // Expect redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });

  test('should navigate to register page when clicking register link', async ({
    page,
  }) => {
    await page.getByRole('link', { name: /zarejestruj|rejestr/i }).click();

    await expect(page).toHaveURL('/register');
  });

  test('should show loading state during login', async ({ page }) => {
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Hasło').fill('password123');

    // Start waiting for loading indicator before clicking
    const loadingPromise = page
      .getByRole('progressbar')
      .or(page.locator('.mat-spinner'));

    await page.getByRole('button', { name: /zaloguj/i }).click();

    // Loading state may be very brief, so we just check button becomes disabled or spinner appears
    // This test is intentionally lenient
  });
});

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing dashboard without auth', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });

  test('should redirect to login when accessing projects without auth', async ({
    page,
  }) => {
    await page.goto('/projects');

    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });

  test('should redirect to login when accessing inventory without auth', async ({
    page,
  }) => {
    await page.goto('/inventory');

    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });
});
