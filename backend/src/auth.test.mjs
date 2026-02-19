import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './server.mjs';

const login = (app, email, password) =>
  app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: { 'content-type': 'application/json' },
    body: { email, password },
  });

test('student login returns 200 and secure cookie', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const response = await login(app, 'student@example.com', 'student123');
  assert.equal(response.status, 200);
  assert.equal(response.body.role, 'student');

  const cookie = response.headers['Set-Cookie'] || '';
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=None/);
  assert.match(cookie, /Max-Age=86400/);
});

test('invalid credentials returns same 401 message', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const missingUser = await login(app, 'missing@example.com', 'wrong');
  const wrongPassword = await login(app, 'student@example.com', 'wrong');

  assert.equal(missingUser.status, 401);
  assert.equal(wrongPassword.status, 401);
  assert.equal(missingUser.body.error, 'INVALID_CREDENTIALS');
  assert.equal(wrongPassword.body.error, 'INVALID_CREDENTIALS');
  assert.equal(missingUser.body.message, wrongPassword.body.message);
});

test('lockout after repeated failed attempts', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  for (let i = 0; i < 4; i += 1) {
    const r = await login(app, 'student@example.com', 'wrong');
    assert.equal(r.status, 401);
  }

  const fifth = await login(app, 'student@example.com', 'wrong');
  assert.equal(fifth.status, 423);
  assert.equal(fifth.body.error, 'ACCOUNT_LOCKED');

  const sixth = await login(app, 'student@example.com', 'wrong');
  assert.equal(sixth.status, 423);
});

test('role-based guard on /topics and /admin/topics', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const studentLogin = await login(app, 'student@example.com', 'student123');
  const studentCookie = studentLogin.headers['Set-Cookie'];
  assert.ok(studentCookie);

  const topics = await app.inject({
    method: 'GET',
    url: '/topics',
    headers: { cookie: studentCookie },
  });
  assert.equal(topics.status, 200);

  const adminTopicsForbidden = await app.inject({
    method: 'GET',
    url: '/admin/topics',
    headers: { cookie: studentCookie },
  });
  assert.equal(adminTopicsForbidden.status, 403);

  const unauthenticated = await app.inject({ method: 'GET', url: '/topics' });
  assert.equal(unauthenticated.status, 401);

  const adminLogin = await login(app, 'admin@example.com', 'admin123');
  const adminCookie = adminLogin.headers['Set-Cookie'];
  assert.ok(adminCookie);

  const adminTopics = await app.inject({
    method: 'GET',
    url: '/admin/topics',
    headers: { cookie: adminCookie },
  });
  assert.equal(adminTopics.status, 200);
});

test('audit contains login events with success/failed/locked', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  await login(app, 'student@example.com', 'student123');
  await login(app, 'student@example.com', 'wrong');

  for (let i = 0; i < 5; i += 1) {
    await login(app, 'admin@example.com', 'wrong');
  }

  const log = app.getAuditLog();
  const results = new Set(log.filter((e) => e.action === 'LOGIN').map((e) => e.result));

  assert.ok(results.has('success'));
  assert.ok(results.has('failed'));
  assert.ok(results.has('locked'));
});

test('logout clears cookie, protected routes reject cleared cookie, and audit logs logout', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const loginResponse = await login(app, 'student@example.com', 'student123');
  const cookie = loginResponse.headers['Set-Cookie'];
  assert.ok(cookie);

  const logout = await app.inject({
    method: 'POST',
    url: '/auth/logout',
    headers: { cookie },
  });
  assert.equal(logout.status, 200);

  const clearedCookie = logout.headers['Set-Cookie'] || '';
  assert.match(clearedCookie, /Max-Age=0/);

  const unauthorized = await app.inject({
    method: 'GET',
    url: '/topics',
    headers: { cookie: clearedCookie },
  });
  assert.equal(unauthorized.status, 401);

  const log = app.getAuditLog();
  const logoutEntries = log.filter((e) => e.action === 'LOGOUT' && e.result === 'success');
  assert.ok(logoutEntries.length >= 1);
  assert.equal(typeof logoutEntries[0].actor, 'string');
  assert.ok(logoutEntries[0].actor.length > 0);
});

test('admin users CRUD: list, create, duplicate, delete, not found, auth guards, audit', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const adminLogin = await login(app, 'admin@example.com', 'admin123');
  const adminCookie = adminLogin.headers['Set-Cookie'];
  assert.ok(adminCookie);

  const studentLogin = await login(app, 'student@example.com', 'student123');
  const studentCookie = studentLogin.headers['Set-Cookie'];
  assert.ok(studentCookie);

  const unauthorizedList = await app.inject({ method: 'GET', url: '/admin/users' });
  assert.equal(unauthorizedList.status, 401);

  const forbiddenList = await app.inject({
    method: 'GET',
    url: '/admin/users',
    headers: { cookie: studentCookie },
  });
  assert.equal(forbiddenList.status, 403);

  const listBefore = await app.inject({
    method: 'GET',
    url: '/admin/users',
    headers: { cookie: adminCookie },
  });
  assert.equal(listBefore.status, 200);
  assert.ok(Array.isArray(listBefore.body));

  const createResponse = await app.inject({
    method: 'POST',
    url: '/admin/users',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: { name: 'New Student', email: 'new.student@example.com' },
  });
  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.name, 'New Student');
  assert.equal(createResponse.body.email, 'new.student@example.com');
  assert.equal(typeof createResponse.body.newPassword, 'string');
  assert.ok(createResponse.body.newPassword.length > 0);

  const duplicate = await app.inject({
    method: 'POST',
    url: '/admin/users',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: { name: 'Dup', email: 'new.student@example.com' },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error, 'EMAIL_ALREADY_EXISTS');

  const listAfter = await app.inject({
    method: 'GET',
    url: '/admin/users',
    headers: { cookie: adminCookie },
  });
  assert.equal(listAfter.status, 200);

  const createdInList = listAfter.body.find((u) => u.email === 'new.student@example.com');
  assert.ok(createdInList);
  assert.equal(createdInList.name, 'New Student');
  assert.equal(typeof createdInList.hasSelectedTopic, 'boolean');

  const deleteResponse = await app.inject({
    method: 'DELETE',
    url: `/admin/users/${createResponse.body.id}`,
    headers: { cookie: adminCookie },
  });
  assert.equal(deleteResponse.status, 204);

  const deleteMissing = await app.inject({
    method: 'DELETE',
    url: `/admin/users/${createResponse.body.id}`,
    headers: { cookie: adminCookie },
  });
  assert.equal(deleteMissing.status, 404);

  const log = app.getAuditLog();
  const createAudit = log.find((e) => e.action === 'CREATE_USER' && e.targetId === createResponse.body.id);
  const deleteAudit = log.find((e) => e.action === 'DELETE_USER' && e.targetId === createResponse.body.id);
  assert.ok(createAudit);
  assert.ok(deleteAudit);
});

test('admin users bulk create: partial success with duplicates and audit count', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const adminLogin = await login(app, 'admin@example.com', 'admin123');
  const adminCookie = adminLogin.headers['Set-Cookie'];
  assert.ok(adminCookie);

  const bulk = await app.inject({
    method: 'POST',
    url: '/admin/users/bulk',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: [
      { name: 'Bulk One', email: 'bulk1@example.com' },
      { name: 'Bulk Two', email: 'bulk2@example.com' },
      { name: 'Dup in payload', email: 'bulk1@example.com' },
      { name: 'Dup in DB', email: 'student@example.com' },
      { name: '', email: 'bad@example.com' },
    ],
  });

  assert.equal(bulk.status, 200);
  assert.equal(bulk.body.created, 2);
  assert.equal(bulk.body.users.length, 2);
  assert.equal(bulk.body.errors.length, 3);
  assert.equal(bulk.body.users[0].email, 'bulk1@example.com');
  assert.equal(typeof bulk.body.users[0].password, 'string');

  const log = app.getAuditLog();
  const auditEntry = log.find((e) => e.action === 'BULK_CREATE_USERS');
  assert.ok(auditEntry);
  assert.equal(auditEntry.count, 2);
});

test('admin topics CRUD: list, create, delete free topic, reject delete used topic, and audit', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const adminLogin = await login(app, 'admin@example.com', 'admin123');
  const adminCookie = adminLogin.headers['Set-Cookie'];
  assert.ok(adminCookie);

  const studentLogin = await login(app, 'student@example.com', 'student123');
  const studentCookie = studentLogin.headers['Set-Cookie'];
  assert.ok(studentCookie);

  const unauthorizedList = await app.inject({ method: 'GET', url: '/admin/topics' });
  assert.equal(unauthorizedList.status, 401);

  const forbiddenList = await app.inject({
    method: 'GET',
    url: '/admin/topics',
    headers: { cookie: studentCookie },
  });
  assert.equal(forbiddenList.status, 403);

  const listBefore = await app.inject({
    method: 'GET',
    url: '/admin/topics',
    headers: { cookie: adminCookie },
  });
  assert.equal(listBefore.status, 200);
  assert.ok(Array.isArray(listBefore.body.topics));
  assert.ok(listBefore.body.topics.length >= 2);
  assert.equal(listBefore.body.topics.some((t) => t.selectedBy !== null), true);

  const create = await app.inject({
    method: 'POST',
    url: '/admin/topics',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: {
      title: 'Graph Databases in Research Portals',
      description: 'Knowledge graph design for topic discovery.',
      supervisor: 'Dr. Lee',
      department: 'Software Engineering',
    },
  });
  assert.equal(create.status, 201);
  assert.equal(create.body.selectedBy, null);
  assert.equal(create.body.title, 'Graph Databases in Research Portals');

  const deleteFree = await app.inject({
    method: 'DELETE',
    url: `/admin/topics/${create.body.id}`,
    headers: { cookie: adminCookie },
  });
  assert.equal(deleteFree.status, 204);

  const usedTopic = listBefore.body.topics.find((t) => t.selectedBy !== null);
  assert.ok(usedTopic);
  const deleteUsed = await app.inject({
    method: 'DELETE',
    url: `/admin/topics/${usedTopic.id}`,
    headers: { cookie: adminCookie },
  });
  assert.equal(deleteUsed.status, 409);
  assert.equal(deleteUsed.body.error, 'TOPIC_IN_USE');

  const deleteMissing = await app.inject({
    method: 'DELETE',
    url: '/admin/topics/missing',
    headers: { cookie: adminCookie },
  });
  assert.equal(deleteMissing.status, 404);

  const invalidCreate = await app.inject({
    method: 'POST',
    url: '/admin/topics',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: { title: '', description: '', supervisor: '', department: '' },
  });
  assert.equal(invalidCreate.status, 400);

  const log = app.getAuditLog();
  const createAudit = log.find((e) => e.action === 'CREATE_TOPIC' && e.targetId === create.body.id);
  const deleteAudit = log.find((e) => e.action === 'DELETE_TOPIC' && e.targetId === create.body.id);
  assert.ok(createAudit);
  assert.ok(deleteAudit);
});

test('admin reset password: returns one-time password, updates auth, and logs audit without plaintext', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const adminLogin = await login(app, 'admin@example.com', 'admin123');
  const adminCookie = adminLogin.headers['Set-Cookie'];
  assert.ok(adminCookie);

  const list = await app.inject({
    method: 'GET',
    url: '/admin/users',
    headers: { cookie: adminCookie },
  });
  assert.equal(list.status, 200);
  const target = list.body.find((u) => u.email === 'student@example.com');
  assert.ok(target);

  const reset = await app.inject({
    method: 'POST',
    url: `/admin/users/${target.id}/reset-password`,
    headers: { cookie: adminCookie },
  });
  assert.equal(reset.status, 200);
  assert.equal(typeof reset.body.newPassword, 'string');
  assert.ok(reset.body.newPassword.length > 0);

  const oldLogin = await login(app, 'student@example.com', 'student123');
  assert.equal(oldLogin.status, 401);

  const newLogin = await login(app, 'student@example.com', reset.body.newPassword);
  assert.equal(newLogin.status, 200);

  const missing = await app.inject({
    method: 'POST',
    url: '/admin/users/missing-id/reset-password',
    headers: { cookie: adminCookie },
  });
  assert.equal(missing.status, 404);

  const log = app.getAuditLog();
  const resetEntry = log.find((e) => e.action === 'RESET_PASSWORD' && e.targetId === target.id);
  assert.ok(resetEntry);
  const serialized = JSON.stringify(resetEntry);
  assert.ok(!serialized.includes(reset.body.newPassword));
});
