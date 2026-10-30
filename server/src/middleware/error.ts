import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { isProd } from '../config/env.js';

const MAX_FILE_MB = 15; // keep in sync with lib/upload.ts

/** Throw this from routes/services to send a clean error to the client. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ message: 'Not found' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, details: err.details });
    return;
  }
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? `Each file must be under ${MAX_FILE_MB} MB`
      : err.code === 'LIMIT_FILE_COUNT' ? 'Upload at most 10 files at a time'
      : 'Upload failed. Please try again.';
    res.status(400).json({ message });
    return;
  }
  // Malformed JSON body
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'Invalid request' });
    return;
  }
  console.error(err);
  res.status(500).json({ message: isProd ? 'Internal server error' : String(err?.message ?? err) });
};
