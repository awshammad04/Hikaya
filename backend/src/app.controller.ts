import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import type { ServiceStatus } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** GET /api/v1 - what this API is and where the docs are. */
  @Get()
  getInfo() {
    return this.appService.getInfo();
  }

  /** GET /api/v1/health - which data source and AI service are in use. */
  @Get('health')
  getHealth(): ServiceStatus | Promise<ServiceStatus> {
    return process.env.NODE_ENV === 'production'
      ? this.appService.checkReadiness()
      : this.appService.getHealth();
  }
}
