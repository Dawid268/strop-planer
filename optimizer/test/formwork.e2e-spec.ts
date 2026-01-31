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

interface FormworkSystem {
  id: string;
  name: string;
  manufacturer: string;
}

interface FormworkHealthResponse {
  status: string;
  systems: string[];
}

interface FormworkSystemsResponse {
  systems: FormworkSystem[];
}

interface FormworkElement {
  id: string;
  type: string;
  quantity: number;
}

interface FormworkLayoutResponse {
  id: string;
  system: string;
  slabArea: number;
  elements: FormworkElement[];
}

describe('FormworkController (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let layoutId: string;

  const testUser = {
    email: `formwork-test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    companyName: 'Test Company',
  };

  const testSlabData = {
    id: 'test-slab',
    dimensions: { length: 10, width: 8, thickness: 0.25, area: 80 },
    type: 'monolityczny',
    beams: [],
    reinforcement: [],
    axes: { horizontal: [], vertical: [] },
  };

  const testParams = {
    slabArea: 80,
    slabThickness: 0.25,
    floorHeight: 3,
    includeBeams: true,
    preferredSystem: 'PERI_SKYDECK',
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

  describe('GET /api/v1/formwork', () => {
    it('should return health status with systems list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/formwork')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as FormworkHealthResponse;
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('systems');
      expect(body.systems).toContain('PERI_SKYDECK');
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/formwork').expect(401);
    });
  });

  describe('GET /api/v1/formwork/systems', () => {
    it('should return list of formwork systems', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/formwork/systems')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as FormworkSystemsResponse;
      expect(body).toHaveProperty('systems');
      expect(Array.isArray(body.systems)).toBe(true);
      expect(body.systems.length).toBeGreaterThan(0);

      const system = body.systems[0];
      expect(system).toHaveProperty('id');
      expect(system).toHaveProperty('name');
      expect(system).toHaveProperty('manufacturer');
    });
  });

  describe('POST /api/v1/formwork/calculate', () => {
    it('should calculate formwork layout', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/formwork/calculate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ slabData: testSlabData, params: testParams })
        .expect(201);

      const body = response.body as FormworkLayoutResponse;
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('system', 'PERI_SKYDECK');
      expect(body).toHaveProperty('elements');
      expect(body).toHaveProperty('slabArea', 80);
      expect(Array.isArray(body.elements)).toBe(true);

      layoutId = body.id;
    });

    it('should fail without slabData', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/formwork/calculate')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ params: testParams })
        .expect(400);
    });
  });

  describe('GET /api/v1/formwork/layout/:layoutId', () => {
    it('should return saved layout', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/formwork/layout/${layoutId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as FormworkLayoutResponse;
      expect(body.id).toBe(layoutId);
      expect(body).toHaveProperty('elements');
    });

    it('should return 404 for non-existent layout', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/formwork/layout/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('POST /api/v1/formwork/optimize/:layoutId', () => {
    it('should optimize formwork layout', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/formwork/optimize/${layoutId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('originalLayout');
      expect(response.body).toHaveProperty('optimizedLayout');
      expect(response.body).toHaveProperty('areaSavings');
      expect(response.body).toHaveProperty('costSavings');
    });

    it('should return 404 for non-existent layout', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/formwork/optimize/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
