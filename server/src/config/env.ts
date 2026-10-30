import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing env variable: ${name}`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 5050),
  db: {
    host: required('DB_HOST', '127.0.0.1'),
    port: Number(process.env.DB_PORT ?? 3306),
    user: required('DB_USER', 'root'),
    password: process.env.DB_PASSWORD ?? '',
    name: required('DB_NAME', 'sugacoco_db'),
  },
  jwtSecret: required('JWT_SECRET', 'change-me'),
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5180',

  // Base URL used to build customer tracking links, e.g. https://orders.sugacoco.com
  publicAppUrl: (process.env.PUBLIC_APP_URL ?? 'http://localhost:5180').replace(/\/+$/, ''),
  // 64 hex chars (32 bytes). Encrypts stored tracking tokens. Changing it breaks "copy link" for old links.
  trackingLinkKey: process.env.TRACKING_LINK_KEY ?? '',

  // Shown on the customer tracking page.
  company: {
    name: process.env.COMPANY_NAME ?? 'Sugacoco',
    supportEmail: process.env.COMPANY_SUPPORT_EMAIL ?? '',
    supportPhone: process.env.COMPANY_SUPPORT_PHONE ?? '',
    // Printed on PI / Quotation PDFs. Use | for line breaks in the address.
    address: process.env.COMPANY_ADDRESS ?? '',
    gstin: process.env.COMPANY_GSTIN ?? '',
  },
};

export const isProd = env.nodeEnv === 'production';
