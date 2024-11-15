import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import z from 'zod';
import type { ZodEnvConfig } from './types';
import { zodenv } from './zodenv';

describe('ZodEnv', () => {
  describe('Invalid configuration', () => {
    it('throws when the parameter is not an object', () => {
      assert.throws(() => zodenv(1 as unknown as ZodEnvConfig), {
        name: 'ZodEnvError',
        message: 'The configuration must be defined as an object',
      });
    });

    it('throws when environment name is not a non-empty string', () => {
      assert.throws(
        () =>
          zodenv({
            db: {
              host: ['', z.string()],
            },
          }),
        {
          name: 'ZodEnvError',
          message: 'Missing environment variable name for "db.host"',
        },
      );
    });

    it('throws when zod schema is not provided', () => {
      assert.throws(
        () =>
          zodenv({
            name: ['HELLO', 123 as unknown as z.ZodType],
          }),
        {
          name: 'ZodEnvError',
          message: 'The provided schema is not a Zod type',
        },
      );
    });

    it('throws when env variables fail the validation', () => {
      assert.throws(
        () =>
          zodenv({
            name: ['NAME', z.string()],
          }),
        {
          name: 'ZodEnvError',
          message: /^Configuration does not match the provided schema for "name"/,
        },
      );
    });
  });

  describe('Accessors', () => {
    const originalEnv = structuredClone(process.env);

    afterEach(() => {
      process.env = originalEnv;
    });

    it('returns both root and nested configs', () => {
      process.env.PORT = '3000';
      process.env.HTTP2 = 'true';
      process.env.DB_HOST = 'localhost:5432';
      process.env.DB_DRIVER = 'pgsql';
      process.env.DB_TABLES = 'users,pages';
      process.env.ADMIN_CREDENTIALS = '{"name": "admin", "password": "12345"}';

      const config = zodenv({
        name: ['NAME', z.string().default('my-app')],
        port: ['PORT', z.coerce.number()],
        http2: ['HTTP2', z.string().transform((s) => s === 'true')],
        database: {
          host: ['DB_HOST', z.string()],
          driver: ['DB_DRIVER', z.enum(['mysql', 'pgsql', 'sqlite'])],
          tables: ['DB_TABLES', z.preprocess((s) => String(s).split(','), z.array(z.string()))],
        },
        adminCredentials: [
          'ADMIN_CREDENTIALS',
          z
            .string()
            .transform((s) => JSON.parse(s))
            .pipe(
              z.object({
                name: z.string(),
                password: z.string(),
              }),
            ),
        ],
      });

      assert.equal(config('name'), 'my-app');
      assert.equal(config('port'), 3000);
      assert.equal(config('http2'), true);
      assert.equal(config('database.host'), 'localhost:5432');
      assert.equal(config('database.driver'), 'pgsql');
      assert.deepEqual(config('database.tables'), ['users', 'pages']);
      assert.deepEqual(config('adminCredentials'), { name: 'admin', password: '12345' });
    });
  });
});
