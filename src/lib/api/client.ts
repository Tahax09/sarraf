import { env } from "@/lib/env";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly details: unknown;

  constructor(
    message: string,
    status: number,
    code: string | null = null,
    details: unknown = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  params?: QueryParams;
  signal?: AbortSignal;
};

/**
 * Fixture mode lets the UI run end-to-end before the real endpoints are wired.
 * Set NEXT_PUBLIC_API_MODE=fixtures locally; anything else hits the real API.
 */
export const usingFixtures = process.env.NEXT_PUBLIC_API_MODE === "fixtures";

function buildUrl(path: string, params?: QueryParams): string {
  const url = new URL(
    path.startsWith("/") ? path.slice(1) : path,
    env.apiBaseUrl.endsWith("/") ? env.apiBaseUrl : `${env.apiBaseUrl}/`,
  );
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/** Double-submit CSRF token; the backend sets this cookie alongside the session. */
function csrfHeader(): Record<string, string> {
  if (typeof document === "undefined") return {};
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return match ? { "X-XSRF-TOKEN": decodeURIComponent(match[1]) } : {};
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, params, signal } = options;

  if (usingFixtures) {
    const { fixtureFetch } = await import("./fixtures");
    return fixtureFetch<T>(path, { method, body, params });
  }

  const response = await fetch(buildUrl(path, params), {
    method,
    signal,
    // Auth travels in an httpOnly cookie; no token ever touches JS storage.
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(method === "GET" ? {} : csrfHeader()),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const parsed = payload as
      | { message?: string; code?: string; errors?: unknown }
      | null;
    throw new ApiError(
      parsed?.message ?? `Request failed with status ${response.status}`,
      response.status,
      parsed?.code ?? null,
      parsed?.errors ?? null,
    );
  }

  return payload as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
