import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env, isProd } from './config/env.js';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { rolesRouter } from './routes/roles.js';
import { customersRouter } from './routes/customers.js';
import { productsRouter } from './routes/products.js';
import { ordersRouter } from './routes/orders.js';
import { paymentsRouter } from './routes/payments.js';
import { qcRouter } from './routes/qc.js';
import { packagingRouter } from './routes/packaging.js';
import { documentationRouter } from './routes/documentation.js';
import { accountsRouter } from './routes/accounts.js';
import { adminRouter } from './routes/admin.js';
import { reportsRouter } from './routes/reports.js';
import { publicRouter, trackingRouter } from './routes/tracking.js';
import { documentsRouter } from './routes/documents.js';
import { notificationsRouter } from './routes/notifications.js';
import { summaryRouter } from './routes/summary.js';
import { pdfRouter } from './routes/pdf.js';
import { errorHandler, notFound } from './middleware/error.js';

export function createApp() {
  const app = express();

  // Webuzo runs Node behind Apache/Nginx; needed for correct client IP (rate limit) and secure cookies.
  app.set('trust proxy', 1);
  // same-site: lets the website load API files when it is hosted on a sister subdomain (app.example.com + api.example.com).
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  // Gzip API responses and the built app (queues and reports are large JSON; JS/CSS shrink about 70%).
  app.use(compression());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // General flood protection for the whole API (login and the public tracking page have stricter limits of their own).
  // Generous enough for a whole office sharing one IP.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 1000,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Too many requests. Please wait a minute and try again.' },
    }),
  );

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/roles', rolesRouter);
  app.use('/api/customers', customersRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/orders', ordersRouter);
  app.use('/api/payments', paymentsRouter);
  app.use('/api/qc', qcRouter);
  app.use('/api/packaging', packagingRouter);
  app.use('/api/documentation', documentationRouter);
  app.use('/api/accounts', accountsRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/summary', summaryRouter);
  app.use('/api', pdfRouter); // /api/orders/:id/pdf/pi | quotation
  app.use('/api/public', publicRouter); // customer tracking page, no login
  app.use('/api', trackingRouter);
  app.use('/api', documentsRouter); // /api/orders/:id/documents, /api/documents/:id
  app.use('/api', notFound);

  // In production, Express also serves the built React app (one Node app on Webuzo).
  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(here, '../../client/dist');
  if (isProd && fs.existsSync(clientDist)) {
    // Built files under /assets have a content hash in their name: the browser may keep them for a year.
    // index.html is always re-checked so a new release is picked up straight away.
    app.use(
      '/assets',
      express.static(path.join(clientDist, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }),
    );
    app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
