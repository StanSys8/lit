import { createHmac, randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const scryptAsync = promisify(scrypt);

const base64url = (input) => Buffer.from(input).toString('base64url');
const jsonB64 = (value) => base64url(JSON.stringify(value));

export const hashPassword = (password, salt = randomBytes(16).toString('hex')) => {
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }).toString('hex');
  return `${salt}:${derived}`;
};

export const hashPasswordAsync = async (password, salt = randomBytes(16).toString('hex')) => {
  const derived = (await scryptAsync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })).toString('hex');
  return `${salt}:${derived}`;
};

export const bcryptCompare = async (password, encodedHash) => {
  const [salt, storedHex] = encodedHash.split(':');
  if (!salt || !storedHex) return false;

  const candidateHex = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }).toString('hex');

  const stored = Buffer.from(storedHex, 'hex');
  const candidate = Buffer.from(candidateHex, 'hex');
  if (stored.length !== candidate.length) return false;

  return timingSafeEqual(stored, candidate);
};

export const signToken = (payload, secret) => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = jsonB64(header);
  const encodedPayload = jsonB64(payload);
  const unsigned = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secret).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
};

export const verifyToken = (token, secret) => {
  const [headerB64, payloadB64, signature] = token.split('.');
  if (!headerB64 || !payloadB64 || !signature) return null;

  const unsigned = `${headerB64}.${payloadB64}`;
  const expected = createHmac('sha256', secret).update(unsigned).digest('base64url');
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};
