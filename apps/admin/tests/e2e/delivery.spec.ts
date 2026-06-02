import { expect, test } from "./fixtures";

const API_BASE_URL = "http://localhost:3101/api/v1";

async function createAndOpenSite(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "New site" }).first().click();
  await page.getByLabel("Site name").fill("Delivery Test Site");
  await page.getByLabel(/Site slug/).fill(`delivery-site-${Date.now()}`);
  await page.getByRole("button", { name: "Create site" }).click();
  await page.getByRole("link", { name: /Open site/ }).click();
  await page.waitForURL(/\/dashboard\/sites\//);
}

test("issues a site token and delivers published entries only", async ({
  page,
  request,
  orgId,
}) => {
  test.setTimeout(60_000);
  void orgId;
  await createAndOpenSite(page);
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

  await page.getByRole("tab", { name: "Content" }).click();
  await page.getByRole("button", { name: "New Article" }).first().click();
  await page.getByLabel("Title").fill("Delivered article");
  await page.getByLabel(/Slug/).fill("delivered-article");
  await page.getByRole("button", { name: "Create Article" }).click();
  await page.waitForURL(/\/items\/.+/);
  await page.locator(".tiptap").fill("Delivery body");
  await page.getByRole("button", { name: "Publish now" }).click();
  await expect(page.getByText(/Published version v/)).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("link", { name: "API tokens", exact: true }).click();
  await expect(page.getByRole("heading", { name: "API tokens" })).toBeVisible();
  await page.getByLabel("Name").fill("E2E frontend");
  await page.getByRole("button", { name: "Create token" }).click();

  const token = await page.getByLabel("New API token").inputValue();
  const deliveryBaseUrl = await page.locator("code").innerText();
  const entriesUrl = `${deliveryBaseUrl}/content-types/articles/entries`;
  const siteKey = deliveryBaseUrl.split("/sites/")[1]!;

  const delivered = await request.get(entriesUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(delivered.ok()).toBeTruthy();
  const payload = await delivered.json();
  expect(payload.data).toHaveLength(1);
  expect(payload.data[0].slug).toBe("delivered-article");

  expect((await request.get(entriesUrl)).status()).toBe(401);
  expect(
    (
      await request.get(entriesUrl, {
        headers: { Authorization: "Bearer stk_garbage" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.get(
        `${API_BASE_URL}/delivery/sites/site_wrong/content-types/articles/entries`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
    ).status(),
  ).toBe(404);
  expect(
    (
      await request.get(
        `${API_BASE_URL}/delivery/sites/${siteKey}/content-types/articles/entries`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
    ).ok(),
  ).toBeTruthy();
  expect(
    (await request.get(`${API_BASE_URL}/delivery/openapi.json`)).ok(),
  ).toBeTruthy();
  expect(
    (await request.get(`${API_BASE_URL}/delivery/docs`)).ok(),
  ).toBeTruthy();
});
