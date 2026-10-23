import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database/database.service';

export interface ServiceStatus {
  status: string;
  /** `postgres` when DATABASE_URL is reachable, otherwise `in-memory-seed`. */
  dataSource: 'postgres' | 'in-memory-seed';
  aiServiceUrl: string;
  timestamp: string;
}

@Injectable()
export class AppService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  getInfo() {
    return {
      name: 'Hikaya API',
      description:
        'AI-powered personalized guide and living heritage archive across Palestine.',
      version: 'v1',
      endpoints: [
        'GET  /api/v1/health',
        'GET  /api/v1/locations',
        'GET  /api/v1/governorates',
        'GET  /api/v1/governorates/:id/locations',
        'POST /api/v1/journeys',
        'GET  /api/v1/locations/:id',
        'GET  /api/v1/stories/:locationId',
        'GET  /api/v1/stories/detail/:id',
        'GET  /api/v1/contributions',
        'POST /api/v1/contributions',
        'POST /api/v1/ai/generate-story',
        'POST /api/v1/ai/ask-guide',
        'POST /api/v1/auth/signup | login | logout',
        'GET  /api/v1/auth/me',
        'GET  /api/v1/me/progress | photos | stories | contributions',
      ],
      documentation: 'backend/README.md',
    };
  }

  getHealth(): ServiceStatus {
    return {
      status: 'ok',
      dataSource: this.database.isAvailable() ? 'postgres' : 'in-memory-seed',
      aiServiceUrl:
        process.env.NODE_ENV === 'production'
          ? 'internal'
          : (this.config.get<string>('AI_SERVICE_URL') ??
            'http://localhost:8001'),
      timestamp: new Date().toISOString(),
    };
  }

  async checkReadiness(): Promise<ServiceStatus> {
    try {
      await this.database.checkHealth();
    } catch {
      throw new ServiceUnavailableException('PostgreSQL is unavailable.');
    }
    return this.getHealth();
  }
}
