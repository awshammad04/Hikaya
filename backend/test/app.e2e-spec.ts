import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { catalog } from './../src/database/seed/palestine-data';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/v1 (GET) describes the branded API with the existing endpoints', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect(
        ({
          body,
        }: {
          body: { name: string; version: string; endpoints: string[] };
        }) => {
          expect(body.name).toBe('Hikaya API');
          expect(body.version).toBe('v1');
          expect(body.endpoints).toContain('GET  /api/v1/locations');
        },
      );
  });

  it('keeps the legacy location list at eight while offering twenty-six nationally', async () => {
    const legacy = await request(app.getHttpServer())
      .get('/api/v1/locations')
      .expect(200);
    const national = await request(app.getHttpServer())
      .get('/api/v1/locations?scope=all')
      .expect(200);
    expect(legacy.body).toHaveLength(8);
    expect(
      (legacy.body as { governorateId: string }[]).every(
        (item: { governorateId: string }) => item.governorateId === 'jerusalem',
      ),
    ).toBe(true);
    expect(national.body).toHaveLength(26);
  });

  it('lists the catalogue governorates and keeps their locations scoped', async () => {
    const result = await request(app.getHttpServer())
      .get('/api/v1/governorates')
      .expect(200);
    // PostgreSQL lists governorates by name; the in-memory seed keeps catalogue order.
    expect(
      (result.body as { id: string }[]).map((item) => item.id).sort(),
    ).toEqual(catalog.governorates.map((item) => item.id).sort());
    for (const { id } of catalog.governorates.slice(1)) {
      const scoped = await request(app.getHttpServer())
        .get(`/api/v1/governorates/${id}/locations`)
        .expect(200);
      expect(scoped.body).toHaveLength(
        catalog.locations.filter((item) => item.governorateId === id).length,
      );
      expect(
        (scoped.body as { governorateId: string }[]).every(
          (item: { governorateId: string }) => item.governorateId === id,
        ),
      ).toBe(true);
    }
  });

  it('rejects invalid journey preferences and cross-governorate story retrieval', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/journeys')
      .send({
        governorateIds: ['gaza'],
        language: 'xx',
        interests: ['invented'],
        duration: 'express',
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/ai/generate-story')
      .send({ locationId: 'palestinian-museum', governorateId: 'gaza' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/ai/ask-guide')
      .send({
        question: 'Tell me the history',
        locationIds: ['palestinian-museum'],
        governorateIds: ['gaza'],
      })
      .expect(400);
  });
});
