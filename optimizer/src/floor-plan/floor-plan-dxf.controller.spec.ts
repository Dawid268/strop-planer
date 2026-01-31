/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { FloorPlanDxfController } from './floor-plan-dxf.controller';
import { DxfConversionService, DxfData } from './dxf-conversion.service';
import type { Response } from 'express';

describe('FloorPlanDxfController', () => {
  let controller: FloorPlanDxfController;
  let dxfService: DxfConversionService;

  const mockDxfData: DxfData = {
    entities: [
      {
        type: 'LINE',
        layer: 'default',
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 100, y: 100 },
      },
    ],
    layers: ['default'],
    bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
  };

  const mockDxfService = {
    processUploadedFile: jest.fn(),
    getFloorPlanData: jest.fn(),
    getRawDxfContent: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FloorPlanDxfController],
      providers: [
        {
          provide: DxfConversionService,
          useValue: mockDxfService,
        },
      ],
    }).compile();

    controller = module.get<FloorPlanDxfController>(FloorPlanDxfController);
    dxfService = module.get<DxfConversionService>(DxfConversionService);
  });

  describe('uploadFloorPlan', () => {
    it('should process uploaded file and return document ID and data', async () => {
      const mockFile = {
        filename: 'test-123.dxf',
        path: '/tmp/test-123.dxf',
        originalname: 'floor-plan.dxf',
      } as Express.Multer.File;

      mockDxfService.processUploadedFile.mockResolvedValue({
        documentId: 'test-123',
        data: mockDxfData,
      });

      const result = await controller.uploadFloorPlan(mockFile);

      expect(result.documentId).toBe('test-123');
      expect(result.data).toEqual(mockDxfData);
      expect(dxfService.processUploadedFile).toHaveBeenCalledWith(mockFile);
    });

    it('should handle PDF file upload', async () => {
      const mockFile = {
        filename: 'test-456.pdf',
        path: '/tmp/test-456.pdf',
        originalname: 'floor-plan.pdf',
      } as Express.Multer.File;

      mockDxfService.processUploadedFile.mockResolvedValue({
        documentId: 'test-456',
        data: mockDxfData,
      });

      const result = await controller.uploadFloorPlan(mockFile);

      expect(result.documentId).toBe('test-456');
      expect(dxfService.processUploadedFile).toHaveBeenCalledWith(mockFile);
    });
  });

  describe('getFloorPlanData', () => {
    it('should return floor plan data for valid document ID', async () => {
      mockDxfService.getFloorPlanData.mockResolvedValue(mockDxfData);

      const result = await controller.getFloorPlanData('test-123');

      expect(result).toEqual(mockDxfData);
      expect(dxfService.getFloorPlanData).toHaveBeenCalledWith('test-123');
    });

    it('should handle service errors', async () => {
      mockDxfService.getFloorPlanData.mockRejectedValue(
        new Error('Data not found'),
      );

      await expect(controller.getFloorPlanData('invalid')).rejects.toThrow(
        'Data not found',
      );
    });
  });

  describe('getRawDxf', () => {
    it('should return raw DXF content with proper headers', async () => {
      const mockContent = '0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF';
      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      mockDxfService.getRawDxfContent.mockResolvedValue(mockContent);

      await controller.getRawDxf('test-123', mockResponse);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/dxf',
      );
      expect(mockResponse.send).toHaveBeenCalledWith(mockContent);
      expect(dxfService.getRawDxfContent).toHaveBeenCalledWith('test-123');
    });

    it('should handle service errors', async () => {
      const mockResponse = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as unknown as Response;

      mockDxfService.getRawDxfContent.mockRejectedValue(
        new Error('DXF not found'),
      );

      await expect(
        controller.getRawDxf('invalid', mockResponse),
      ).rejects.toThrow('DXF not found');
    });
  });
});
