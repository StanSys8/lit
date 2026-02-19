import { createServer } from 'node:http';
import { createApp } from './server.mjs';

const port = Number(process.env.PORT || 8787);
const app = createApp({ jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret' });
const server = createServer(app.handler);

server.listen(port, () => {
  console.log(`backend listening on http://localhost:${port}`);
});
