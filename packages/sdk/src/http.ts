import {
  StructoAuthError,
  StructoHttpError,
  StructoNetworkError,
  StructoNotFoundError,
  StructoValidationError,
} from "./errors.js";

interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details: { field?: string; message: string }[];
  };
}

function isApiErrorEnvelope(body: unknown): body is ApiErrorEnvelope {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as ApiErrorEnvelope).error?.message === "string"
  );
}

export async function request<T>(
  baseUrl: string,
  token: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options?.headers ?? {}),
      },
    });
  } catch (cause) {
    throw new StructoNetworkError(
      `Network request to ${url} failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      cause,
    );
  }

  if (response.ok) {
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const message = isApiErrorEnvelope(body)
    ? body.error.message
    : `HTTP ${response.status}`;

  if (response.status === 401) {
    throw new StructoAuthError(message);
  }
  if (response.status === 404) {
    throw new StructoNotFoundError(message);
  }
  if (response.status === 422 || response.status === 400) {
    const details = isApiErrorEnvelope(body) ? body.error.details : [];
    throw new StructoValidationError(message, details);
  }
  throw new StructoHttpError(response.status, message, body);
}

export function buildQuery(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  if (entries.length === 0) return "";
  const qs = new URLSearchParams(
    entries.map(([k, v]) => [k, String(v)]),
  ).toString();
  return `?${qs}`;
}
