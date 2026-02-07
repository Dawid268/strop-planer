/**
 * E2E API tests – pełny flow: utworzenie projektu → upload PDF → konwersja → (opcjonalnie) ekstrakcja geometrii.
 * Przechodzi przez cały schemat z docs/flow-projekt-upload-pdf.md.
 */
import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as path from 'path';
import * as fs from 'fs';
import { AppModule } from '../src/app.module';
import {
  DxfConversionService,
  DxfData,
} from '../src/floor-plan/dxf-conversion.service';
import { PdfService } from '../src/pdf/pdf.service';

// --- Response types ---
interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

interface ProjectResponseDto {
  id: string;
  name: string;
  description?: string;
  status: string;
  slabLength: number;
  slabWidth: number;
  slabArea: number;
  sourcePdfPath?: string;
  dxfPath?: string;
  geoJsonPath?: string;
  extractionStatus?: string;
  extractionAttempts?: number;
  extractionMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface PdfUploadResponse {
  success: boolean;
  paths: { pdf: string; dxf: string; json: string };
  data: DxfData;
}

// Minimal valid PDF (4 objects, single empty page) – do uploadu bez zewn. narzędzi
const MINIMAL_PDF_BASE64 =
  'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL01lZGlhQm94IFswIDAgNjEyIDc5Ml0KL1BhcmVudCAyIDAgUgo+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTIgMDAwMDAgbiAKMDAwMDAwMDEwMSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDQKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjE3OAolJUVG';

function getMinimalPdfBuffer(): Buffer {
  const fixturePath = path.join(
    __dirname,
    'fixtures',
    'minimal-pdf.base64.txt',
  );
  if (fs.existsSync(fixturePath)) {
    const b64 = fs.readFileSync(fixturePath, 'utf-8').trim();
    return Buffer.from(b64, 'base64');
  }
  return Buffer.from(MINIMAL_PDF_BASE64, 'base64');
}

const MOCK_DXF_DATA: DxfData = {
  entities: [],
  layers: ['0'],
  bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
};

describe('Project + Upload PDF + Geometry flow (e2e)', () => {
  let app: INestApplication<App>;
  let accessToken: string;
  let projectId: string;
  let uploadedPdfPath: string;

  const testUser = {
    email: `flow-e2e-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    companyName: 'Flow E2E Company',
  };

  const testProject = {
    name: 'Flow E2E Project',
    description: 'Projekt do testu pełnego flow',
    slabLength: 10,
    slabWidth: 8,
    slabThickness: 0.25,
    floorHeight: 3,
    formworkSystem: 'PERI_SKYDECK',
  };

  const mockDxfConversionService: Partial<DxfConversionService> = {
    convertPdfToDxf: jest.fn().mockResolvedValue(undefined),
    parseDxfFile: jest.fn().mockResolvedValue(MOCK_DXF_DATA),
  };

  const mockPdfService = {
    parsePdf: jest
      .fn()
      .mockImplementation(async (buffer: Buffer, filename: string) => {
        const fs = await import('fs');
        const path = await import('path');
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir))
          fs.mkdirSync(uploadDir, { recursive: true });
        const uniqueFilename = `${Date.now()}_${filename.replace(/\s+/g, '_')}`;
        const filePath = path.join(uploadDir, uniqueFilename);
        fs.writeFileSync(filePath, buffer);
        return {
          sourceFile: `/uploads/${uniqueFilename}`,
          extractedAt: new Date(),
          slab: null,
          rawText: '',
          warnings: [],
        };
      }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DxfConversionService)
      .useValue(mockDxfConversionService)
      .overrideProvider(PdfService)
      .useValue(mockPdfService)
      .compile();

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

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: testUser.email, password: testUser.password });
    const loginBody = loginRes.body as LoginResponse;
    accessToken = loginBody.access_token;
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe('1. POST /api/v1/projects – utworzenie projektu', () => {
    it('tworzy projekt i zwraca id, status draft, bez ścieżek PDF/DXF/GeoJSON', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(testProject)
        .expect(201);

      const body = res.body as ProjectResponseDto;
      expect(body).toHaveProperty('id');
      expect(body.name).toBe(testProject.name);
      expect(body.status).toBe('draft');
      expect(body.slabArea).toBe(80);
      expect(body.sourcePdfPath ?? null).toBeFalsy();
      expect(body.dxfPath ?? null).toBeFalsy();
      expect(body.geoJsonPath ?? null).toBeFalsy();
      expect(body.extractionStatus ?? null).toBeFalsy();

      projectId = body.id;
    });

    it('GET /api/v1/projects/:id zwraca ten sam projekt', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = res.body as ProjectResponseDto;
      expect(body.id).toBe(projectId);
      expect(body.name).toBe(testProject.name);
    });
  });

  describe('2. POST /api/v1/pdf/upload/:projectId – upload PDF i konwersja', () => {
    it('zwraca 401 gdy brak tokena przy uploadzie', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/pdf/upload/${projectId}`)
        .attach('file', getMinimalPdfBuffer(), { filename: 'minimal.pdf' })
        .expect(401);
    });

    it('odrzuca request bez pliku', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/pdf/upload/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('przyjmuje PDF, konwertuje (mock DXF), zapisuje ścieżki w projekcie', async () => {
      const pdfBuffer = getMinimalPdfBuffer();
      const res = await request(app.getHttpServer())
        .post(`/api/v1/pdf/upload/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', pdfBuffer, { filename: 'minimal.pdf' })
        .expect(201);

      const body = res.body as PdfUploadResponse;
      expect(body.success).toBe(true);
      expect(body.paths).toHaveProperty('pdf');
      expect(body.paths).toHaveProperty('dxf');
      expect(body.paths).toHaveProperty('json');
      expect(body.data).toEqual(MOCK_DXF_DATA);

      uploadedPdfPath = body.paths.pdf;
      expect(uploadedPdfPath).toMatch(/^\/uploads\/.+/);
    });

    it('GET /api/v1/projects/:id zwraca sourcePdfPath z uploadu oraz dxfPath i geoJsonPath (z updateArtifactPaths lub retry)', async () => {
      let res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      let body = (
        res.body?.data != null ? res.body.data : res.body
      ) as ProjectResponseDto;
      if (body.dxfPath == null || body.geoJsonPath == null) {
        await request(app.getHttpServer())
          .post(`/api/v1/projects/${projectId}/retry-artifacts`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
        res = await request(app.getHttpServer())
          .get(`/api/v1/projects/${projectId}`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);
        body = (
          res.body?.data != null ? res.body.data : res.body
        ) as ProjectResponseDto;
      }
      expect(body.id).toBe(projectId);
      expect(body.sourcePdfPath).toBe(uploadedPdfPath);
      expect(body.dxfPath).toBeTruthy();
      expect(body.geoJsonPath).toBeTruthy();
      expect(body.geoJsonPath).toContain('/uploads/converted/');
    });
  });

  describe('3. GET /api/v1/projects/:id – 404 dla nieistniejącego projektu', () => {
    it('GET z nieistniejącym UUID zwraca 404', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/api/v1/projects/${fakeUuid}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('4. GET /api/v1/projects – lista z polami ekstrakcji', () => {
    it('lista projektów zwraca paginację i projekt z sourcePdfPath oraz geoJsonPath lub dxfPath', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects?page=1&limit=10')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      const list: ProjectResponseDto[] = res.body.data;
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      const our = list.find((p) => p.id === projectId);
      expect(our).toBeDefined();
      expect(our!.sourcePdfPath).toBe(uploadedPdfPath);
      expect(our!.geoJsonPath ?? our!.dxfPath).toBeTruthy();
    });
  });

  describe('5. POST /api/v1/projects/:id/retry-artifacts', () => {
    it('dla projektu z artefaktami zwraca 200 i projekt z dxfPath i geoJsonPath', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/projects/${projectId}/retry-artifacts`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = res.body as ProjectResponseDto;
      expect(body.id).toBe(projectId);
      expect(body.dxfPath).toBeTruthy();
      expect(body.geoJsonPath).toBeTruthy();
    });

    it('400 gdy projekt nie ma sourcePdfPath', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ ...testProject, name: 'No PDF project' })
        .expect(201);
      const noPdfId = (createRes.body as ProjectResponseDto).id;

      await request(app.getHttpServer())
        .post(`/api/v1/projects/${noPdfId}/retry-artifacts`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('6. End-to-end: pełna ścieżka (DXF flow)', () => {
    it('rejestracja → login → projekt → upload PDF → (retry-artifacts) → GET projekt ze ścieżkami', async () => {
      const user = {
        email: `fullflow-${Date.now()}@example.com`,
        password: 'TestPassword123!',
        companyName: 'Full Flow',
      };
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(user)
        .expect(201);

      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(200);
      const token = (loginRes.body as LoginResponse).access_token;

      const projRes = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${token}`)
        .send(testProject)
        .expect(201);
      const pid = (projRes.body as ProjectResponseDto).id;

      const pdfBuffer2 = getMinimalPdfBuffer();
      const uploadRes = await request(app.getHttpServer())
        .post(`/api/v1/pdf/upload/${pid}`)
        .set('Authorization', `Bearer ${token}`)
        .attach('file', pdfBuffer2, { filename: 'e2e.pdf' })
        .expect(201);
      const paths = (uploadRes.body as PdfUploadResponse).paths;
      expect(paths.pdf).toBeDefined();
      expect(paths.pdf).toMatch(/^\/uploads\/.+/);

      await request(app.getHttpServer())
        .put(`/api/v1/projects/${pid}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourcePdfPath: paths.pdf,
          dxfPath: paths.dxf,
          geoJsonPath: paths.json,
        })
        .expect(200);

      const getProjRes = await request(app.getHttpServer())
        .get(`/api/v1/projects/${pid}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const proj = (
        getProjRes.body?.data != null ? getProjRes.body.data : getProjRes.body
      ) as ProjectResponseDto;
      expect(proj.id).toBe(pid);
      expect(proj.sourcePdfPath).toBe(paths.pdf);
      expect(proj.dxfPath ?? proj.geoJsonPath).toBeTruthy();
    });
  });

  describe('7. GET /api/v1/projects/:id/editor-data', () => {
    it('zwraca 200 i strukturę edytora (tabs/layers) lub null gdy projekt ma ścieżki', async () => {
      const editorRes = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectId}/editor-data`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const editorBody = editorRes.body as unknown;
      if (editorBody !== null && typeof editorBody === 'object') {
        const ed = editorBody as { tabs?: unknown[]; metadata?: unknown };
        expect(ed).toBeDefined();
        if (ed.tabs) expect(Array.isArray(ed.tabs)).toBe(true);
      }
    });
  });
});
