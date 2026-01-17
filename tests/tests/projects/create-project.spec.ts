import { test, expect } from '@playwright/test';
import { generateUniqueEmail, testProjects } from '../../fixtures/test-data';
import { apiLogin, apiRegister } from '../../utils/api.helper';

/**
 * Projects CRUD E2E Tests
 */

test.describe('Projects CRUD', () => {
  let authToken: string;
  let userEmail: string;
  const userPassword = 'Test123!@#';

  test.beforeAll(async ({ request }) => {
    // Create test user via API
    userEmail = generateUniqueEmail();
    await apiRegister(request, {
      email: userEmail,
      password: userPassword,
      companyName: 'Projects Test Company',
    });
    const { token } = await apiLogin(request, userEmail, userPassword);
    authToken = token;
  });

  test.beforeEach(async ({ page }) => {
    // Login via UI
    await page.goto('/login');
    await page.getByLabel('Email').fill(userEmail);
    await page.getByLabel('Hasło').fill(userPassword);
    await page.getByRole('button', { name: /zaloguj/i }).click();
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });

  test('should display projects list page', async ({ page }) => {
    await page.goto('/projects');

    await expect(
      page.getByRole('heading', { name: /projekty/i })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /nowy projekt/i })
    ).toBeVisible();
  });

  test('should show empty state when no projects exist', async ({ page }) => {
    await page.goto('/projects');

    // Empty state or table should be visible
    await expect(
      page.getByText(/brak projektów/i).or(page.locator('table'))
    ).toBeVisible({ timeout: 5000 });
  });

  test('should open new project dialog', async ({ page }) => {
    await page.goto('/projects');

    await page.getByRole('button', { name: /nowy projekt/i }).click();

    // Dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
    await expect(
      page.getByRole('heading', { name: /nowy projekt/i })
    ).toBeVisible();
  });

  test('should create new project with valid data', async ({ page }) => {
    await page.goto('/projects');

    // Open dialog
    await page.getByRole('button', { name: /nowy projekt/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill form
    await page.getByLabel('Nazwa projektu').fill(testProjects.medium.name);
    await page
      .getByLabel(/długość/i)
      .fill(testProjects.medium.slabLength.toString());
    await page
      .getByLabel(/szerokość/i)
      .fill(testProjects.medium.slabWidth.toString());
    await page
      .getByLabel(/grubość/i)
      .fill(testProjects.medium.slabThickness.toString());
    await page
      .getByLabel(/wysokość/i)
      .fill(testProjects.medium.floorHeight.toString());

    // Submit
    await page.getByRole('button', { name: /utwórz|zapisz/i }).click();

    // Dialog should close and project appear in list
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText(testProjects.medium.name)).toBeVisible({
      timeout: 5000,
    });
  });

  test('should display project in table after creation', async ({
    page,
    request,
  }) => {
    // Create project via API
    const token = authToken;
    await request.post('http://localhost:3000/projects', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name: 'API Created Project',
        slabLength: 15,
        slabWidth: 12,
        slabThickness: 0.25,
        floorHeight: 3.0,
      },
    });

    await page.goto('/projects');

    await expect(page.getByText('API Created Project')).toBeVisible({
      timeout: 5000,
    });
  });

  test('should navigate to editor when clicking on project', async ({
    page,
    request,
  }) => {
    // Create project via API
    const response = await request.post('http://localhost:3000/projects', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        name: 'Editor Test Project',
        slabLength: 10,
        slabWidth: 8,
        slabThickness: 0.25,
        floorHeight: 3.0,
      },
    });
    const project = await response.json();

    await page.goto('/projects');

    // Click on project name/row
    await page.getByText('Editor Test Project').click();

    // Should navigate to editor
    await expect(page).toHaveURL(new RegExp(`/projects/${project.id}`), {
      timeout: 5000,
    });
  });

  test('should delete project', async ({ page, request }) => {
    // Create project via API
    await request.post('http://localhost:3000/projects', {
      headers: { Authorization: `Bearer ${authToken}` },
      data: {
        name: 'Delete Test Project',
        slabLength: 5,
        slabWidth: 5,
        slabThickness: 0.2,
        floorHeight: 2.8,
      },
    });

    await page.goto('/projects');
    await expect(page.getByText('Delete Test Project')).toBeVisible();

    // Click menu and delete
    await page
      .getByRole('row', { name: /delete test project/i })
      .getByRole('button', { name: /more|menu/i })
      .click();
    await page.getByRole('menuitem', { name: /usuń/i }).click();

    // Confirm deletion in browser dialog
    page.once('dialog', (dialog) => dialog.accept());

    // Project should be removed
    await expect(page.getByText('Delete Test Project')).not.toBeVisible({
      timeout: 5000,
    });
  });
});
