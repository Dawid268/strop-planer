import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Response interfaces for type safety
interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

interface ProjectResponse {
  id: string;
  name: string;
  description: string;
  slabArea: number;
  status: string;
  calculationResult?: unknown;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

describe('ProjectsController (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let projectId: string;

  const testUser = {
    email: `projects-test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    companyName: 'Test Company',
  };

  const testProject = {
    name: 'Test Project E2E',
    description: 'Test description',
    slabLength: 10,
    slabWidth: 8,
    slabThickness: 0.25,
    floorHeight: 3,
    formworkSystem: 'PERI_SKYDECK',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(testUser);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });
    const loginBody = loginResponse.body as LoginResponse;
    accessToken = loginBody.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/projects', () => {
    it('should create a new project', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(testProject)
        .expect(201);

      const body = response.body as ProjectResponse;
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('name', testProject.name);
      expect(body).toHaveProperty('slabArea', 80);
      expect(body).toHaveProperty('status', 'draft');

      projectId = body.id;
    });

    it('should fail without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .send(testProject)
        .expect(401);
    });
  });

  describe('GET /api/v1/projects', () => {
    it('should return paginated list of projects', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse<ProjectResponse>;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('meta');
      expect(body.meta).toHaveProperty('total');
      expect(body.meta).toHaveProperty('page', 1);
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('should support pagination parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/projects?page=1&limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse<ProjectResponse>;
      expect(body.meta.limit).toBe(5);
    });
  });

  describe('GET /api/v1/projects/:id', () => {
    it('should return project by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as ProjectResponse;
      expect(body.id).toBe(projectId);
      expect(body.name).toBe(testProject.name);
    });

    it('should return 404 for non-existent project', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/projects/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PUT /api/v1/projects/:id', () => {
    it('should update project', async () => {
      const updateData = {
        name: 'Updated Project Name',
        description: 'Updated description',
      };

      const response = await request(app.getHttpServer())
        .put(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      const body = response.body as ProjectResponse;
      expect(body.name).toBe(updateData.name);
      expect(body.description).toBe(updateData.description);
    });
  });

  describe('POST /api/v1/projects/:id/calculate', () => {
    it('should calculate formwork for project', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/projects/${projectId}/calculate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const body = response.body as ProjectResponse;
      expect(body).toHaveProperty('calculationResult');
      expect(body.status).toBe('calculated');
    });
  });

  describe('GET /api/v1/projects/stats', () => {
    it('should return project statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/projects/stats')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalProjects');
      expect(response.body).toHaveProperty('draftCount');
      expect(response.body).toHaveProperty('totalArea');
    });
  });

  describe('DELETE /api/v1/projects/:id', () => {
    it('should delete project', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
