/**
 * Base class for all errors thrown by StructoClient.
 * Provides a consistent `.code` discriminant for switch/catch handling.
 */
export class StructoError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "StructoError";
    this.code = code;
    // Maintain proper prototype chain in transpiled environments
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a network request fails before the server responds
 * (e.g. DNS failure, connection refused, timeout).
 */
export class StructoNetworkError extends StructoError {
  override readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message, "NETWORK_ERROR");
    this.name = "StructoNetworkError";
    this.cause = cause;
  }
}

/**
 * Thrown for HTTP 401 responses — the API token is missing, expired, or revoked.
 */
export class StructoAuthError extends StructoError {
  constructor(message = "Unauthorized. Check your API token.") {
    super(message, "AUTH_ERROR");
    this.name = "StructoAuthError";
  }
}

/**
 * Thrown for HTTP 422 / 400 responses where the server returns structured
 * validation error details.
 */
export class StructoValidationError extends StructoError {
  readonly details: { field?: string; message: string }[];

  constructor(
    message: string,
    details: { field?: string; message: string }[],
  ) {
    super(message, "VALIDATION_ERROR");
    this.name = "StructoValidationError";
    this.details = details;
  }
}

/**
 * Thrown for HTTP 404 responses.
 */
export class StructoNotFoundError extends StructoError {
  constructor(message = "Not found.") {
    super(message, "NOT_FOUND");
    this.name = "StructoNotFoundError";
  }
}

/**
 * Thrown for any other non-2xx HTTP response not covered by a more specific
 * error class above.
 */
export class StructoHttpError extends StructoError {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message, "HTTP_ERROR");
    this.name = "StructoHttpError";
    this.status = status;
    this.body = body;
  }
}
