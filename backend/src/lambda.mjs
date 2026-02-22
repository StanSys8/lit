import { createApp } from './server.mjs';

const app = createApp({
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',
  mongodbUri: process.env.MONGODB_URI || '',
  mongodbDbName: process.env.MONGODB_DB_NAME || '',
  allowedOrigin: process.env.ALLOWED_ORIGIN || '',
  emailFrom: process.env.EMAIL_FROM || '',
  appBaseUrl: process.env.APP_BASE_URL || process.env.ALLOWED_ORIGIN || '',
  emailRegion: process.env.EMAIL_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '',
});

const toCookieHeader = (cookies = []) => {
  if (!Array.isArray(cookies) || cookies.length === 0) return {};
  return { cookie: cookies.join('; ') };
};

const toBody = (event) => {
  if (!event.body) return undefined;
  if (event.isBase64Encoded) {
    return JSON.parse(Buffer.from(event.body, 'base64').toString('utf-8'));
  }
  return JSON.parse(event.body);
};

const fromResult = (result) => {
  const statusCode = result.status || 500;
  const headers = result.headers || {};
  const cookie = headers['Set-Cookie'];
  const responseHeaders = { ...headers };
  delete responseHeaders['Set-Cookie'];

  return {
    statusCode,
    headers: responseHeaders,
    cookies: cookie ? [cookie] : undefined,
    body: result.text || '',
  };
};

export const handler = async (event) => {
  const method = event?.requestContext?.http?.method || 'GET';
  const path = event?.rawPath || '/';
  const query = event?.rawQueryString ? `?${event.rawQueryString}` : '';
  const url = `${path}${query}`;

  const headers = {
    ...(event?.headers || {}),
    ...toCookieHeader(event?.cookies),
  };

  let body;
  try {
    body = toBody(event);
  } catch {
    return {
      statusCode: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ error: 'INVALID_JSON', message: 'Invalid JSON body' }),
    };
  }

  const result = await app.inject({
    method,
    url,
    headers,
    body,
    ip: headers['x-forwarded-for'] || headers['X-Forwarded-For'] || 'unknown',
  });

  return fromResult(result);
};
