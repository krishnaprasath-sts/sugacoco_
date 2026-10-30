import type { z } from 'zod';
import { HttpError } from './error.js';

/** Parse request data with a Zod schema; throws a 400 with field errors if invalid. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      fields[key] ??= issue.message;
    }
    throw new HttpError(400, 'Please check the highlighted fields', { fields });
  }
  return result.data;
}
