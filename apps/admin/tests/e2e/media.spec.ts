import { expect, test } from "./fixtures";

async function createAndOpenSite(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "New site" }).first().click();
  await page.getByLabel("Site name").fill("Media Test Site");
  await page.getByLabel(/Site slug/).fill(`media-site-${Date.now()}`);
  await page.getByRole("button", { name: "Create site" }).click();
  await page.getByRole("link", { name: /Open site/ }).click();
  await page.waitForURL(/\/dashboard\/sites\//);
}

test.describe("Media", () => {
  test("opens an empty site media library", async ({ page, orgId }) => {
    void orgId;
    await createAndOpenSite(page);
    await page.getByRole("link", { name: "Media", exact: true }).click();
    await page.waitForURL(/\/media$/);

    await expect(page.getByRole("heading", { name: "Media" })).toBeVisible();
    await expect(page.getByText("No media yet")).toBeVisible();
    await expect(page.getByText("Upload file", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Image or PDF")).toBeVisible();
  });
});
