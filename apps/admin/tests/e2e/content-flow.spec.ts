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
  return slug;
}

async function createAndActivateArticles(page: import("@playwright/test").Page) {
  await page.getByRole("link", { name: "Collections", exact: true }).click();
  await page.getByRole("button", { name: "New collection" }).first().click();
  await page.getByLabel(/Name \(plural\)/).fill("Articles");
  await page.getByLabel(/Name \(singular\)/).fill("Article");
  await page.getByLabel(/Slug/).fill("articles");
  await page.getByRole("button", { name: "Create and configure" }).click();

  await page.getByRole("tab", { name: "Structure" }).click();
  await page.getByRole("button", { name: "Activate" }).click();
  await expect(page.getByText("Published structure: v1")).toBeVisible({
    timeout: 15_000,
  });
}

async function issueSiteToken(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
) {
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

test(
  "published snapshots: draft edits do not alter live delivery until republished",
  async ({ page, request, orgId }) => {
    test.setTimeout(120_000);
    void orgId;

    // ── 1. Create site + collection ──────────────────────────────────────
    await createSiteWithArticles(page);
    await createAndActivateArticles(page);

    // ── 2. Create entry + publish ────────────────────────────────────────
    await page.getByRole("tab", { name: "Content" }).click();
    await page.getByRole("button", { name: "New Article" }).first().click();
    await page.getByLabel("Title").fill("Original title");
    await page.getByLabel(/Slug/).fill("snapshot-test");
    await page.getByRole("button", { name: "Create Article" }).click();
    await page.waitForURL(/\/items\/.+/);

    // Fill the rich-text body field if present.
    const editor = page.locator(".tiptap").first();
    if (await editor.isVisible()) {
      await editor.fill("Original body");
    }

    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText(/Published version v/)).toBeVisible({
      timeout: 15_000,
    });

    // ── 3. Issue API token ───────────────────────────────────────────────
    const { token, siteKey } = await issueSiteToken(page, request);
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

    const single1 = await request.get(entryUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(single1.ok()).toBeTruthy();
    const entry1 = await single1.json();
    expect(entry1.title).toBe("Original title");

    // ── 5. Edit the draft (do NOT republish) ────────────────────────────
    // Navigate back to the entry and change the title.
    await page.getByRole("link", { name: "Collections", exact: true }).click();
    await page.getByRole("tab", { name: "Content" }).click();
    await page.getByRole("link", { name: "Original title" }).click();
    await page.waitForURL(/\/items\/.+/);

    await page.getByLabel("Title").fill("Draft-only title");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText(/Draft saved/i)).toBeVisible({ timeout: 10_000 });

    // ── 6. REGRESSION: Delivery API must still return the OLD snapshot ───
    const res2 = await request.get(entriesUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res2.ok()).toBeTruthy();
    const list2 = await res2.json();
    expect(list2.data[0].title).toBe(
      "Original title",
      "Draft edit must NOT change live Delivery API response",
    );

    const single2 = await request.get(entryUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(single2.ok()).toBeTruthy();
    const entry2 = await single2.json();
    expect(entry2.title).toBe(
      "Original title",
      "Single-entry endpoint must still return snapshot",
    );

    // ── 7. Republish → Delivery API should now return new content ────────
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText(/Published version v/)).toBeVisible({
      timeout: 15_000,
    });

    const res3 = await request.get(entriesUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res3.ok()).toBeTruthy();
    const list3 = await res3.json();
    expect(list3.data[0].title).toBe(
      "Draft-only title",
      "After republish, Delivery API must return new title",
    );

    // ── 8. Unpublish → entry disappears from Delivery API ────────────────
    await page.getByRole("button", { name: /Unpublish/ }).click();
    await expect(page.getByText(/Draft/i)).toBeVisible({ timeout: 10_000 });

    const res4 = await request.get(entriesUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res4.ok()).toBeTruthy();
    const list4 = await res4.json();
    expect(list4.data).toHaveLength(
      0,
      "Unpublished entry must not appear in Delivery API",
    );

    const single4 = await request.get(entryUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(single4.status()).toBe(
      404,
      "Single-entry endpoint must return 404 after unpublish",
    );
  },
);
