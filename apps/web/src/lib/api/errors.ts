/**
 * ONE ERROR SHAPE for every failure that crosses the data boundary.
 *
 * Before this, `lib/api.ts` threw `new ApiError(status, "API error: Not Found")`
 * — a status code with a string bolted on. Callers could not distinguish
 * "no such event" from "the database is down", so every failure had to be
 * treated as fatal and the UI had no basis for an empty state versus an error
 * state.
 *
 * Now every failure is an `ApiError` with a stable machine-readable `code`.
 * The UI switches on `code`, not on message text.
 */

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  /** The live backend has no endpoint for this yet. See docs/api/API_CONTRACT.md. */
  | 'NOT_IMPLEMENTED'
  | 'UNKNOWN';

const BY_STATUS: Record<number, ApiErrorCode> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  500: 'INTERNAL',
  503: 'SERVICE_UNAVAILABLE',
};

export function codeFromStatus(status: number): ApiErrorCode {
  const exact = BY_STATUS[status];
  if (exact) return exact;
  if (status >= 500) return 'INTERNAL';
  if (status >= 400) return 'BAD_REQUEST';
  return 'UNKNOWN';
}

/**
 * Text that is safe to render to a user.
 *
 * Deliberately generic for 5xx. A stack trace, a SQL fragment or an internal
 * hostname must never reach the browser — that is information disclosure, and
 * it is also useless to the person reading it.
 */
const USER_MESSAGES: Record<ApiErrorCode, string> = {
  BAD_REQUEST: 'The request was rejected. Check the filters and try again.',
  UNAUTHORIZED: 'You need to sign in to view this.',
  FORBIDDEN: 'You do not have access to this.',
  NOT_FOUND: 'That record could not be found.',
  CONFLICT: 'That change conflicts with the current state.',
  UNPROCESSABLE: 'Some of the submitted values are not valid.',
  RATE_LIMITED: 'Too many requests. Please slow down and retry.',
  INTERNAL: 'Something went wrong on our side.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable.',
  TIMEOUT: 'The request took too long.',
  NETWORK_ERROR: 'Could not reach the server.',
  PARSE_ERROR: 'The server returned a response we could not read.',
  NOT_IMPLEMENTED: 'This view is not served by the live backend yet. Run in demo mode, or build the endpoint listed in the API contract.',
  UNKNOWN: 'An unexpected error occurred.',
};

export interface ApiErrorInit {
  status: number;
  code?: ApiErrorCode;
  /** Developer-facing detail. Logged, never rendered. */
  message?: string;
  requestId?: string;
  details?: unknown;
}

export class ApiError extends Error {
  /** 0 means the request never completed (network/timeout). */
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(init: ApiErrorInit) {
    super(init.message ?? init.code ?? 'API error');
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code ?? codeFromStatus(init.status);
    this.requestId = init.requestId;
    this.details = init.details;
  }

  /** Safe to show a user. */
  get userMessage(): string {
    return USER_MESSAGES[this.code];
  }

  /** `true` when this is worth retrying. */
  get retryable(): boolean {
    return this.code === 'TIMEOUT' || this.code === 'NETWORK_ERROR' || this.code === 'SERVICE_UNAVAILABLE' || this.status >= 500;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Normalise the error bodies a FastAPI service can produce into one shape.
 *
 * Handles all three we will actually see:
 *   1. Our envelope  → { success: false, error: { code, message } }
 *   2. HTTPException → { detail: "Event not found" }
 *   3. Validation    → { detail: [ { loc, msg, type } ] }
 */
export function parseErrorPayload(payload: unknown): {
  code?: ApiErrorCode;
  message?: string;
  details?: unknown;
} {
  if (!payload || typeof payload !== 'object') return {};

  const body = payload as Record<string, unknown>;

  // 1. Our own envelope.
  const error = body.error;
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    return {
      code: typeof e.code === 'string' ? (e.code as ApiErrorCode) : undefined,
      message: typeof e.message === 'string' ? e.message : undefined,
      details: e.details,
    };
  }

  // 2/3. FastAPI default.
  const detail = body.detail;
  if (typeof detail === 'string') return { message: detail };
  if (Array.isArray(detail)) {
    const first = detail[0] as Record<string, unknown> | undefined;
    const field = Array.isArray(first?.loc) ? (first?.loc as unknown[]).slice(1).join('.') : undefined;
    const msg = typeof first?.msg === 'string' ? first.msg : 'Validation failed';
    return { message: field ? `${field}: ${msg}` : msg, details: detail };
  }

  return {};
}
