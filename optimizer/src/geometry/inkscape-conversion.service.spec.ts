import { Test, TestingModule } from '@nestjs/testing';
import { InkscapeConversionService } from './inkscape-conversion.service';

describe('InkscapeConversionService', () => {
  let service: InkscapeConversionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InkscapeConversionService],
    }).compile();

    service = module.get<InkscapeConversionService>(InkscapeConversionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('convertPdfPageToSvg', () => {
    it('should be defined', () => {
      expect(typeof service.convertPdfPageToSvg).toBe('function');
    });
  });

  describe('convertPdfToSvg', () => {
    it('should be defined', () => {
      expect(typeof service.convertPdfToSvg).toBe('function');
    });
  });
});
