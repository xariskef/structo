import assert from "node:assert/strict";
import test from "node:test";

import { NotFoundException } from "@nestjs/common";

import { PreviewTokenGuard } from "../dist/modules/preview-tokens/preview-token.guard.js";

function context(request) {
  return {
    switchToHttp() {
      return { getRequest: () => request };
    },
  };
}

test("preview guard requires a bearer token and resolves its session scope", async () => {
  const expiresAt = new Date(Date.now() + 60_000);
  const guard = new PreviewTokenGuard({
    resolve: async (token) => {
      assert.equal(token, "stp_secret");
      return {
        siteId: "site-1",
        siteKey: "my-site",
        entryId: "entry-1",
        expiresAt,
      };
    },
  });
  const request = {
    headers: { authorization: "Bearer stp_secret" },
    params: { entryId: "entry-1" },
  };

  assert.equal(await guard.canActivate(context(request)), true);
  assert.equal(request.previewSiteId, "site-1");
  assert.equal(request.previewSiteKey, "my-site");
  assert.equal(request.previewEntryId, "entry-1");
  assert.equal(request.previewExpiresAt, expiresAt);
});

test("preview guard ignores query-string credentials", async () => {
  const guard = new PreviewTokenGuard({ resolve: async () => assert.fail() });
  await assert.rejects(
    guard.canActivate(
      context({
        headers: {},
        params: { entryId: "entry-1" },
        query: { preview: "stp_leak" },
      }),
    ),
    NotFoundException,
  );
});

test("preview guard rejects an entry-scoped token for another entry", async () => {
  const guard = new PreviewTokenGuard({
    resolve: async () => ({
      siteId: "site-1",
      siteKey: "my-site",
      entryId: "entry-1",
      expiresAt: new Date(Date.now() + 60_000),
    }),
  });
  await assert.rejects(
    guard.canActivate(
      context({
        headers: { authorization: "Bearer stp_secret" },
        params: { entryId: "entry-2" },
      }),
    ),
    NotFoundException,
  );
});
