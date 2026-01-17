import { test, expect } from '@playwright/test';
import { generateUniqueEmail } from '../../fixtures/test-data';

/**
 * Register E2E Tests
 * Testing registration functionality based on UI behavior
 */

test.describe('Register Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should display registration form with all required fields', async ({
    page,
  }) => {
    // Expect register page title
    await expect(
      page.getByRole('heading', { name: /zarejestruj|rejestr/i })
    ).toBeVisible();

    // Expect all form fields
    await expect(page.getByLabel('Nazwa firmy')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Telefon')).toBeVisible();
    await expect(page.getByLabel('Hasło')).toBeVisible();

    // Expect register button
    await expect(
      page.getByRole('button', { name: /zarejestruj/i })
    ).toBeVisible();

    // Expect login link
    await expect(
      page.getByRole('link', { name: /zaloguj|logowanie/i })
    ).toBeVisible();
  });

  test('should show validation errors for empty required fields', async ({
    page,
  }) => {
    // Click register without filling fields
    await page.getByRole('button', { name: /zarejestruj/i }).click();

    // Expect validation errors
    await expect(page.getByText(/wymagane|required/i).first()).toBeVisible({
      timeout: 3000,
    });
  });

  test('should validate email format', async ({ page }) => {
    await page.getByLabel('Nazwa firmy').fill('Test Company');
    await page.getByLabel('Email').fill('invalid-email');
    await page.getByLabel('Hasło').fill('Test123!@#');

    // Click somewhere to trigger validation
    await page.getByLabel('Nazwa firmy').click();

    // Expect email format error
    await expect(
      page.getByText(/nieprawidłowy.*email|email.*format/i)
    ).toBeVisible({ timeout: 3000 });
  });

  test('should successfully register a new user', async ({ page }) => {
    const email = generateUniqueEmail();

    await page.getByLabel('Nazwa firmy').fill('Nowa Firma Testowa');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Telefon').fill('123456789');
    await page.getByLabel('Hasło').fill('Test123!@#');

    await page.getByRole('button', { name: /zarejestruj/i }).click();

    // Expect success message or redirect to login
    await expect(
      page
        .getByText(/sukces|pomyślnie|zarejestrowano/i)
        .or(page.locator('[href="/login"]'))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should show error for duplicate email', async ({ page, request }) => {
    const email = generateUniqueEmail();

    // First register via API
    await request.post('http://localhost:3000/auth/register', {
      data: {
        email,
        password: 'Test123!@#',
        companyName: 'First Company',
      },
    });

    // Try to register same email via UI
    await page.getByLabel('Nazwa firmy').fill('Duplicate Company');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Hasło').fill('Test123!@#');

    await page.getByRole('button', { name: /zarejestruj/i }).click();

    // Expect error about existing email
    await expect(
      page.getByText(/istnieje|zajęty|exists|duplicate/i)
    ).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to login page when clicking login link', async ({
    page,
  }) => {
    await page.getByRole('link', { name: /zaloguj|masz.*konto/i }).click();

    await expect(page).toHaveURL('/login');
  });
});

test.describe('Registration Flow', () => {
  test('should allow login after successful registration', async ({ page }) => {
    const email = generateUniqueEmail();
    const password = 'Test123!@#';

    // Register
    await page.goto('/register');
    await page.getByLabel('Nazwa firmy').fill('Flow Test Company');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Hasło').fill(password);
    await page.getByRole('button', { name: /zarejestruj/i }).click();

    // Wait for registration to complete
    await page.waitForTimeout(2000);

    // Navigate to login
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Hasło').fill(password);
    await page.getByRole('button', { name: /zaloguj/i }).click();

    // Expect successful login
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });
});
