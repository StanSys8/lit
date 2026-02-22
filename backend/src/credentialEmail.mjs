import { createHash, createHmac } from 'node:crypto';

const EMAIL_SERVICE = 'ses';
const EMAIL_PATH = '/v2/email/outbound-emails';

const hashHex = (value) => createHash('sha256').update(value).digest('hex');
const hmacBuffer = (key, value) => createHmac('sha256', key).update(value).digest();

const toAmzDate = (value = new Date()) => value.toISOString().replace(/[:-]|\.\d{3}/g, '');
const toDateStamp = (amzDate) => amzDate.slice(0, 8);

const normalizeBaseUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw === '*') return '';
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
};

const buildLoginUrl = (baseUrl) => {
  if (!baseUrl) return '';
  return baseUrl.endsWith('/login') ? baseUrl : `${baseUrl}/login`;
};

const buildCanonicalHeaders = (headers) =>
  Object.entries(headers)
    .map(([key, value]) => [key.toLowerCase(), String(value).trim()])
    .sort(([left], [right]) => left.localeCompare(right));

const buildAuthorizationHeader = ({
  accessKeyId,
  secretAccessKey,
  region,
  host,
  payload,
  sessionToken = '',
  now = new Date(),
}) => {
  const amzDate = toAmzDate(now);
  const dateStamp = toDateStamp(amzDate);
  const canonicalHeadersInput = {
    'content-type': 'application/json',
    host,
    'x-amz-date': amzDate,
  };
  if (sessionToken) canonicalHeadersInput['x-amz-security-token'] = sessionToken;

  const canonicalHeaders = buildCanonicalHeaders(canonicalHeadersInput);
  const canonicalHeadersText = canonicalHeaders.map(([key, value]) => `${key}:${value}\n`).join('');
  const signedHeaders = canonicalHeaders.map(([key]) => key).join(';');
  const payloadHash = hashHex(payload);

  const canonicalRequest = ['POST', EMAIL_PATH, '', canonicalHeadersText, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/${EMAIL_SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hashHex(canonicalRequest),
  ].join('\n');

  const keyDate = hmacBuffer(`AWS4${secretAccessKey}`, dateStamp);
  const keyRegion = hmacBuffer(keyDate, region);
  const keyService = hmacBuffer(keyRegion, EMAIL_SERVICE);
  const keySigning = hmacBuffer(keyService, 'aws4_request');
  const signature = createHmac('sha256', keySigning).update(stringToSign).digest('hex');

  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    amzDate,
  };
};

const buildEmailBodyText = ({ studentName, loginUrl, email, password }) =>
  [
    `Вітаємо, ${studentName || 'студент'}!`,
    'Ваш обліковий запис у системі вибору тем створено.',
    '',
    `Посилання: ${loginUrl}`,
    `Логін: ${email}`,
    `Пароль: ${password}`,
    '',
    'Якщо ви не очікували цей лист, зверніться до адміністратора.',
  ].join('\n');

export const createCredentialEmailSender = ({
  fromEmail = '',
  appBaseUrl = '',
  emailRegion = '',
  credentialsProvider = () => ({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    sessionToken: process.env.AWS_SESSION_TOKEN || '',
  }),
  fetchImpl = globalThis.fetch,
} = {}) => {
  const from = String(fromEmail || '').trim();
  const normalizedBaseUrl = normalizeBaseUrl(appBaseUrl);
  const loginUrl = buildLoginUrl(normalizedBaseUrl);
  const region = String(emailRegion || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '').trim();

  if (!from || !loginUrl || !region || typeof fetchImpl !== 'function') {
    return null;
  }

  const host = `email.${region}.amazonaws.com`;
  const endpoint = `https://${host}${EMAIL_PATH}`;

  return async ({ toEmail, studentName, password }) => {
    const targetEmail = String(toEmail || '').trim().toLowerCase();
    if (!targetEmail || !password) {
      throw new Error('Missing recipient email or password for credentials email');
    }

    const { accessKeyId, secretAccessKey, sessionToken } = credentialsProvider() || {};
    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials are unavailable for SES send');
    }

    const payload = JSON.stringify({
      FromEmailAddress: from,
      Destination: { ToAddresses: [targetEmail] },
      Content: {
        Simple: {
          Subject: {
            Data: 'Доступ до системи вибору тем',
            Charset: 'UTF-8',
          },
          Body: {
            Text: {
              Data: buildEmailBodyText({
                studentName: String(studentName || '').trim(),
                loginUrl,
                email: targetEmail,
                password: String(password),
              }),
              Charset: 'UTF-8',
            },
          },
        },
      },
    });

    const { authorization, amzDate } = buildAuthorizationHeader({
      accessKeyId,
      secretAccessKey,
      region,
      host,
      payload,
      sessionToken,
    });

    const headers = {
      'content-type': 'application/json',
      'x-amz-date': amzDate,
      authorization,
    };
    if (sessionToken) headers['x-amz-security-token'] = sessionToken;

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body: payload,
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`SES send failed (${response.status}): ${details || 'unknown error'}`);
    }

    const result = await response.json().catch(() => ({}));
    return { messageId: result?.MessageId || '' };
  };
};
