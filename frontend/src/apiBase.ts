const PROD_API_FALLBACK = 'https://58r8t1adkk.execute-api.eu-central-1.amazonaws.com';
const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';
const normalizedEnvApiBaseUrl = rawApiBaseUrl.replace(/\/+$/, '');

const runtimeHost =
  typeof window !== 'undefined' && window.location && typeof window.location.hostname === 'string'
    ? window.location.hostname
    : '';

const shouldUseProdFallback = runtimeHost.endsWith('.pages.dev');
const apiBaseUrl = normalizedEnvApiBaseUrl || (shouldUseProdFallback ? PROD_API_FALLBACK : '');

if (!normalizedEnvApiBaseUrl && shouldUseProdFallback && typeof console !== 'undefined') {
  console.warn('[apiBase] VITE_API_BASE_URL is missing in build; using production fallback API base URL.');
}

export const apiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!apiBaseUrl) return normalizedPath;
  return `${apiBaseUrl}${normalizedPath}`;
};
