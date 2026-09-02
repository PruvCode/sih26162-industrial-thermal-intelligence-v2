/**
 * HTTP TRANSPORT for the FastAPI backend.
 *
 * Every request the app makes goes through here, so there is exactly one place
 * where the `/api/v1` prefix is applied, a request id is attached, a timeout is
 * enforced, and a FastAPI error body is turned into an `ApiError`.
 *
 * The previous `lib/api.ts` called `/events` and `/analytics/summary`. The
 * backend actually serves `/api/v1/events` and `/api/v1/analytics/summary`, and
 * it also called `/analytics/clusters`, which does not exist at all. Those
 * calls could never have succeeded — they were never exercised because the app
 * has always run from demo data.
 */

import { ApiError, parseErrorPayload } from './errors';

/**
 * Base URL from the environment, with no trailing slash so every path below can
 * safely start with one.
 *
 * Deliberately empty by default: an unset `NEXT_PUBLIC_API_URL` means "use demo
 * data", which is the correct behaviour for a fresh clone and for the SIH demo.
 */
export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

const API_PREFIX = '/api/v1';

export const DEFAULT_TIMEOUT_MS = 10_000;

/** `true` when a backend has actually been configured. */
export function isApiConfigured(): boolean {
  return API_BASE_URL.length > 0;
}

export type QueryParams = Record<string, string | number | boolean | string[] | undefined | null>;

/**
 * Build a query string, dropping empty values.
 *
 * Arrays are comma-joined (`?class=industrial_fire,natural_wildfire`) because
 * that is what the FastAPI endpoints accept for multi-value filters.
 */
export function toQueryString(params: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) search.set(key, value.join(','));
    } else {
      search.set(key, String(value));
    }
  }
  return search.toString();
}

export function buildUrl(path: string, query?: QueryParams): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE_URL}${API_PREFIX}${suffix}`;
  const qs = query ? toQueryString(query) : '';
  return qs ? `${url}?${qs}` : url;
}

function newRequestId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Echoed by the backend so a user-reported failure can be found in the logs. */
export const REQUEST_ID_HEADER = 'X-Request-ID';

export interface RequestOptions {
  query?: QueryParams;
  timeoutMs?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

async function toApiError(response: Response, requestId: string): Promise<ApiError> {
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // A non-JSON error body (proxy timeout page, empty 502). Keep status-derived code.
  }

  const parsed = parseErrorPayload(payload);
  return new ApiError({
    status: response.status,
    code: parsed.code,
    message: parsed.message ?? `${response.status} ${response.statusText}`,
    requestId: response.headers.get(REQUEST_ID_HEADER) ?? requestId,
    details: parsed.details,
  });
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options: RequestOptions & { body?: unknown } = {}
): Promise<T> {
  const requestId = newRequestId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  // Honour an outer signal (e.g. React Query cancellation) alongside our timeout.
  const onOuterAbort = () => controller.abort();
  options.signal?.addEventListener('abort', onOuterAbort);

  try {
    const response = await fetch(buildUrl(path, options.query), {
      method,
      headers: {
        'Content-Type': 'application/json',
        [REQUEST_ID_HEADER]: requestId,
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) throw await toApiError(response, requestId);

    // 204 No Content has no body to parse.
    if (response.status === 204) return undefined as T;

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError({
        status: response.status,
        code: 'PARSE_ERROR',
        message: 'Response was not valid JSON',
        requestId,
      });
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;

    const aborted =
      (error instanceof DOMException && error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError');

    throw new ApiError({
      status: 0,
      code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      message: aborted ? `Request timed out after ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms` : (error as Error)?.message,
      requestId,
    });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onOuterAbort);
  }
}

export function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('GET', path, options);
}

export function apiPost<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>('POST', path, { ...options, body });
}

export function apiPatch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return request<T>('PATCH', path, { ...options, body });
}
