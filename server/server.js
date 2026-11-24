// Start file for hosting panels that ask for one (Webuzo: "server.js").
// Runs the compiled server from this folder, so .env and relative paths are found
// whatever folder the panel starts it from. Same as: node dist/index.js
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.chdir(dirname(fileURLToPath(import.meta.url)));
await import('./dist/index.js');
