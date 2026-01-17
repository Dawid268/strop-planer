import { APIRequestContext } from '@playwright/test';

const API_URL = 'http://localhost:3000';

/**
 * API helper functions for E2E tests
 */

export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<{ token: string; user: any }> {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  return response.json();
}

export async function apiRegister(
  request: APIRequestContext,
  data: { email: string; password: string; companyName: string; phone?: string }
): Promise<any> {
  const response = await request.post(`${API_URL}/auth/register`, {
    data,
  });
  return response.json();
}

export async function apiCreateProject(
  request: APIRequestContext,
  token: string,
  project: {
    name: string;
    slabLength: number;
    slabWidth: number;
    slabThickness: number;
    floorHeight: number;
    description?: string;
  }
): Promise<any> {
  const response = await request.post(`${API_URL}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
    data: project,
  });
  return response.json();
}

export async function apiDeleteProject(
  request: APIRequestContext,
  token: string,
  projectId: string
): Promise<void> {
  await request.delete(`${API_URL}/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function apiGetProjects(
  request: APIRequestContext,
  token: string
): Promise<any[]> {
  const response = await request.get(`${API_URL}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

export async function apiCleanupTestData(
  request: APIRequestContext,
  token: string
): Promise<void> {
  const projects = await apiGetProjects(request, token);
  for (const project of projects) {
    if (project.name.includes('Test') || project.name.includes('test')) {
      await apiDeleteProject(request, token, project.id);
    }
  }
}
