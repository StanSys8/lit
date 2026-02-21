import { createServer } from 'node:http';
import { createApp } from './server.mjs';

const port = Number(process.env.PORT || 8787);
const app = createApp({
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',
  mongodbUri: process.env.MONGODB_URI || '',
  mongodbDbName: process.env.MONGODB_DB_NAME || '',
  allowedOrigin: process.env.ALLOWED_ORIGIN || '*',
});
const server = createServer(app.handler);

server.listen(port, () => {
  console.log(`backend listening on http://localhost:${port}`);
});
