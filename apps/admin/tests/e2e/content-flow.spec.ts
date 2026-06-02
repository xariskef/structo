/**
 * Phase 9.0 — End-to-end content flow + published-snapshot regression
 *
 * Proves that:
 *  1. A published entry is reachable via the Delivery API.
 *  2. Editing the draft after publish does NOT change the live Delivery API
 *     response until the editor explicitly republishes.
 *  3. After republishing, the Delivery API returns the new content.
 *  4. Unpublishing removes the entry from the Delivery API.
 *
 * The test creates real DB rows through the admin UI and queries the live
 * Delivery API, so it requires both servers to be running.
 */

import { expect, test } from "./fixtures";

const DELIVERY_BASE = "http://localhost:3101/api/v1/delivery";
const API_BASE = "http://localhost:3101/api/v1";
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const flowFields = [
  {
    id: "content",
    type: "richText",
    key: "content",
    label: "Content",
    required: true,
    config: {},
  },
  {
    id: "subtitle",
    type: "text",
    key: "subtitle",
    label: "Subtitle",
    required: true,
    config: {},
  },
  {
    id: "hero",
    type: "media",
    key: "hero",
    label: "Hero image",
    required: true,
    config: {},
  },
  {
    id: "gallery",
    type: "gallery",
    key: "gallery",
    label: "Gallery",
    required: true,
    config: {},
  },
  {
    id: "details",
    type: "group",
    key: "details",
    label: "Details",
    required: true,
    config: {
      fields: [
        {
          id: "summary",
          type: "text",
          key: "summary",
          label: "Summary",
          required: true,
          config: {},
        },
      ],
    },
  },
  {
    id: "blocks",
    type: "repeater",
    key: "blocks",
    label: "Blocks",
    required: true,
    config: {
      fields: [
        {
          id: "heading",
          type: "text",
          key: "heading",
          label: "Heading",
          required: true,
          config: {},
        },
      ],
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createSiteWithArticles(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "New site" }).first().click();
  await page.getByLabel("Site name").fill("Flow Test Site");
  const slug = `flow-site-${Date.now()}`;
  await page.getByLabel(/Site slug/).fill(slug);
  await page.getByRole("button", { name: "Create site" }).click();
  await page.getByRole("link", { name: /Open site/ }).click();
  await page.waitForURL(/\/dashboard\/sites\//);
  const siteId = page.url().split("/sites/")[1]!.split("/")[0]!;
  return { slug, siteId };
}

async function createAndActivateArticles(
  page: import("@playwright/test").Page,
  siteId: string,
) {
  await page.getByRole("link", { name: "Collections", exact: true }).click();
  await page.getByRole("button", { name: "New collection" }).first().click();
  await page.getByLabel(/Name \(plural\)/).fill("Articles");
  await page.getByLabel(/Name \(singular\)/).fill("Article");
  await page.getByLabel(/Slug/).fill("articles");
  await page.getByRole("button", { name: "Create and configure" }).click();
  await page.waitForURL(/\/collections\/[^/]+/);
  const contentTypeId = page.url().split("/collections/")[1]!.split("/")[0]!;
  const structure = await page.request.patch(
    `${API_BASE}/manage/sites/${siteId}/content-types/${contentTypeId}`,
    { data: { fields: flowFields } },
  );
  expect(structure.ok()).toBeTruthy();
  await page.reload();

  await page.getByRole("tab", { name: "Structure" }).click();
  await page.getByRole("button", { name: "Activate" }).click();
  await expect(page.getByText("Published structure: v1")).toBeVisible({
    timeout: 15_000,
  });
  return contentTypeId;
}

async function uploadImage(
  page: import("@playwright/test").Page,
  siteId: string,
  filename: string,
) {
  const response = await page.request.post(
    `${API_BASE}/manage/sites/${siteId}/media`,
    {
      multipart: {
        file: {
          name: filename,
          mimeType: "image/png",
          buffer: PNG_1X1,
        },
      },
    },
  );
  expect(response.ok()).toBeTruthy();
  return response.json();
}

async function saveDraft(
  page: import("@playwright/test").Page,
  entryId: string,
) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url().includes(`/entries/${entryId}`) &&
        candidate.request().method() === "PATCH",
    ),
    page.getByRole("button", { name: "Save draft" }).click(),
  ]);
  expect(response.ok()).toBeTruthy();
}

async function issueSiteToken(page: import("@playwright/test").Page) {
  await page.getByRole("link", { name: "API tokens", exact: true }).click();
  await page.getByLabel("Name").fill("Flow test token");
  await page.getByRole("button", { name: "Create token" }).click();
  const token = await page.getByLabel("New API token").inputValue();
  const deliveryBaseUrl = await page.locator("code").innerText();
  const siteKey = deliveryBaseUrl.split("/sites/")[1]!;
  return { token, siteKey };
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

test("published snapshots: draft edits do not alter live delivery until republished", async ({
  page,
  request,
  orgId,
}) => {
  test.setTimeout(120_000);
  void orgId;

  // ── 1. Create site + collection ──────────────────────────────────────
  const { siteId } = await createSiteWithArticles(page);
  await createAndActivateArticles(page, siteId);
  await uploadImage(page, siteId, "flow-hero.png");
  await uploadImage(page, siteId, "flow-gallery.png");

  // ── 2. Create entry + publish ────────────────────────────────────────
  await page.getByRole("tab", { name: "Content" }).click();
  await page.getByRole("button", { name: "New Article" }).first().click();
  await page.getByLabel("Title").fill("Original title");
  await page.getByLabel(/Slug/).fill("snapshot-test");
  await page.getByRole("button", { name: "Create Article" }).click();
  await page.waitForURL(/\/items\/.+/);
  const entryId = page.url().split("/items/")[1]!.split("/")[0]!;

  await page.getByLabel("Subtitle").fill("Original subtitle");
  const editor = page.locator(".tiptap").first();
  await expect(editor).toBeVisible();
  await editor.fill("Original body");
  await page.getByLabel("Summary").fill("Original summary");
  await page.getByRole("button", { name: "Add row" }).click();
  await page.getByRole("textbox", { name: "Heading *" }).fill("Original block");
  await saveDraft(page, entryId);
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });
  let draftResponse = await page.request.get(
    `${API_BASE}/manage/sites/${siteId}/entries/${entryId}`,
  );
  expect(draftResponse.ok()).toBeTruthy();
  let savedDraft = await draftResponse.json();
  expect(savedDraft.data.subtitle).toBe("Original subtitle");
  expect(savedDraft.data.details.summary).toBe("Original summary");
  expect(savedDraft.data.blocks[0].heading).toBe("Original block");

  await page.getByRole("button", { name: "Choose file" }).click();
  await page.getByRole("button").filter({ hasText: "flow-hero.png" }).click();
  await saveDraft(page, entryId);
  draftResponse = await page.request.get(
    `${API_BASE}/manage/sites/${siteId}/entries/${entryId}`,
  );
  expect(draftResponse.ok()).toBeTruthy();
  savedDraft = await draftResponse.json();
  expect(savedDraft.data.hero).toBeTruthy();

  await page.getByRole("button", { name: "Choose media" }).click();
  await page.getByRole("button").filter({ hasText: "flow-hero.png" }).click();
  await page
    .getByRole("button")
    .filter({ hasText: "flow-gallery.png" })
    .click();

  await saveDraft(page, entryId);
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });
  draftResponse = await page.request.get(
    `${API_BASE}/manage/sites/${siteId}/entries/${entryId}`,
  );
  expect(draftResponse.ok()).toBeTruthy();
  savedDraft = await draftResponse.json();
  expect(savedDraft.data.subtitle).toBe("Original subtitle");
  expect(savedDraft.data.details.summary).toBe("Original summary");
  expect(savedDraft.data.blocks[0].heading).toBe("Original block");
  expect(savedDraft.data.hero).toBeTruthy();
  expect(savedDraft.data.gallery).toHaveLength(2);

  const firstPublish = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(`/manage/sites/${siteId}/entries/${entryId}/publish`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Publish now" }).click();
  expect((await firstPublish).ok()).toBeTruthy();
  await expect(page.getByText("Published version v1")).toBeVisible({
    timeout: 15_000,
  });

  // ── 3. Issue API token ───────────────────────────────────────────────
  const { token, siteKey } = await issueSiteToken(page);
  const entriesUrl = `${DELIVERY_BASE}/sites/${siteKey}/content-types/articles/entries`;
  const entryUrl = `${DELIVERY_BASE}/sites/${siteKey}/content-types/articles/entries/snapshot-test`;

  // ── 4. Delivery API must return published content ────────────────────
  const res1 = await request.get(entriesUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res1.ok()).toBeTruthy();
  const list1 = await res1.json();
  expect(list1.data).toHaveLength(1);
  expect(list1.data[0].title).toBe("Original title");
  expect(list1.data[0].slug).toBe("snapshot-test");
  expect(list1.data[0].data.subtitle).toBe("Original subtitle");
  expect(list1.data[0].data.content).toContain("Original body");
  expect(list1.data[0].data.details.summary).toBe("Original summary");
  expect(list1.data[0].data.blocks[0].heading).toBe("Original block");
  expect(list1.data[0].data.hero.filename).toBe("flow-hero.png");
  expect(
    list1.data[0].data.gallery.map(
      (asset: { filename: string }) => asset.filename,
    ),
  ).toEqual(["flow-hero.png", "flow-gallery.png"]);

  const single1 = await request.get(entryUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(single1.ok()).toBeTruthy();
  const entry1 = await single1.json();
  expect(entry1.title).toBe("Original title");

  // ── 5. Edit the draft (do NOT republish) ────────────────────────────
  // Navigate back to the entry and change the title.
  await page.getByRole("link", { name: "Collections", exact: true }).click();
  await page.getByRole("link", { name: "Articles" }).click();
  await page.getByRole("tab", { name: "Content" }).click();
  await page.getByRole("link", { name: "Original title" }).click();
  await page.waitForURL(/\/items\/.+/);

  await page
    .getByRole("textbox", { name: "Title", exact: true })
    .fill("Draft-only title");
  await page
    .getByRole("textbox", { name: "Subtitle *", exact: true })
    .fill("Draft-only subtitle");
  // Entry is PUBLISHED — the button reads "Save changes", not "Save draft".
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });

  // ── 6. REGRESSION: Delivery API must still return the OLD snapshot ───
  const res2 = await request.get(entriesUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res2.ok()).toBeTruthy();
  const list2 = await res2.json();
  expect(
    list2.data[0].title,
    "Draft edit must NOT change live Delivery API response",
  ).toBe("Original title");
  expect(list2.data[0].data.subtitle).toBe("Original subtitle");

  const single2 = await request.get(entryUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(single2.ok()).toBeTruthy();
  const entry2 = await single2.json();
  expect(entry2.title, "Single-entry endpoint must still return snapshot").toBe(
    "Original title",
  );

  // ── 7. Republish → Delivery API should now return new content ────────
  const republish = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(`/manage/sites/${siteId}/entries/${entryId}/publish`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Republish now" }).click();
  expect((await republish).ok()).toBeTruthy();
  await expect(page.getByText("Published version v2")).toBeVisible({
    timeout: 15_000,
  });

  const res3 = await request.get(entriesUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res3.ok()).toBeTruthy();
  const list3 = await res3.json();
  expect(
    list3.data[0].title,
    "After republish, Delivery API must return new title",
  ).toBe("Draft-only title");
  expect(list3.data[0].data.subtitle).toBe("Draft-only subtitle");

  // ── 8. Unpublish → entry disappears from Delivery API ────────────────
  const unpublish = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(`/manage/sites/${siteId}/entries/${entryId}/unpublish`) &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /Unpublish/ }).click();
  expect((await unpublish).ok()).toBeTruthy();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible({
    timeout: 10_000,
  });

  const res4 = await request.get(entriesUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res4.ok()).toBeTruthy();
  const list4 = await res4.json();
  expect(
    list4.data,
    "Unpublished entry must not appear in Delivery API",
  ).toHaveLength(0);

  const single4 = await request.get(entryUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(
    single4.status(),
    "Single-entry endpoint must return 404 after unpublish",
  ).toBe(404);
});
