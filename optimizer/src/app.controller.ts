import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { AppService } from '@/app.service';
import { HEALTH_STATUS } from '@common/constants';

interface HealthCheckResponse {
  status: string;
  timestamp: string;
}

@ApiTags('Health')
@Controller({ version: '1', path: '' })
export class AppController {
  public constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  public getHealth(): HealthCheckResponse {
    return {
      status: HEALTH_STATUS.OK,
      timestamp: new Date().toISOString(),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Welcome message' })
  public getHello(): string {
    return this.appService.getHello();
  }
}
