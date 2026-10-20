/**
 * Uniform error shape.
 *
 * Every failure that reaches a client is `{ success: false, error: { code,
 * message } }`. The shape is the same in a route handler, a Server Action and
 * a service, so a client never has to guess.
 *
 * PURE: no I/O, no clock, no environment.
 */

export type ErrorCode =
  | "NOT_FOUND"
  | "INVALID_TOKEN"
  | "TOKEN_EXPIRED"
  | "TOKEN_ALREADY_USED"
  | "INVALID_STATE"
  | "ILLEGAL_TRANSITION"
  | "CONCURRENT_TRANSITION"
  | "VALIDATION_FAILED"
  | "MEDIA_TOO_LARGE"
  | "MEDIA_INVALID_TYPE"
  | "PROVIDER_UNAVAILABLE"
  | "PAYOUT_FAILED"
  | "UNAUTHORIZED"
  | "INTERNAL";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  NOT_FOUND: 404,
  INVALID_TOKEN: 403,
  TOKEN_EXPIRED: 410,
  TOKEN_ALREADY_USED: 409,
  INVALID_STATE: 409,
  ILLEGAL_TRANSITION: 409,
  CONCURRENT_TRANSITION: 409,
  VALIDATION_FAILED: 400,
  MEDIA_TOO_LARGE: 413,
  MEDIA_INVALID_TYPE: 415,
  PROVIDER_UNAVAILABLE: 503,
  PAYOUT_FAILED: 502,
  UNAUTHORIZED: 401,
  INTERNAL: 500,
};

export interface AppErrorBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
  };
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status ?? STATUS_BY_CODE[code];
  }

  toBody(): AppErrorBody {
    return { success: false, error: { code: this.code, message: this.message } };
  }

  static is(value: unknown): value is AppError {
    return value instanceof AppError;
  }
}

export function toErrorBody(error: unknown): AppErrorBody {
  if (AppError.is(error)) return error.toBody();
  // Never leak an internal message to a client. The detail goes to the log.
  return {
    success: false,
    error: { code: "INTERNAL", message: "Something went wrong. Please try again." },
  };
}

export function statusOf(error: unknown): number {
  if (AppError.is(error)) return error.status;
  return 500;
}
