/**
 * File uploads. Files are saved under UPLOAD_DIR/<yyyy>/<mm>/<random>.<ext>,
 * never in a public folder; they are served only through the documents API.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/error.js';

export const MAX_FILE_MB = 15;

// Extension → allowed MIME types. Anything else is rejected.
const ALLOWED: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.webp': ['image/webp'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
};
export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED);

// First bytes of each file type, to catch renamed files (e.g. an .exe renamed to .pdf).
const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  '.pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  '.jpg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  '.jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  '.png': (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  '.webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  '.docx': (b) => b[0] === 0x50 && b[1] === 0x4b, // zip
  '.xlsx': (b) => b[0] === 0x50 && b[1] === 0x4b,
  '.doc': (b) => b.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])), // OLE
  '.xls': (b) => b.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])),
};

export const uploadRoot = path.resolve(env.uploadDir);

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const now = new Date();
    const dir = path.join(uploadRoot, String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0'));
    fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024, files: 10 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED[ext]?.includes(file.mimetype)) {
      cb(new HttpError(400, `File type not allowed. Use: ${ALLOWED_EXTENSIONS.join(', ')}`));
      return;
    }
    cb(null, true);
  },
});

/** Check the saved file's content matches its extension. Deletes it and throws if not. */
export async function verifySignature(file: Express.Multer.File) {
  const ext = path.extname(file.originalname).toLowerCase();
  const handle = await fsp.open(file.path, 'r');
  const head = Buffer.alloc(16);
  try {
    await handle.read(head, 0, 16, 0);
  } finally {
    await handle.close();
  }
  if (!SIGNATURES[ext]?.(head)) {
    await fsp.rm(file.path, { force: true });
    throw new HttpError(400, `"${file.originalname}" does not look like a real ${ext} file`);
  }
}

/** Path stored in DB, relative to the upload root (e.g. 2026/10/abc.pdf). */
export function storedName(file: Express.Multer.File) {
  return path.relative(uploadRoot, file.path).split(path.sep).join('/');
}

/** Absolute path for a stored name, refusing anything outside the upload root. */
export function resolveStored(name: string) {
  const full = path.resolve(uploadRoot, name);
  if (!full.startsWith(uploadRoot + path.sep)) throw new HttpError(404, 'File not found');
  return full;
}

export async function removeFiles(files: Express.Multer.File[] | undefined) {
  await Promise.all((files ?? []).map((f) => fsp.rm(f.path, { force: true })));
}
