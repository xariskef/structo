import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

import {
  StructoAuthError,
  StructoClient,
  StructoError,
  StructoHttpError,
  StructoNetworkError,
  StructoNotFoundError,
  StructoValidationError,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetch(
  status: number,
  body: unknown,
  ok = status >= 200 && status < 300,
) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  } satisfies Partial<Response>);
}

function makeClient(fetchImpl: typeof globalThis.fetch, previewToken?: string) {
  vi.stubGlobal("fetch", fetchImpl);
  return new StructoClient({
    baseUrl: "http://localhost:3101/api/v1",
    siteKey: "test-site",
    token: "stk_test",
    previewToken,
  });
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

describe("StructoError hierarchy", () => {
  it("StructoError is instanceof Error", () => {
    const e = new StructoError("oops", "TEST");
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("TEST");
  });

  it("StructoNetworkError carries the cause", () => {
    const cause = new Error("socket hang up");
    const e = new StructoNetworkError("Network failed", cause);
    expect(e.cause).toBe(cause);
    expect(e.code).toBe("NETWORK_ERROR");
  });

  it("StructoAuthError has AUTH_ERROR code", () => {
    const e = new StructoAuthError();
    expect(e.code).toBe("AUTH_ERROR");
    expect(e).toBeInstanceOf(StructoError);
  });

  it("StructoValidationError preserves details array", () => {
    const e = new StructoValidationError("Bad request", [
      { field: "title", message: "Required" },
    ]);
    expect(e.details).toHaveLength(1);
    expect(e.details[0]?.field).toBe("title");
    expect(e.code).toBe("VALIDATION_ERROR");
  });

  it("StructoNotFoundError has NOT_FOUND code", () => {
    expect(new StructoNotFoundError().code).toBe("NOT_FOUND");
  });

  it("StructoHttpError carries status and body", () => {
    const e = new StructoHttpError(503, "Service unavailable", { raw: true });
    expect(e.status).toBe(503);
    expect(e.body).toEqual({ raw: true });
    expect(e.code).toBe("HTTP_ERROR");
  });
});

// ---------------------------------------------------------------------------
// StructoClient — happy paths
// ---------------------------------------------------------------------------

describe("StructoClient happy paths", () => {
  it("getSettings calls correct URL and returns body", async () => {
    const body = { name: "My Blog", slug: "my-blog" };
    const fetch = makeFetch(200, body);
    const client = makeClient(fetch);
    const result = await client.getSettings();
    expect(result).toEqual(body);
    const url = (fetch.mock.calls[0]?.[0] as string) ?? "";
    expect(url).toContain("/delivery/sites/test-site/settings");
  });

  it("listContentTypes resolves to array", async () => {
    const fetch = makeFetch(200, [{ kind: "COLLECTION", slug: "articles" }]);
    const client = makeClient(fetch);
    await expect(client.listContentTypes()).resolves.toHaveLength(1);
  });

  it("getContentType calls correct URL", async () => {
    const fetch = makeFetch(200, { slug: "articles" });
    const client = makeClient(fetch);
    await client.getContentType("articles");
    const url = (fetch.mock.calls[0]?.[0] as string) ?? "";
    expect(url).toContain("/content-types/articles");
  });

  it("listEntries appends query params", async () => {
    const fetch = makeFetch(200, { data: [], meta: {} });
    const client = makeClient(fetch);
    await client.listEntries("articles", {
      page: 2,
      pageSize: 10,
      sort: "title:asc",
      category: "news",
    });
    const url = (fetch.mock.calls[0]?.[0] as string) ?? "";
    expect(url).toContain("page=2");
    expect(url).toContain("pageSize=10");
    expect(url).toContain("sort=title%3Aasc");
    expect(url).toContain("category=news");
  });

  it("getEntry calls correct URL", async () => {
    const fetch = makeFetch(200, { slug: "hello-world" });
    const client = makeClient(fetch);
    await client.getEntry("articles", "hello-world");
    const url = (fetch.mock.calls[0]?.[0] as string) ?? "";
    expect(url).toContain("/entries/hello-world");
  });

  it("listMenus calls navigation-menus endpoint", async () => {
    const fetch = makeFetch(200, []);
    const client = makeClient(fetch);
    await client.listMenus();
    const url = (fetch.mock.calls[0]?.[0] as string) ?? "";
    expect(url).toContain("/navigation-menus");
  });

  it("getMenu calls correct URL", async () => {
    const fetch = makeFetch(200, { key: "main" });
    const client = makeClient(fetch);
    await client.getMenu("main");
    const url = (fetch.mock.calls[0]?.[0] as string) ?? "";
    expect(url).toContain("/navigation-menus/main");
  });

  it("getEntryDraft uses /preview/entries path with bearer token", async () => {
    const fetch = makeFetch(200, { title: "Draft" });
    const client = makeClient(fetch, "stp_secret");
    await client.getEntryDraft("entry-42");
    const url = (fetch.mock.calls[0]?.[0] as string) ?? "";
    expect(url).toContain("/preview/entries/entry-42");
    expect(url).not.toContain("preview=");
    const init = fetch.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer stp_secret",
    );
  });

  it("getPreviewSession validates the configured bearer token", async () => {
    const fetch = makeFetch(200, { siteKey: "test-site", entryId: null });
    const client = makeClient(fetch, "stp_secret");
    await client.getPreviewSession();
    const url = (fetch.mock.calls[0]?.[0] as string) ?? "";
    expect(url).toContain("/preview/session");
    const init = fetch.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer stp_secret",
    );
  });

  it("encodes path segments", async () => {
    const fetch = makeFetch(200, {});
    const client = makeClient(fetch);
    await client.getEntry("articles/news", "hello world");
    const url = (fetch.mock.calls[0]?.[0] as string) ?? "";
    expect(url).toContain(
      "/content-types/articles%2Fnews/entries/hello%20world",
    );
  });

  it("sends Authorization header", async () => {
    const fetch = makeFetch(200, {});
    const client = makeClient(fetch);
    await client.getSettings();
    const init = fetch.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer stk_test",
    );
  });
});

// ---------------------------------------------------------------------------
// StructoClient — error handling
// ---------------------------------------------------------------------------

describe("StructoClient error handling", () => {
  it("throws StructoNetworkError when fetch rejects", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const client = makeClient(fetch as unknown as typeof globalThis.fetch);
    await expect(client.getSettings()).rejects.toBeInstanceOf(
      StructoNetworkError,
    );
  });

  it("throws StructoAuthError on 401", async () => {
    const fetch = makeFetch(
      401,
      { error: { message: "Unauthorized", code: "UNAUTHORIZED", details: [] } },
      false,
    );
    const client = makeClient(fetch);
    await expect(client.getSettings()).rejects.toBeInstanceOf(StructoAuthError);
  });

  it("throws StructoNotFoundError on 404", async () => {
    const fetch = makeFetch(
      404,
      { error: { message: "Not found", code: "NOT_FOUND", details: [] } },
      false,
    );
    const client = makeClient(fetch);
    await expect(client.getEntry("articles", "missing")).rejects.toBeInstanceOf(
      StructoNotFoundError,
    );
  });

  it("throws StructoValidationError on 422 with details", async () => {
    const fetch = makeFetch(
      422,
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          details: [{ field: "slug", message: "Invalid slug" }],
        },
      },
      false,
    );
    const client = makeClient(fetch);
    const error = await client.getSettings().catch((e) => e);
    expect(error).toBeInstanceOf(StructoValidationError);
    expect((error as StructoValidationError).details[0]?.field).toBe("slug");
  });

  it("throws StructoHttpError for generic non-2xx", async () => {
    const fetch = makeFetch(
      503,
      {
        error: {
          message: "Service unavailable",
          code: "SERVER_ERROR",
          details: [],
        },
      },
      false,
    );
    const client = makeClient(fetch);
    const error = await client.getSettings().catch((e) => e);
    expect(error).toBeInstanceOf(StructoHttpError);
    expect((error as StructoHttpError).status).toBe(503);
  });

  it("throws StructoAuthError synchronously when previewToken is missing", () => {
    vi.stubGlobal("fetch", vi.fn());
    const client = new StructoClient({
      baseUrl: "http://localhost",
      siteKey: "site",
      token: "stk_x",
    });
    expect(() => client.getEntryDraft("entry-1")).toThrow(StructoAuthError);
  });
});

// ---------------------------------------------------------------------------
// Package export smoke test
// ---------------------------------------------------------------------------

describe("Package exports", () => {
  it("exports StructoClient", () => {
    expect(StructoClient).toBeDefined();
  });

  it("exports all error classes", () => {
    expect(StructoError).toBeDefined();
    expect(StructoNetworkError).toBeDefined();
    expect(StructoAuthError).toBeDefined();
    expect(StructoValidationError).toBeDefined();
    expect(StructoNotFoundError).toBeDefined();
    expect(StructoHttpError).toBeDefined();
  });

  it("loads the built ESM export", async () => {
    const esm = await import("../dist/index.js");
    expect(esm.StructoClient).toBeDefined();
  });

  it("loads the built CJS export", () => {
    const require = createRequire(import.meta.url);
    const cjs = require("../dist/index.cjs") as {
      StructoClient?: typeof StructoClient;
    };
    expect(cjs.StructoClient).toBeDefined();
  });
});
