const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';
const apiBaseUrl = rawApiBaseUrl.replace(/\/+$/, '');

export const apiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!apiBaseUrl) return normalizedPath;
  return `${apiBaseUrl}${normalizedPath}`;
};
