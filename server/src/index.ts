import fs from 'node:fs';
import { createApp } from './app.js';
import { env, isProd } from './config/env.js';

if (isProd && (env.jwtSecret === 'change-me' || env.jwtSecret.length < 32)) {
  throw new Error('Set a long random JWT_SECRET (32+ characters) in production');
}
if (!/^[0-9a-f]{64}$/i.test(env.trackingLinkKey)) {
  throw new Error('Set TRACKING_LINK_KEY to 64 hex characters (see .env.example)');
}

fs.mkdirSync(env.uploadDir, { recursive: true });

createApp().listen(env.port, () => {
  console.log(`Sugacoco API running on http://localhost:${env.port}`);
});
