import { randomBytes, randomUUID } from 'node:crypto';
import { buildClearedSessionCookie, buildSessionCookie, parseCookies } from './cookies.mjs';
import { bcryptCompare, hashPassword, signToken, verifyToken } from './security.mjs';

const SESSION_MAX_AGE_SEC = 86400;
const LOCKOUT_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const DUMMY_HASH = hashPassword('dummy-password-for-timing-protection');

const readJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const text = Buffer.concat(chunks).toString('utf-8');
  return JSON.parse(text || '{}');
};

const json = (res, status, payload, extraHeaders = {}) => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
};

const noContent = (res) => {
  res.writeHead(204);
  res.end();
};

const getIp = (req) => {
  const fromForwarded = req.headers['x-forwarded-for'];
  if (typeof fromForwarded === 'string' && fromForwarded.length > 0) {
    return fromForwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
};

const nowIso = () => new Date().toISOString();
const toEmailKey = (email) => String(email || '').trim().toLowerCase();
const randomPassword = () => randomBytes(9).toString('base64url');

export const createApp = ({ jwtSecret = 'dev-jwt-secret' } = {}) => {
  const users = new Map();
  const auditLog = [];

  const seedUsers = [
    {
      id: randomUUID(),
      name: 'Demo Student',
      email: 'student@example.com',
      role: 'student',
      password: 'student123',
      selectedTopicId: null,
    },
    {
      id: randomUUID(),
      name: 'Demo Admin',
      email: 'admin@example.com',
      role: 'admin',
      password: 'admin123',
      selectedTopicId: null,
    },
  ];

  for (const u of seedUsers) {
    users.set(toEmailKey(u.email), {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      selectedTopicId: u.selectedTopicId,
      passwordHash: hashPassword(u.password),
      failedAttempts: 0,
      lockedUntilMs: null,
    });
  }

  const logAudit = ({ actor, action, ip, result, targetId = null }) => {
    auditLog.push({ actor, action, ip, result, targetId, timestamp: nowIso() });
  };

  const authenticate = (req) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.session;
    if (!token) return null;
    const payload = verifyToken(token, jwtSecret);
    if (!payload) return null;
    return payload;
  };

  const requireAuth = (req, res) => {
    const session = authenticate(req);
    if (!session) {
      json(res, 401, { error: 'UNAUTHORIZED', message: 'Unauthorized' });
      return null;
    }
    return session;
  };

  const requireRole = (session, role, res) => {
    if (session.role !== role) {
      json(res, 403, { error: 'FORBIDDEN', message: 'Forbidden' });
      return false;
    }
    return true;
  };

  const findStudentById = (id) => {
    for (const [key, user] of users.entries()) {
      if (user.id === id && user.role === 'student') return { key, user };
    }
    return null;
  };

  const handleLogin = async (req, res) => {
    const ip = getIp(req);
    const { email = '', password = '' } = await readJsonBody(req);
    const actor = String(email || 'unknown');
    const user = users.get(toEmailKey(actor));

    if (user && user.lockedUntilMs && user.lockedUntilMs > Date.now()) {
      logAudit({ actor, action: 'LOGIN', ip, result: 'locked' });
      return json(res, 423, {
        error: 'ACCOUNT_LOCKED',
        lockedUntil: new Date(user.lockedUntilMs).toISOString(),
      });
    }

    if (!user) {
      await bcryptCompare(String(password), DUMMY_HASH);
      logAudit({ actor, action: 'LOGIN', ip, result: 'failed' });
      return json(res, 401, {
        error: 'INVALID_CREDENTIALS',
        message: 'Невірний email або пароль',
      });
    }

    const ok = await bcryptCompare(String(password), user.passwordHash);
    if (!ok) {
      user.failedAttempts += 1;
      if (user.failedAttempts >= LOCKOUT_ATTEMPTS) {
        user.lockedUntilMs = Date.now() + LOCKOUT_MS;
        logAudit({ actor, action: 'LOGIN', ip, result: 'locked' });
        return json(res, 423, {
          error: 'ACCOUNT_LOCKED',
          lockedUntil: new Date(user.lockedUntilMs).toISOString(),
        });
      }

      logAudit({ actor, action: 'LOGIN', ip, result: 'failed' });
      return json(res, 401, {
        error: 'INVALID_CREDENTIALS',
        message: 'Невірний email або пароль',
      });
    }

    user.failedAttempts = 0;
    user.lockedUntilMs = null;

    const token = signToken(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
      },
      jwtSecret,
    );

    logAudit({ actor, action: 'LOGIN', ip, result: 'success' });

    return json(
      res,
      200,
      { id: user.id, email: user.email, role: user.role },
      { 'Set-Cookie': buildSessionCookie(token, SESSION_MAX_AGE_SEC) },
    );
  };

  const handler = async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        return json(res, 200, { status: 'ok' });
      }

      if (req.method === 'POST' && req.url === '/auth/login') {
        return await handleLogin(req, res);
      }

      if (req.method === 'POST' && req.url === '/auth/logout') {
        const session = requireAuth(req, res);
        if (!session) return;

        logAudit({ actor: session.sub, action: 'LOGOUT', ip: getIp(req), result: 'success' });
        return json(res, 200, { ok: true }, { 'Set-Cookie': buildClearedSessionCookie() });
      }

      if (req.method === 'GET' && req.url === '/topics') {
        const session = requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'student', res)) return;
        return json(res, 200, { topics: [] });
      }

      if (req.method === 'GET' && req.url === '/admin/topics') {
        const session = requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;
        return json(res, 200, { topics: [] });
      }

      if (req.method === 'GET' && req.url === '/admin/users') {
        const session = requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const students = [...users.values()]
          .filter((u) => u.role === 'student')
          .map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            hasSelectedTopic: Boolean(u.selectedTopicId),
          }));

        return json(res, 200, students);
      }

      if (req.method === 'POST' && req.url === '/admin/users') {
        const session = requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const { name = '', email = '' } = await readJsonBody(req);
        const cleanName = String(name).trim();
        const cleanEmail = String(email).trim();
        const emailKey = toEmailKey(cleanEmail);

        if (!cleanName || !cleanEmail) {
          return json(res, 400, { error: 'VALIDATION_ERROR', message: 'name and email are required' });
        }

        if (users.has(emailKey)) {
          return json(res, 409, {
            error: 'EMAIL_ALREADY_EXISTS',
            message: 'Студент з таким email вже існує',
          });
        }

        const id = randomUUID();
        const newPassword = randomPassword();
        users.set(emailKey, {
          id,
          name: cleanName,
          email: cleanEmail,
          role: 'student',
          selectedTopicId: null,
          passwordHash: hashPassword(newPassword),
          failedAttempts: 0,
          lockedUntilMs: null,
        });

        logAudit({
          actor: session.sub,
          action: 'CREATE_USER',
          ip: getIp(req),
          result: 'success',
          targetId: id,
        });

        return json(res, 201, { id, name: cleanName, email: cleanEmail, newPassword });
      }

      const deleteUserMatch = req.url?.match(/^\/admin\/users\/([^/]+)$/);
      if (req.method === 'DELETE' && deleteUserMatch) {
        const session = requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const targetId = deleteUserMatch[1];
        const found = findStudentById(targetId);
        if (!found) {
          return json(res, 404, { error: 'NOT_FOUND', message: 'Student not found' });
        }

        users.delete(found.key);
        logAudit({
          actor: session.sub,
          action: 'DELETE_USER',
          ip: getIp(req),
          result: 'success',
          targetId,
        });
        return noContent(res);
      }

      return json(res, 404, { error: 'NOT_FOUND', message: 'Not Found' });
    } catch {
      return json(res, 500, { error: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  };

  return {
    handler,
    getAuditLog: () => [...auditLog],
    inject: async ({ method, url, body, headers = {}, ip = '127.0.0.1' }) => {
      const chunks = body ? [Buffer.from(JSON.stringify(body))] : [];
      const req = {
        method,
        url,
        headers,
        socket: { remoteAddress: ip },
        [Symbol.asyncIterator]: async function* iterator() {
          for (const chunk of chunks) yield chunk;
        },
      };

      const response = {
        statusCode: 200,
        headers: {},
        rawBody: '',
      };

      const res = {
        writeHead(statusCode, responseHeaders = {}) {
          response.statusCode = statusCode;
          response.headers = { ...responseHeaders };
        },
        end(payload = '') {
          response.rawBody = String(payload);
        },
      };

      await handler(req, res);

      let jsonBody = null;
      try {
        jsonBody = response.rawBody ? JSON.parse(response.rawBody) : null;
      } catch {
        jsonBody = null;
      }

      return {
        status: response.statusCode,
        headers: response.headers,
        body: jsonBody,
      };
    },
  };
};
