import { getLang, t } from '../i18n';

export const API_URL = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'nova-token';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: the session lasts until the tab closes */
  }
}

let onUnauthorized: () => void = () => {};
/** Called when the server rejects the token, so the app can return to the sign-in screen. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

/** Fired after any successful change, so counts elsewhere on screen (menu badges) refresh. */
export const DATA_CHANGED = 'nova:data-changed';

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        'Accept-Language': getLang(),
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(t('common.serverDown'), 0);
  }

  if (res.status === 401 && token) onUnauthorized();
  // The dev proxy answers 502-504 while the backend is down or restarting.
  if (res.status >= 502 && res.status <= 504) {
    throw new ApiError(t('common.serverDown'), res.status);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = Array.isArray(body?.message) ? body.message.join('. ') : body?.message;
    throw new ApiError(message || t('common.error', { status: res.status }), res.status);
  }
  // 204 No Content (e.g. after a delete) has no body to read.
  const data = (res.status === 204 ? undefined : await res.json()) as T;
  if ((rest.method ?? 'GET') !== 'GET' && !path.includes('dryRun') && !path.startsWith('/auth') && !path.startsWith('/assistant') && !path.includes('suggest-unit')) {
    window.dispatchEvent(new Event(DATA_CHANGED));
  }
  return data;
}

/** Builds "?a=1&b=2" from the defined values only. */
export function query(params: Record<string, string | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : '';
}
