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
