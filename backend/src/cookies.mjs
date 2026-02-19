export const parseCookies = (cookieHeader = '') => {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const eq = part.indexOf('=');
      if (eq < 0) return acc;
      const key = part.slice(0, eq);
      const value = decodeURIComponent(part.slice(eq + 1));
      acc[key] = value;
      return acc;
    }, {});
};

export const buildSessionCookie = (token, maxAgeSec = 86400) => {
  return [
    `session=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${maxAgeSec}`,
    'HttpOnly',
    'Secure',
    'SameSite=None',
  ].join('; ');
};

export const buildClearedSessionCookie = () => {
  return [
    'session=',
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=None',
  ].join('; ');
};
