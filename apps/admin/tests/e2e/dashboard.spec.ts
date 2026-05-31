import { expect, test } from "./fixtures";

test.describe("Organization dashboard", () => {
  test("registration creates org and redirects to dashboard", async ({
    page,
    orgId,
  }) => {
    expect(orgId).toBeTruthy();
    await expect(page).toHaveURL(`/dashboard/organizations/${orgId}`);
    await expect(page.getByRole("heading", { name: "E2E Org" })).toBeVisible();
  });

  test("org sidebar shows correct navigation", async ({ page, orgId }) => {
    void orgId;
    await expect(page.locator("aside")).toContainText("E2E Org");
    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Members" })).toBeVisible();
  });

  test("can create a site", async ({ page, orgId }) => {
    void orgId;
    await page.getByRole("button", { name: "New site" }).first().click();
    await page.getByLabel("Site name").fill("My Test Site");
    await page.getByLabel(/Site slug/).fill("my-test-site");
    await page.getByRole("button", { name: "Create site" }).click();

    await expect(page.getByText("My Test Site")).toBeVisible();
    await expect(page.getByText("my-test-site")).toBeVisible();
    await expect(page.getByText("ACTIVE")).toBeVisible();
  });
});

test.describe("Site dashboard", () => {
  test.beforeEach(async ({ page, orgId }) => {
    void orgId;
    await page.getByRole("button", { name: "New site" }).first().click();
    await page.getByLabel("Site name").fill("Dashboard Test Site");
    await page.getByLabel(/Site slug/).fill(`dashboard-site-${Date.now()}`);
    await page.getByRole("button", { name: "Create site" }).click();
    await page.getByRole("link", { name: /Open site/ }).click();

    await page.waitForURL(/\/dashboard\/sites\//);
  });

  test("site sidebar has all required navigation sections", async ({
    page,
  }) => {
    const sidebar = page.locator("aside");
    await expect(sidebar).toContainText("Content");
    await expect(sidebar).toContainText("Administration");
    await expect(
      page.getByRole("link", { name: "Collections" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Pages" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Media" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Members" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  });

  test("back to org link appears in site sidebar", async ({ page }) => {
    await expect(page.getByRole("link", { name: "E2E Org" })).toBeVisible();
  });

  test("settings page loads and saves", async ({ page }) => {
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(
      page.getByRole("heading", { name: "Site settings" }),
    ).toBeVisible();
    await page.getByLabel("Public base URL").fill("https://example.com");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
  });

  test("collections page loads with empty state", async ({ page }) => {
    await page.getByRole("link", { name: "Collections" }).click();
    await expect(
      page.getByRole("heading", { name: "Collections" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New collection" }).first(),
    ).toBeVisible();
  });

  test("pages page loads with empty state", async ({ page }) => {
    await page.getByRole("link", { name: "Pages" }).click();
    await expect(
      page.getByRole("heading", { name: "Pages" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New page" }).first(),
    ).toBeVisible();
  });
});
