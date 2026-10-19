import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, QueryResult, QueryResultRow } from 'pg';

/**
 * Thin wrapper around a PostgreSQL connection pool.
 *
 * The backend is designed to start with or without a database. `connect()`
 * probes the server once at boot; if DATABASE_URL is missing or the server is
 * unreachable, the service marks itself unavailable and the repository
 * factories fall back to the in-memory seed (see database.module.ts).
 *
 * That is a deliberate MVP choice: a reviewer can clone the repository and get
 * working endpoints with real seeded data immediately, and the same code paths
 * hit real PostgreSQL as soon as DATABASE_URL points at one.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool | null = null;
  private available = false;

  async connect(connectionString?: string): Promise<void> {
    if (!connectionString) {
      if (process.env.NODE_ENV === 'production')
        throw new Error('DATABASE_URL is required in production.');
      this.logger.warn(
        'DATABASE_URL is not set - serving seeded in-memory data. ' +
          'Run database/schema.sql and database/seed.sql, then set DATABASE_URL, to use PostgreSQL.',
      );
      return;
    }

    const pool = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX || 10),
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
    });

    // A pool emits errors on idle clients (e.g. the server restarts). Without a
    // listener those crash the process.
    pool.on('error', (error) =>
      this.logger.error(`Idle PostgreSQL client error: ${error.message}`),
    );

    try {
      await pool.query('SELECT 1');
      if (process.env.NODE_ENV === 'production') {
        await pool.query(
          'SELECT l.governorate_id, l.review_status, c.reference_code FROM locations l LEFT JOIN contributions c ON false LIMIT 0',
        );
        const result = await pool.query<{ count: string }>(
          'SELECT COUNT(*)::text AS count FROM locations WHERE is_published',
        );
        if (Number(result.rows[0].count) < 14)
          throw new Error(
            'Initialize the new database with all Jerusalem and Palestine data before starting production.',
          );
      }
      this.pool = pool;
      this.available = true;
      this.logger.log('Connected to PostgreSQL.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not reach PostgreSQL (${message}) - serving seeded in-memory data instead.`,
      );
      await pool.end().catch(() => undefined);
      if (process.env.NODE_ENV === 'production')
        throw new Error(
          'Production PostgreSQL is unavailable or uninitialized. See the database initialization instructions.',
        );
    }
  }

  isAvailable(): boolean {
    return this.available;
  }

  async checkHealth(): Promise<void> {
    if (this.pool) await this.pool.query('SELECT 1');
    else if (process.env.NODE_ENV === 'production')
      throw new Error('PostgreSQL is unavailable.');
  }

  async query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error(
        'DatabaseService.query called while no database is connected.',
      );
    }
    return this.pool.query<T>(text, params);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end().catch(() => undefined);
      this.pool = null;
      this.available = false;
    }
  }
}
