import { Page, expect } from '@playwright/test';

/**
 * Auth helper functions for E2E tests
 */

export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Hasło').fill(password);
  await page.getByRole('button', { name: 'Zaloguj się' }).click();
  await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
}

export async function register(
  page: Page,
  data: { email: string; password: string; companyName: string; phone?: string }
): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Nazwa firmy').fill(data.companyName);
  await page.getByLabel('Email').fill(data.email);
  if (data.phone) {
    await page.getByLabel('Telefon').fill(data.phone);
  }
  await page.getByLabel('Hasło').fill(data.password);
  await page.getByRole('button', { name: 'Zarejestruj się' }).click();
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: /konto|user|menu/i }).click();
  await page.getByRole('menuitem', { name: 'Wyloguj' }).click();
  await expect(page).toHaveURL('/login', { timeout: 5000 });
}

export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    await page.waitForURL('/dashboard', { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export async function registerAndLogin(
  page: Page,
  data: { email: string; password: string; companyName: string; phone?: string }
): Promise<void> {
  await register(page, data);
  // Wait for success message or redirect
  await page.waitForTimeout(1000);
  await login(page, data.email, data.password);
}
