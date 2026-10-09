import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseService } from './database/database.service';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: DatabaseService, useValue: { isAvailable: () => false } },
        {
          provide: ConfigService,
          useValue: { get: () => 'http://localhost:8001' },
        },
      ],
    }).compile();

    controller = app.get<AppController>(AppController);
  });

  it('describes the API and its endpoints', () => {
    const info = controller.getInfo();
    expect(info.name).toBe('Hikaya API');
    expect(info.endpoints).toContain('GET  /api/v1/locations');
  });

  it('reports the in-memory seed when no database is connected', () => {
    const health = controller.getHealth();
    expect(health.status).toBe('ok');
    expect(health.dataSource).toBe('in-memory-seed');
  });
});
