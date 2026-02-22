import test from 'node:test';
import assert from 'node:assert/strict';
import { createCredentialEmailSender } from './credentialEmail.mjs';

test('credential email sender returns null when required configuration is missing', () => {
  assert.equal(
    createCredentialEmailSender({
      fromEmail: '',
      appBaseUrl: 'https://lit.example.com',
      emailRegion: 'eu-central-1',
      fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
    }),
    null,
  );

  assert.equal(
    createCredentialEmailSender({
      fromEmail: 'no-reply@example.com',
      appBaseUrl: '',
      emailRegion: 'eu-central-1',
      fetchImpl: async () => ({ ok: true, json: async () => ({}) }),
    }),
    null,
  );
});

test('credential email sender posts login, email, and password via SES API', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({ MessageId: 'msg-123' }) };
  };

  const sender = createCredentialEmailSender({
    fromEmail: 'no-reply@example.com',
    appBaseUrl: 'https://lit.example.com',
    emailRegion: 'eu-central-1',
    fetchImpl,
    credentialsProvider: () => ({
      accessKeyId: 'AKIA_TEST_KEY',
      secretAccessKey: 'SECRET_TEST_KEY',
      sessionToken: 'SESSION_TOKEN',
    }),
  });

  assert.equal(typeof sender, 'function');

  const result = await sender({
    toEmail: 'student@example.com',
    studentName: 'Test Student',
    password: 'pass-123',
  });

  assert.equal(result.messageId, 'msg-123');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://email.eu-central-1.amazonaws.com/v2/email/outbound-emails');
  assert.equal(calls[0].init.method, 'POST');
  assert.match(String(calls[0].init.headers.authorization), /^AWS4-HMAC-SHA256 /);
  assert.match(String(calls[0].init.headers['x-amz-date']), /^\d{8}T\d{6}Z$/);
  assert.equal(calls[0].init.headers['x-amz-security-token'], 'SESSION_TOKEN');

  const payload = JSON.parse(calls[0].init.body);
  assert.equal(payload.FromEmailAddress, 'no-reply@example.com');
  assert.equal(payload.Destination.ToAddresses[0], 'student@example.com');
  assert.equal(payload.Content.Simple.Subject.Data, 'Доступ до системи вибору тем');
  assert.match(payload.Content.Simple.Body.Text.Data, /Посилання: https:\/\/lit\.example\.com\/login/);
  assert.match(payload.Content.Simple.Body.Text.Data, /Логін: student@example\.com/);
  assert.match(payload.Content.Simple.Body.Text.Data, /Пароль: pass-123/);
});

test('credential email sender surfaces SES failures', async () => {
  const fetchImpl = async () => ({
    ok: false,
    status: 403,
    text: async () => 'AccessDenied',
  });

  const sender = createCredentialEmailSender({
    fromEmail: 'no-reply@example.com',
    appBaseUrl: 'https://lit.example.com',
    emailRegion: 'eu-central-1',
    fetchImpl,
    credentialsProvider: () => ({
      accessKeyId: 'AKIA_TEST_KEY',
      secretAccessKey: 'SECRET_TEST_KEY',
      sessionToken: '',
    }),
  });

  await assert.rejects(
    () =>
      sender({
        toEmail: 'student@example.com',
        studentName: 'Fail Student',
        password: 'pass-123',
      }),
    /SES send failed \(403\): AccessDenied/,
  );
});
