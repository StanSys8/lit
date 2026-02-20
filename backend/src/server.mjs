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
  const topics = new Map();
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

  const seedTopics = [
    {
      id: randomUUID(),
      title: 'Distributed Systems for IoT',
      description: 'Event-driven architecture for constrained devices.',
      supervisor: 'Dr. Smith',
      department: 'Computer Science',
      selectedByUserId: null,
    },
    {
      id: randomUUID(),
      title: 'Applied Machine Learning in Education',
      description: 'Adaptive learning and recommendation models.',
      supervisor: 'Prof. Johnson',
      department: 'Data Science',
      selectedByUserId: seedUsers[1].id,
    },
  ];

  for (const t of seedTopics) {
    topics.set(t.id, t);
  }

  const logAudit = ({ actor, action, ip, result, targetId = null, count = null }) => {
    auditLog.push({ actor, action, ip, result, targetId, count, timestamp: nowIso() });
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

  const createStudent = ({ name, email }) => {
    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim();
    const emailKey = toEmailKey(cleanEmail);

    if (!cleanName || !cleanEmail) {
      return { error: { code: 'VALIDATION_ERROR', message: 'name and email are required' } };
    }

    if (users.has(emailKey)) {
      return {
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Студент з таким email вже існує',
        },
      };
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

    return {
      data: {
        id,
        name: cleanName,
        email: cleanEmail,
        newPassword,
      },
    };
  };

  const mapSelectedBy = (selectedByUserId) => {
    if (!selectedByUserId) return null;
    const selectedUser = [...users.values()].find((u) => u.id === selectedByUserId);
    if (!selectedUser) return null;
    return { id: selectedUser.id, name: selectedUser.name };
  };

  const mapTopic = (topic) => ({
    id: topic.id,
    title: topic.title,
    description: topic.description,
    supervisor: topic.supervisor,
    department: topic.department,
    selectedBy: mapSelectedBy(topic.selectedByUserId),
  });

  const mapStudentTopic = (topic) => ({
    id: topic.id,
    title: topic.title,
    description: topic.description,
    supervisor: topic.supervisor,
    department: topic.department,
  });

  const createTopic = ({ title, description, supervisor, department }) => {
    const cleanTitle = String(title).trim();
    const cleanDescription = String(description).trim();
    const cleanSupervisor = String(supervisor).trim();
    const cleanDepartment = String(department).trim();

    if (!cleanTitle || !cleanDescription || !cleanSupervisor || !cleanDepartment) {
      return {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'title, description, supervisor and department are required',
        },
      };
    }

    const topic = {
      id: randomUUID(),
      title: cleanTitle,
      description: cleanDescription,
      supervisor: cleanSupervisor,
      department: cleanDepartment,
      selectedByUserId: null,
    };
    topics.set(topic.id, topic);
    return { data: topic };
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
        const available = [...topics.values()]
          .filter((topic) => !topic.selectedByUserId)
          .map((topic) => mapStudentTopic(topic));
        return json(res, 200, available);
      }

      const selectTopicMatch = req.url?.match(/^\/topics\/([^/]+)\/select$/);
      if (req.method === 'POST' && selectTopicMatch) {
        const session = requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'student', res)) return;

        const topicId = selectTopicMatch[1];
        const topic = topics.get(topicId);
        if (!topic) {
          logAudit({
            actor: session.sub,
            action: 'SELECT_TOPIC',
            ip: getIp(req),
            result: 'denied',
            targetId: topicId,
          });
          return json(res, 404, { error: 'NOT_FOUND', message: 'Topic not found' });
        }

        const student = [...users.values()].find((u) => u.id === session.sub && u.role === 'student');
        if (!student) {
          return json(res, 401, { error: 'UNAUTHORIZED', message: 'Unauthorized' });
        }

        const alreadySelectedTopic = [...topics.values()].find((item) => item.selectedByUserId === student.id);
        if (student.selectedTopicId || alreadySelectedTopic) {
          logAudit({
            actor: student.id,
            action: 'SELECT_TOPIC',
            ip: getIp(req),
            result: 'denied',
            targetId: topicId,
          });
          return json(res, 409, { error: 'ALREADY_SELECTED', message: 'Тему вже обрано' });
        }

        if (topic.selectedByUserId) {
          logAudit({
            actor: student.id,
            action: 'SELECT_TOPIC',
            ip: getIp(req),
            result: 'denied',
            targetId: topicId,
          });
          return json(res, 409, { error: 'TOPIC_ALREADY_TAKEN', message: 'Цю тему вже вибрали' });
        }

        topic.selectedByUserId = student.id;
        student.selectedTopicId = topic.id;
        logAudit({
          actor: student.id,
          action: 'SELECT_TOPIC',
          ip: getIp(req),
          result: 'success',
          targetId: topicId,
        });
        return json(res, 200, { topic: { id: topic.id, title: topic.title, selectedBy: student.id } });
      }

      if (req.method === 'GET' && req.url === '/admin/topics') {
        const session = requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;
        return json(res, 200, {
          topics: [...topics.values()].map((topic) => mapTopic(topic)),
        });
      }

      if (req.method === 'POST' && req.url === '/admin/topics') {
        const session = requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const { title = '', description = '', supervisor = '', department = '' } = await readJsonBody(req);
        const created = createTopic({ title, description, supervisor, department });
        if (created.error) {
          return json(res, 400, { error: 'VALIDATION_ERROR', message: created.error.message });
        }

        logAudit({
          actor: session.sub,
          action: 'CREATE_TOPIC',
          ip: getIp(req),
          result: 'success',
          targetId: created.data.id,
        });

        return json(res, 201, mapTopic(created.data));
      }

      if (req.method === 'POST' && req.url === '/admin/topics/bulk') {
        const session = requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const body = await readJsonBody(req);
        const items = Array.isArray(body) ? body : [];
        const errors = [];
        let created = 0;

        items.forEach((item, index) => {
          const row = index + 1;
          const title = String(item?.title ?? '').trim();
          const supervisor = String(item?.supervisor ?? '').trim();

          if (!title || !supervisor) {
            errors.push({ row, message: 'title and supervisor are required' });
            return;
          }

          const topic = {
            id: randomUUID(),
            title,
            description: String(item?.description ?? '').trim(),
            supervisor,
            department: String(item?.department ?? '').trim(),
            selectedByUserId: null,
          };
          topics.set(topic.id, topic);
          created += 1;
        });

        logAudit({
          actor: session.sub,
          action: 'BULK_CREATE_TOPICS',
          ip: getIp(req),
          result: errors.length > 0 ? 'partial' : 'success',
          targetId: null,
          count: created,
        });

        return json(res, 200, { created, errors });
      }

      const releaseTopicMatch = req.url?.match(/^\/admin\/topics\/([^/]+)\/release$/);
      if (req.method === 'POST' && releaseTopicMatch) {
        const session = requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const targetId = releaseTopicMatch[1];
        const topic = topics.get(targetId);
        if (!topic) {
          return json(res, 404, { error: 'NOT_FOUND', message: 'Topic not found' });
        }

        if (!topic.selectedByUserId) {
          return json(res, 409, {
            error: 'TOPIC_ALREADY_FREE',
            message: 'Тема вже вільна',
          });
        }

        const selectedStudent = [...users.values()].find((u) => u.id === topic.selectedByUserId && u.role === 'student');
        if (selectedStudent && selectedStudent.selectedTopicId === topic.id) {
          selectedStudent.selectedTopicId = null;
        }

        topic.selectedByUserId = null;
        logAudit({
          actor: session.sub,
          action: 'RELEASE_TOPIC',
          ip: getIp(req),
          result: 'success',
          targetId,
        });
        return json(res, 200, { topic: mapTopic(topic) });
      }

      const deleteTopicMatch = req.url?.match(/^\/admin\/topics\/([^/]+)$/);
      if (req.method === 'DELETE' && deleteTopicMatch) {
        const session = requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const targetId = deleteTopicMatch[1];
        const topic = topics.get(targetId);
        if (!topic) {
          return json(res, 404, { error: 'NOT_FOUND', message: 'Topic not found' });
        }

        if (topic.selectedByUserId) {
          return json(res, 409, {
            error: 'TOPIC_IN_USE',
            message: 'Тема вже вибрана студентом — спочатку звільніть її',
          });
        }

        topics.delete(targetId);
        logAudit({
          actor: session.sub,
          action: 'DELETE_TOPIC',
          ip: getIp(req),
          result: 'success',
          targetId,
        });
        return noContent(res);
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
        const created = createStudent({ name, email });
        if (created.error) {
          if (created.error.code === 'EMAIL_ALREADY_EXISTS') {
            return json(res, 409, {
              error: 'EMAIL_ALREADY_EXISTS',
              message: 'Студент з таким email вже існує',
            });
          }
          return json(res, 400, { error: 'VALIDATION_ERROR', message: created.error.message });
        }

        logAudit({
          actor: session.sub,
          action: 'CREATE_USER',
          ip: getIp(req),
          result: 'success',
          targetId: created.data.id,
        });

        return json(res, 201, {
          id: created.data.id,
          name: created.data.name,
          email: created.data.email,
          newPassword: created.data.newPassword,
        });
      }

      if (req.method === 'POST' && req.url === '/admin/users/bulk') {
        const session = requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const body = await readJsonBody(req);
        const items = Array.isArray(body) ? body : [];
        const errors = [];
        const createdUsers = [];

        const seen = new Set();
        items.forEach((item, index) => {
          const row = index + 1;
          const emailKey = toEmailKey(item?.email);

          if (seen.has(emailKey)) {
            errors.push({ row, message: 'Duplicate email in CSV payload' });
            return;
          }
          seen.add(emailKey);

          const result = createStudent({ name: item?.name ?? '', email: item?.email ?? '' });
          if (result.error) {
            errors.push({ row, message: result.error.message });
            return;
          }

          createdUsers.push({
            name: result.data.name,
            email: result.data.email,
            password: result.data.newPassword,
          });
        });

        logAudit({
          actor: session.sub,
          action: 'BULK_CREATE_USERS',
          ip: getIp(req),
          result: errors.length > 0 ? 'partial' : 'success',
          targetId: null,
          count: createdUsers.length,
        });

        return json(res, 200, {
          created: createdUsers.length,
          users: createdUsers,
          errors,
        });
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

      const resetPasswordMatch = req.url?.match(/^\/admin\/users\/([^/]+)\/reset-password$/);
      if (req.method === 'POST' && resetPasswordMatch) {
        const session = requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const targetId = resetPasswordMatch[1];
        const found = findStudentById(targetId);
        if (!found) {
          return json(res, 404, { error: 'NOT_FOUND', message: 'Student not found' });
        }

        const newPassword = randomPassword();
        found.user.passwordHash = hashPassword(newPassword);
        found.user.failedAttempts = 0;
        found.user.lockedUntilMs = null;

        logAudit({
          actor: session.sub,
          action: 'RESET_PASSWORD',
          ip: getIp(req),
          result: 'success',
          targetId,
        });

        return json(res, 200, { newPassword });
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
