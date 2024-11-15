import assert from 'node:assert';
import { ZodType } from 'zod';
import type {
  EnvWithZodType,
  ObjectPathName,
  ObjectPathType,
  PathSplit,
  ZodEnvConfig,
} from './types';

export class ZodEnvError extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'ZodEnvError';
    this.cause = cause;
  }
}

const walk = (map: Map<string, unknown>, entry: ZodEnvConfig | EnvWithZodType, prefix = '') => {
  if (Array.isArray(entry)) {
    const [envName, schema] = entry;

    assert(
      typeof envName === 'string' && envName.length > 0,
      new ZodEnvError(`Missing environment variable name for "${prefix}"`),
    );
    assert(schema instanceof ZodType, new ZodEnvError('The provided schema is not a Zod type'));

    const { data, error } = schema.safeParse(process.env[envName]);

    if (error) {
      throw new ZodEnvError(
        `Configuration does not match the provided schema for "${prefix}": ${error.message}`,
        error,
      );
    }

    map.set(prefix, data);
  } else {
    for (const [name, value] of Object.entries(entry)) {
      const newPrefix = prefix ? `${prefix}.${name}` : name;
      walk(map, value, newPrefix);
    }
  }
};

export const zodenv = <T extends ZodEnvConfig>(config: T) => {
  assert(
    typeof config === 'object',
    new ZodEnvError('The configuration must be defined as an object'),
  );

  const map = new Map<string, unknown>();

  walk(map, config);

  return <U extends ObjectPathName<T>>(key: U) => map.get(key) as ObjectPathType<T, PathSplit<U>>;
};
