import { randomBytes, randomUUID } from 'node:crypto';
import { MongoClient, ObjectId } from 'mongodb';
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

const csv = (res, status, content, filename) => {
  res.writeHead(status, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
  res.end(content);
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
const csvSafe = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const inferDbNameFromUri = (mongodbUri, fallback) => {
  if (!mongodbUri) return fallback;
  try {
    const pathname = new URL(mongodbUri).pathname.replace(/^\//, '').trim();
    if (!pathname) return fallback;
    const [dbName] = pathname.split('/');
    return dbName || fallback;
  } catch {
    return fallback;
  }
};

const idFromDoc = (doc) => String(doc?.id || doc?._id || '');
const toObjectIdOrNull = (value) => (ObjectId.isValid(value) ? new ObjectId(value) : null);
const idQuery = (value) => {
  const queries = [{ id: value }];
  const objectId = toObjectIdOrNull(value);
  if (objectId) queries.push({ _id: objectId });
  return queries.length === 1 ? queries[0] : { $or: queries };
};

const sortByCreatedAtDesc = { createdAt: -1, _id: -1 };

export const createApp = ({
  jwtSecret = 'dev-jwt-secret',
  mongodbUri = '',
  mongodbDbName = '',
} = {}) => {
  if (!mongodbUri) {
    throw new Error('MONGODB_URI is required');
  }

  const resolvedDbName = mongodbDbName || inferDbNameFromUri(mongodbUri, 'lit');
  let dbPromise = null;

  const getDb = async () => {
    if (dbPromise) return dbPromise;

    dbPromise = (async () => {
      const client = new MongoClient(mongodbUri, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();

      const db = client.db(resolvedDbName);
      const users = db.collection('users');
      const topics = db.collection('topics');
      const audit = db.collection('audit_log');

      await Promise.all([
        users.createIndex({ emailLower: 1 }, { unique: true, sparse: true }),
        users.createIndex({ role: 1 }),
        topics.createIndex({ selectedByUserId: 1 }),
        audit.createIndex(sortByCreatedAtDesc),
      ]);

      return { client, db, users, topics, audit };
    })();

    return dbPromise;
  };

  const logAudit = async ({ actor, action, ip, result, targetId = null, count = null }) => {
    const { audit } = await getDb();
    await audit.insertOne({
      id: randomUUID(),
      actor: String(actor || ''),
      action,
      ip,
      result,
      targetId,
      count,
      createdAt: nowIso(),
    });
  };

  const findUserByEmail = async (email) => {
    const { users } = await getDb();
    const emailLower = toEmailKey(email);
    const caseInsensitiveEmail = new RegExp(`^${escapeRegex(emailLower)}$`, 'i');
    return users.findOne({
      $or: [{ emailLower }, { email: emailLower }, { email: caseInsensitiveEmail }],
    });
  };

  const authenticate = async (req) => {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.session;
    if (!token) return null;
    const payload = verifyToken(token, jwtSecret);
    if (!payload) return null;
    return payload;
  };

  const requireAuth = async (req, res) => {
    const session = await authenticate(req);
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

  const mapStudentTopic = (topic) => ({
    id: idFromDoc(topic),
    title: topic.title,
    description: topic.description,
    supervisor: topic.supervisor,
    department: topic.department,
  });

  const mapSelectedTopicForUser = async (user) => {
    if (!user?.selectedTopicId) return null;
    const { topics } = await getDb();
    const topic = await topics.findOne(idQuery(String(user.selectedTopicId)));
    if (!topic) return null;
    return mapStudentTopic(topic);
  };

  const mapTopic = async (topic) => {
    if (!topic?.selectedByUserId) {
      return {
        id: idFromDoc(topic),
        title: topic.title,
        description: topic.description,
        supervisor: topic.supervisor,
        department: topic.department,
        selectedBy: null,
      };
    }

    const { users } = await getDb();
    const selectedUser = await users.findOne(idQuery(String(topic.selectedByUserId)));
    return {
      id: idFromDoc(topic),
      title: topic.title,
      description: topic.description,
      supervisor: topic.supervisor,
      department: topic.department,
      selectedBy: selectedUser ? { id: idFromDoc(selectedUser), name: selectedUser.name } : null,
    };
  };

  const createStudent = async ({ name, email }) => {
    const { users } = await getDb();
    const cleanName = String(name).trim();
    const cleanEmail = toEmailKey(email);

    if (!cleanName || !cleanEmail) {
      return { error: { code: 'VALIDATION_ERROR', message: 'name and email are required' } };
    }

    const existing = await users.findOne({
      $or: [{ emailLower: cleanEmail }, { email: cleanEmail }, { email: new RegExp(`^${escapeRegex(cleanEmail)}$`, 'i') }],
    });
    if (existing) {
      return {
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Студент з таким email вже існує',
        },
      };
    }

    const id = randomUUID();
    const newPassword = randomPassword();
    await users.insertOne({
      id,
      name: cleanName,
      email: cleanEmail,
      emailLower: cleanEmail,
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

  const handleLogin = async (req, res) => {
    const { users } = await getDb();
    const ip = getIp(req);
    const { email = '', password = '' } = await readJsonBody(req);
    const actor = toEmailKey(email || 'unknown');
    const user = await findUserByEmail(actor);

    if (user && user.lockedUntilMs && user.lockedUntilMs > Date.now()) {
      await logAudit({ actor, action: 'LOGIN', ip, result: 'locked' });
      return json(res, 423, {
        error: 'ACCOUNT_LOCKED',
        lockedUntil: new Date(user.lockedUntilMs).toISOString(),
      });
    }

    if (!user) {
      await bcryptCompare(String(password), DUMMY_HASH);
      await logAudit({ actor, action: 'LOGIN', ip, result: 'failed' });
      return json(res, 401, {
        error: 'INVALID_CREDENTIALS',
        message: 'Невірний email або пароль',
      });
    }

    const ok = await bcryptCompare(String(password), user.passwordHash);
    if (!ok) {
      const failedAttempts = Number(user.failedAttempts || 0) + 1;
      const updatePayload = { failedAttempts };
      if (failedAttempts >= LOCKOUT_ATTEMPTS) {
        updatePayload.lockedUntilMs = Date.now() + LOCKOUT_MS;
      }

      await users.updateOne(idQuery(idFromDoc(user)), { $set: updatePayload });

      if (failedAttempts >= LOCKOUT_ATTEMPTS) {
        await logAudit({ actor, action: 'LOGIN', ip, result: 'locked' });
        return json(res, 423, {
          error: 'ACCOUNT_LOCKED',
          lockedUntil: new Date(updatePayload.lockedUntilMs).toISOString(),
        });
      }

      await logAudit({ actor, action: 'LOGIN', ip, result: 'failed' });
      return json(res, 401, {
        error: 'INVALID_CREDENTIALS',
        message: 'Невірний email або пароль',
      });
    }

    await users.updateOne(idQuery(idFromDoc(user)), { $set: { failedAttempts: 0, lockedUntilMs: null } });

    const token = signToken(
      {
        sub: idFromDoc(user),
        email: user.email,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
      },
      jwtSecret,
    );

    await logAudit({ actor, action: 'LOGIN', ip, result: 'success' });

    return json(
      res,
      200,
      {
        id: idFromDoc(user),
        email: user.email,
        role: user.role,
        selectedTopic: await mapSelectedTopicForUser(user),
      },
      { 'Set-Cookie': buildSessionCookie(token, SESSION_MAX_AGE_SEC) },
    );
  };

  const handler = async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        return noContent(res);
      }

      if (req.method === 'GET' && req.url === '/health') {
        return json(res, 200, { status: 'ok' });
      }

      if (req.method === 'POST' && req.url === '/auth/login') {
        return await handleLogin(req, res);
      }

      if (req.method === 'POST' && req.url === '/auth/logout') {
        const session = await requireAuth(req, res);
        if (!session) return;
        await logAudit({ actor: session.sub, action: 'LOGOUT', ip: getIp(req), result: 'success' });
        return json(res, 200, { ok: true }, { 'Set-Cookie': buildClearedSessionCookie() });
      }

      if (req.method === 'GET' && req.url === '/topics') {
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'student', res)) return;
        const { topics } = await getDb();
        const available = await topics
          .find({ selectedByUserId: null })
          .map((topic) => mapStudentTopic(topic))
          .toArray();
        return json(res, 200, available);
      }

      const selectTopicMatch = req.url?.match(/^\/topics\/([^/]+)\/select$/);
      if (req.method === 'POST' && selectTopicMatch) {
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'student', res)) return;

        const { users, topics } = await getDb();
        const topicId = selectTopicMatch[1];
        const student = await users.findOne({
          role: 'student',
          ...idQuery(session.sub),
        });
        if (!student) {
          return json(res, 401, { error: 'UNAUTHORIZED', message: 'Unauthorized' });
        }

        const studentId = idFromDoc(student);

        if (student.selectedTopicId) {
          await logAudit({
            actor: studentId,
            action: 'SELECT_TOPIC',
            ip: getIp(req),
            result: 'denied',
            targetId: topicId,
          });
          return json(res, 409, { error: 'ALREADY_SELECTED', message: 'Тему вже обрано' });
        }

        const alreadySelectedTopic = await topics.findOne({ selectedByUserId: studentId });
        if (alreadySelectedTopic) {
          await logAudit({
            actor: studentId,
            action: 'SELECT_TOPIC',
            ip: getIp(req),
            result: 'denied',
            targetId: topicId,
          });
          return json(res, 409, { error: 'ALREADY_SELECTED', message: 'Тему вже обрано' });
        }

        const selected = await topics.findOneAndUpdate(
          { ...idQuery(topicId), selectedByUserId: null },
          { $set: { selectedByUserId: studentId } },
          { returnDocument: 'after' },
        );

        if (!selected) {
          const exists = await topics.findOne(idQuery(topicId), { projection: { _id: 1, selectedByUserId: 1 } });
          await logAudit({
            actor: studentId,
            action: 'SELECT_TOPIC',
            ip: getIp(req),
            result: 'denied',
            targetId: topicId,
          });
          if (!exists) return json(res, 404, { error: 'NOT_FOUND', message: 'Topic not found' });
          return json(res, 409, { error: 'TOPIC_ALREADY_TAKEN', message: 'Цю тему вже вибрали' });
        }

        await users.updateOne(idQuery(studentId), { $set: { selectedTopicId: idFromDoc(selected) } });

        await logAudit({
          actor: studentId,
          action: 'SELECT_TOPIC',
          ip: getIp(req),
          result: 'success',
          targetId: topicId,
        });
        return json(res, 200, { topic: { id: idFromDoc(selected), title: selected.title, selectedBy: studentId } });
      }

      if (req.method === 'GET' && req.url === '/admin/topics') {
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;
        const { topics } = await getDb();
        const records = await topics.find({}).toArray();
        const mapped = await Promise.all(records.map((topic) => mapTopic(topic)));
        return json(res, 200, { topics: mapped });
      }

      if (req.method === 'POST' && req.url === '/admin/topics') {
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const { title = '', description = '', supervisor = '', department = '' } = await readJsonBody(req);
        const cleanTitle = String(title).trim();
        const cleanDescription = String(description).trim();
        const cleanSupervisor = String(supervisor).trim();
        const cleanDepartment = String(department).trim();

        if (!cleanTitle || !cleanDescription || !cleanSupervisor || !cleanDepartment) {
          return json(res, 400, {
            error: 'VALIDATION_ERROR',
            message: 'title, description, supervisor and department are required',
          });
        }

        const { topics } = await getDb();
        const id = randomUUID();
        const topic = {
          id,
          title: cleanTitle,
          description: cleanDescription,
          supervisor: cleanSupervisor,
          department: cleanDepartment,
          selectedByUserId: null,
        };
        await topics.insertOne(topic);

        await logAudit({
          actor: session.sub,
          action: 'CREATE_TOPIC',
          ip: getIp(req),
          result: 'success',
          targetId: id,
        });

        return json(res, 201, { ...topic, selectedBy: null });
      }

      if (req.method === 'POST' && req.url === '/admin/topics/bulk') {
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const body = await readJsonBody(req);
        if (!Array.isArray(body)) {
          return json(res, 400, {
            error: 'VALIDATION_ERROR',
            message: 'Payload must be an array of topics',
          });
        }

        const { topics } = await getDb();
        const errors = [];
        let created = 0;

        for (let index = 0; index < body.length; index += 1) {
          const row = index + 1;
          const item = body[index];
          const title = String(item?.title ?? '').trim();
          const supervisor = String(item?.supervisor ?? '').trim();
          if (!title || !supervisor) {
            errors.push({ row, message: 'title and supervisor are required' });
            continue;
          }

          await topics.insertOne({
            id: randomUUID(),
            title,
            description: String(item?.description ?? '').trim(),
            supervisor,
            department: String(item?.department ?? '').trim(),
            selectedByUserId: null,
          });
          created += 1;
        }

        await logAudit({
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
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const { topics, users } = await getDb();
        const targetId = releaseTopicMatch[1];
        const topic = await topics.findOne(idQuery(targetId));
        if (!topic) {
          await logAudit({
            actor: session.sub,
            action: 'RELEASE_TOPIC',
            ip: getIp(req),
            result: 'denied',
            targetId,
          });
          return json(res, 404, { error: 'NOT_FOUND', message: 'Topic not found' });
        }

        if (!topic.selectedByUserId) {
          await logAudit({
            actor: session.sub,
            action: 'RELEASE_TOPIC',
            ip: getIp(req),
            result: 'denied',
            targetId,
          });
          return json(res, 409, { error: 'TOPIC_ALREADY_FREE', message: 'Тема вже вільна' });
        }

        const selectedById = String(topic.selectedByUserId);
        await topics.updateOne(idQuery(idFromDoc(topic)), { $set: { selectedByUserId: null } });
        await users.updateOne(
          { ...idQuery(selectedById), role: 'student', selectedTopicId: idFromDoc(topic) },
          { $set: { selectedTopicId: null } },
        );

        await logAudit({
          actor: session.sub,
          action: 'RELEASE_TOPIC',
          ip: getIp(req),
          result: 'success',
          targetId,
        });

        const released = await topics.findOne(idQuery(idFromDoc(topic)));
        return json(res, 200, { topic: await mapTopic(released) });
      }

      const deleteTopicMatch = req.url?.match(/^\/admin\/topics\/([^/]+)$/);
      if (req.method === 'DELETE' && deleteTopicMatch) {
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const { topics } = await getDb();
        const targetId = deleteTopicMatch[1];
        const topic = await topics.findOne(idQuery(targetId));
        if (!topic) {
          return json(res, 404, { error: 'NOT_FOUND', message: 'Topic not found' });
        }

        if (topic.selectedByUserId) {
          return json(res, 409, {
            error: 'TOPIC_IN_USE',
            message: 'Тема вже вибрана студентом — спочатку звільніть її',
          });
        }

        await topics.deleteOne(idQuery(idFromDoc(topic)));
        await logAudit({
          actor: session.sub,
          action: 'DELETE_TOPIC',
          ip: getIp(req),
          result: 'success',
          targetId: idFromDoc(topic),
        });
        return noContent(res);
      }

      if (req.method === 'GET' && req.url === '/admin/users') {
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const { users } = await getDb();
        const students = await users
          .find({ role: 'student' })
          .project({ id: 1, _id: 1, name: 1, email: 1, selectedTopicId: 1 })
          .toArray();
        return json(
          res,
          200,
          students.map((u) => ({
            id: idFromDoc(u),
            name: u.name,
            email: u.email,
            hasSelectedTopic: Boolean(u.selectedTopicId),
          })),
        );
      }

      if (req.method === 'GET' && req.url === '/admin/audit') {
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const { audit } = await getDb();
        const items = await audit
          .find({})
          .sort(sortByCreatedAtDesc)
          .project({ id: 1, _id: 1, actor: 1, action: 1, targetId: 1, ip: 1, result: 1, createdAt: 1 })
          .toArray();
        return json(
          res,
          200,
          items.map((entry) => ({
            id: idFromDoc(entry),
            actor: entry.actor,
            action: entry.action,
            targetId: entry.targetId ?? null,
            ip: entry.ip,
            result: entry.result,
            createdAt: entry.createdAt,
          })),
        );
      }

      if (req.method === 'GET' && req.url === '/admin/export/audit') {
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const { audit } = await getDb();
        const items = await audit.find({}).sort(sortByCreatedAtDesc).toArray();

        const header = ['createdAt', 'actor', 'action', 'targetId', 'ip', 'result'].join(',');
        const rows = items.map((entry) =>
          [
            csvSafe(entry.createdAt),
            csvSafe(entry.actor),
            csvSafe(entry.action),
            csvSafe(entry.targetId),
            csvSafe(entry.ip),
            csvSafe(entry.result),
          ].join(','),
        );

        await logAudit({
          actor: session.sub,
          action: 'EXPORT_AUDIT',
          ip: getIp(req),
          result: 'success',
          targetId: null,
        });

        const datePart = new Date().toISOString().slice(0, 10);
        return csv(res, 200, [header, ...rows].join('\n'), `audit-log-${datePart}.csv`);
      }

      if (req.method === 'GET' && req.url === '/admin/export/status') {
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const { topics, users } = await getDb();
        const [topicItems, userItems] = await Promise.all([
          topics.find({}).toArray(),
          users.find({}).project({ id: 1, _id: 1, name: 1, email: 1 }).toArray(),
        ]);

        const usersById = new Map(userItems.map((u) => [idFromDoc(u), u]));
        const header = ['title', 'description', 'supervisor', 'department', 'studentName', 'studentEmail', 'status'].join(
          ',',
        );
        const rows = topicItems.map((topic) => {
          const selectedUser = topic.selectedByUserId ? usersById.get(String(topic.selectedByUserId)) : null;
          return [
            csvSafe(topic.title),
            csvSafe(topic.description),
            csvSafe(topic.supervisor),
            csvSafe(topic.department),
            csvSafe(selectedUser?.name ?? ''),
            csvSafe(selectedUser?.email ?? ''),
            csvSafe(selectedUser ? 'зайнята' : 'вільна'),
          ].join(',');
        });

        await logAudit({
          actor: session.sub,
          action: 'EXPORT_STATUS',
          ip: getIp(req),
          result: 'success',
          targetId: null,
        });

        const datePart = new Date().toISOString().slice(0, 10);
        return csv(res, 200, [header, ...rows].join('\n'), `topics-status-${datePart}.csv`);
      }

      if (req.method === 'POST' && req.url === '/admin/users') {
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const { name = '', email = '' } = await readJsonBody(req);
        const created = await createStudent({ name, email });
        if (created.error) {
          if (created.error.code === 'EMAIL_ALREADY_EXISTS') {
            return json(res, 409, {
              error: 'EMAIL_ALREADY_EXISTS',
              message: 'Студент з таким email вже існує',
            });
          }
          return json(res, 400, { error: 'VALIDATION_ERROR', message: created.error.message });
        }

        await logAudit({
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
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const body = await readJsonBody(req);
        const items = Array.isArray(body) ? body : [];
        const errors = [];
        const createdUsers = [];
        const seen = new Set();

        for (let index = 0; index < items.length; index += 1) {
          const row = index + 1;
          const item = items[index];
          const emailKey = toEmailKey(item?.email);
          if (seen.has(emailKey)) {
            errors.push({ row, message: 'Duplicate email in CSV payload' });
            continue;
          }
          seen.add(emailKey);

          const created = await createStudent({ name: item?.name ?? '', email: item?.email ?? '' });
          if (created.error) {
            errors.push({ row, message: created.error.message });
            continue;
          }
          createdUsers.push({
            name: created.data.name,
            email: created.data.email,
            password: created.data.newPassword,
          });
        }

        await logAudit({
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
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const targetId = deleteUserMatch[1];
        const { users } = await getDb();
        const found = await users.findOne({ role: 'student', ...idQuery(targetId) });
        if (!found) {
          return json(res, 404, { error: 'NOT_FOUND', message: 'Student not found' });
        }

        await users.deleteOne(idQuery(idFromDoc(found)));
        await logAudit({
          actor: session.sub,
          action: 'DELETE_USER',
          ip: getIp(req),
          result: 'success',
          targetId: idFromDoc(found),
        });
        return noContent(res);
      }

      const resetPasswordMatch = req.url?.match(/^\/admin\/users\/([^/]+)\/reset-password$/);
      if (req.method === 'POST' && resetPasswordMatch) {
        const session = await requireAuth(req, res);
        if (!session) return;
        if (!requireRole(session, 'admin', res)) return;

        const targetId = resetPasswordMatch[1];
        const { users } = await getDb();
        const found = await users.findOne({ role: 'student', ...idQuery(targetId) });
        if (!found) {
          return json(res, 404, { error: 'NOT_FOUND', message: 'Student not found' });
        }

        const newPassword = randomPassword();
        await users.updateOne(idQuery(idFromDoc(found)), {
          $set: {
            passwordHash: hashPassword(newPassword),
            failedAttempts: 0,
            lockedUntilMs: null,
          },
        });

        await logAudit({
          actor: session.sub,
          action: 'RESET_PASSWORD',
          ip: getIp(req),
          result: 'success',
          targetId: idFromDoc(found),
        });

        return json(res, 200, { newPassword });
      }

      return json(res, 404, { error: 'NOT_FOUND', message: 'Not Found' });
    } catch (error) {
      console.error('[backend] request failed', error);
      return json(res, 500, { error: 'INTERNAL_ERROR', message: 'Internal server error' });
    }
  };

  return {
    handler,
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
        text: response.rawBody,
      };
    },
  };
};
