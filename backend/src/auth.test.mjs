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
  assert.equal(response.body.selectedTopic, null);

  const cookie = response.headers['Set-Cookie'] || '';
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=None/);
  assert.match(cookie, /Max-Age=86400/);
});

test('student login returns selectedTopic after successful selection', async () => {
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
  assert.ok(topics.body.length >= 1);

  const select = await app.inject({
    method: 'POST',
    url: `/topics/${topics.body[0].id}/select`,
    headers: { cookie: studentCookie },
  });
  assert.equal(select.status, 200);

  const relogin = await login(app, 'student@example.com', 'student123');
  assert.equal(relogin.status, 200);
  assert.equal(relogin.body.role, 'student');
  assert.ok(relogin.body.selectedTopic);
  assert.equal(relogin.body.selectedTopic.id, topics.body[0].id);
  assert.equal(typeof relogin.body.selectedTopic.title, 'string');
});

test('selected topic is excluded from student GET /topics list after selection', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const studentLogin = await login(app, 'student@example.com', 'student123');
  const studentCookie = studentLogin.headers['Set-Cookie'];
  assert.ok(studentCookie);

  const before = await app.inject({
    method: 'GET',
    url: '/topics',
    headers: { cookie: studentCookie },
  });
  assert.equal(before.status, 200);
  assert.ok(before.body.length >= 1);
  const selectedId = before.body[0].id;

  const select = await app.inject({
    method: 'POST',
    url: `/topics/${selectedId}/select`,
    headers: { cookie: studentCookie },
  });
  assert.equal(select.status, 200);

  const after = await app.inject({
    method: 'GET',
    url: '/topics',
    headers: { cookie: studentCookie },
  });
  assert.equal(after.status, 200);
  assert.equal(after.body.some((t) => t.id === selectedId), false);
});

test('student cannot release topic via non-existing endpoint', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const studentLogin = await login(app, 'student@example.com', 'student123');
  const studentCookie = studentLogin.headers['Set-Cookie'];
  assert.ok(studentCookie);

  const response = await app.inject({
    method: 'POST',
    url: '/topics/any-topic-id/release',
    headers: { cookie: studentCookie },
  });
  assert.equal(response.status, 404);
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
  assert.ok(Array.isArray(topics.body));
  assert.ok(topics.body.length >= 1);
  assert.equal(typeof topics.body[0].title, 'string');
  assert.equal(topics.body[0].selectedBy, undefined);

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

test('student topic selection success, conflicts, and audit events', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const studentLogin = await login(app, 'student@example.com', 'student123');
  const studentCookie = studentLogin.headers['Set-Cookie'];
  assert.ok(studentCookie);

  const adminLogin = await login(app, 'admin@example.com', 'admin123');
  const adminCookie = adminLogin.headers['Set-Cookie'];
  assert.ok(adminCookie);

  const listBefore = await app.inject({
    method: 'GET',
    url: '/topics',
    headers: { cookie: studentCookie },
  });
  assert.equal(listBefore.status, 200);
  assert.ok(listBefore.body.length >= 1);
  const freeTopicId = listBefore.body[0].id;

  const takenTopic = await app.inject({
    method: 'POST',
    url: '/admin/topics',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: {
      title: 'Taken for conflict',
      description: 'Used to verify TOPIC_ALREADY_TAKEN',
      supervisor: 'Dr. Taken',
      department: 'CS',
    },
  });
  assert.equal(takenTopic.status, 201);

  const conflictTopicId = takenTopic.body.id;

  const secondStudentCreate = await app.inject({
    method: 'POST',
    url: '/admin/users',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: { name: 'Second Student', email: 'second.student@example.com' },
  });
  assert.equal(secondStudentCreate.status, 201);

  const secondStudentLogin = await login(app, 'second.student@example.com', secondStudentCreate.body.newPassword);
  const secondCookie = secondStudentLogin.headers['Set-Cookie'];
  assert.ok(secondCookie);

  const secondStudentSelect = await app.inject({
    method: 'POST',
    url: `/topics/${conflictTopicId}/select`,
    headers: { cookie: secondCookie },
  });
  assert.equal(secondStudentSelect.status, 200);

  const selectTakenByOther = await app.inject({
    method: 'POST',
    url: `/topics/${conflictTopicId}/select`,
    headers: { cookie: studentCookie },
  });
  assert.equal(selectTakenByOther.status, 409);
  assert.equal(selectTakenByOther.body.error, 'TOPIC_ALREADY_TAKEN');

  const selectSuccess = await app.inject({
    method: 'POST',
    url: `/topics/${freeTopicId}/select`,
    headers: { cookie: studentCookie },
  });
  assert.equal(selectSuccess.status, 200);
  assert.equal(selectSuccess.body.topic.id, freeTopicId);

  const selectAgain = await app.inject({
    method: 'POST',
    url: `/topics/${freeTopicId}/select`,
    headers: { cookie: studentCookie },
  });
  assert.equal(selectAgain.status, 409);
  assert.equal(selectAgain.body.error, 'ALREADY_SELECTED');

  const log = app.getAuditLog();
  const selectEvents = log.filter((entry) => entry.action === 'SELECT_TOPIC');
  assert.ok(selectEvents.some((entry) => entry.result === 'success' && entry.targetId === freeTopicId));
  assert.ok(selectEvents.some((entry) => entry.result === 'denied' && entry.targetId === freeTopicId));
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

test('admin exports topic status CSV with headers and audit', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const adminLogin = await login(app, 'admin@example.com', 'admin123');
  const adminCookie = adminLogin.headers['Set-Cookie'];
  assert.ok(adminCookie);

  const exportResponse = await app.inject({
    method: 'GET',
    url: '/admin/export/status',
    headers: { cookie: adminCookie },
  });
  assert.equal(exportResponse.status, 200);
  assert.match(exportResponse.headers['Content-Type'] || '', /^text\/csv/);
  assert.match(exportResponse.headers['Content-Disposition'] || '', /^attachment; filename="topics-status-\d{4}-\d{2}-\d{2}\.csv"$/);
  assert.match(
    exportResponse.text,
    /title,description,supervisor,department,studentName,studentEmail,status/,
  );
  assert.match(exportResponse.text, /"вільна"|"зайнята"/);

  const log = app.getAuditLog();
  const exportAudit = log.find((e) => e.action === 'EXPORT_STATUS' && e.result === 'success');
  assert.ok(exportAudit);
});

test('admin gets audit log sorted newest first and read-only endpoint does not self-log', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const studentLogin = await login(app, 'student@example.com', 'student123');
  const studentCookie = studentLogin.headers['Set-Cookie'];
  assert.ok(studentCookie);

  await app.inject({
    method: 'POST',
    url: '/auth/logout',
    headers: { cookie: studentCookie },
  });

  const adminLogin = await login(app, 'admin@example.com', 'admin123');
  const adminCookie = adminLogin.headers['Set-Cookie'];
  assert.ok(adminCookie);

  const beforeReadCount = app.getAuditLog().length;
  const auditResponse = await app.inject({
    method: 'GET',
    url: '/admin/audit',
    headers: { cookie: adminCookie },
  });
  assert.equal(auditResponse.status, 200);
  assert.ok(Array.isArray(auditResponse.body));
  assert.ok(auditResponse.body.length >= 2);
  assert.equal(typeof auditResponse.body[0].id, 'string');
  assert.equal(typeof auditResponse.body[0].createdAt, 'string');
  assert.ok(new Date(auditResponse.body[0].createdAt).toString() !== 'Invalid Date');
  assert.ok(
    auditResponse.body.every((entry, idx, arr) =>
      idx === 0 ? true : String(arr[idx - 1].createdAt).localeCompare(String(entry.createdAt)) >= 0,
    ),
  );

  const afterReadCount = app.getAuditLog().length;
  assert.equal(afterReadCount, beforeReadCount);
});

test('admin exports audit log CSV with headers and export audit event', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const studentLogin = await login(app, 'student@example.com', 'student123');
  const studentCookie = studentLogin.headers['Set-Cookie'];
  assert.ok(studentCookie);
  await app.inject({
    method: 'POST',
    url: '/auth/logout',
    headers: { cookie: studentCookie },
  });

  const adminLogin = await login(app, 'admin@example.com', 'admin123');
  const adminCookie = adminLogin.headers['Set-Cookie'];
  assert.ok(adminCookie);

  const response = await app.inject({
    method: 'GET',
    url: '/admin/export/audit',
    headers: { cookie: adminCookie },
  });
  assert.equal(response.status, 200);
  assert.match(response.headers['Content-Type'] || '', /^text\/csv/);
  assert.match(response.headers['Content-Disposition'] || '', /^attachment; filename="audit-log-\d{4}-\d{2}-\d{2}\.csv"$/);
  assert.match(response.text, /createdAt,actor,action,targetId,ip,result/);
  assert.match(response.text, /"LOGIN"/);
  assert.match(response.text, /"LOGOUT"/);

  const log = app.getAuditLog();
  const exportAudit = log.find((entry) => entry.action === 'EXPORT_AUDIT' && entry.result === 'success');
  assert.ok(exportAudit);
});

test('admin topics bulk create: partial success and audit count', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const adminLogin = await login(app, 'admin@example.com', 'admin123');
  const adminCookie = adminLogin.headers['Set-Cookie'];
  assert.ok(adminCookie);

  const bulk = await app.inject({
    method: 'POST',
    url: '/admin/topics/bulk',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: [
      {
        title: 'Topic One',
        description: 'Desc One',
        supervisor: 'Dr. One',
        department: 'CS',
      },
      {
        title: '',
        description: 'Desc Two',
        supervisor: 'Dr. Two',
        department: 'SE',
      },
      {
        title: 'Topic Three',
        description: 'Desc Three',
        supervisor: '',
        department: 'DS',
      },
      {
        title: 'Topic Four',
        description: 'Desc Four',
        supervisor: 'Dr. Four',
        department: 'Math',
      },
    ],
  });

  assert.equal(bulk.status, 200);
  assert.equal(bulk.body.created, 2);
  assert.equal(bulk.body.errors.length, 2);
  assert.equal(bulk.body.errors[0].row, 2);

  const list = await app.inject({
    method: 'GET',
    url: '/admin/topics',
    headers: { cookie: adminCookie },
  });
  assert.equal(list.status, 200);
  assert.ok(list.body.topics.some((t) => t.title === 'Topic One'));
  assert.ok(list.body.topics.some((t) => t.title === 'Topic Four'));
  assert.equal(list.body.topics.some((t) => t.title === 'Topic Three'), false);

  const log = app.getAuditLog();
  const audit = log.find((e) => e.action === 'BULK_CREATE_TOPICS');
  assert.ok(audit);
  assert.equal(audit.count, 2);
  assert.equal(audit.result, 'partial');
});

test('admin topics bulk create rejects non-array payload', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const adminLogin = await login(app, 'admin@example.com', 'admin123');
  const adminCookie = adminLogin.headers['Set-Cookie'];
  assert.ok(adminCookie);

  const bulk = await app.inject({
    method: 'POST',
    url: '/admin/topics/bulk',
    headers: { cookie: adminCookie, 'content-type': 'application/json' },
    body: { title: 'not-an-array' },
  });

  assert.equal(bulk.status, 400);
  assert.equal(bulk.body.error, 'VALIDATION_ERROR');
});

test('admin releases selected topic and gets errors for already free topic', async () => {
  const app = createApp({ jwtSecret: 'test-secret' });

  const adminLogin = await login(app, 'admin@example.com', 'admin123');
  const adminCookie = adminLogin.headers['Set-Cookie'];
  assert.ok(adminCookie);

  const list = await app.inject({
    method: 'GET',
    url: '/admin/topics',
    headers: { cookie: adminCookie },
  });
  assert.equal(list.status, 200);
  const occupied = list.body.topics.find((t) => t.selectedBy !== null);
  const free = list.body.topics.find((t) => t.selectedBy === null);
  assert.ok(occupied);
  assert.ok(free);

  const release = await app.inject({
    method: 'POST',
    url: `/admin/topics/${occupied.id}/release`,
    headers: { cookie: adminCookie },
  });
  assert.equal(release.status, 200);
  assert.equal(release.body.topic.id, occupied.id);
  assert.equal(release.body.topic.selectedBy, null);

  const alreadyFree = await app.inject({
    method: 'POST',
    url: `/admin/topics/${free.id}/release`,
    headers: { cookie: adminCookie },
  });
  assert.equal(alreadyFree.status, 409);
  assert.equal(alreadyFree.body.error, 'TOPIC_ALREADY_FREE');

  const missing = await app.inject({
    method: 'POST',
    url: '/admin/topics/missing/release',
    headers: { cookie: adminCookie },
  });
  assert.equal(missing.status, 404);

  const log = app.getAuditLog();
  const releaseAudit = log.find((e) => e.action === 'RELEASE_TOPIC' && e.targetId === occupied.id);
  assert.ok(releaseAudit);
  assert.equal(releaseAudit.result, 'success');
  const deniedAlreadyFree = log.find(
    (e) => e.action === 'RELEASE_TOPIC' && e.targetId === free.id && e.result === 'denied',
  );
  assert.ok(deniedAlreadyFree);
  const deniedMissing = log.find(
    (e) => e.action === 'RELEASE_TOPIC' && e.targetId === 'missing' && e.result === 'denied',
  );
  assert.ok(deniedMissing);
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
