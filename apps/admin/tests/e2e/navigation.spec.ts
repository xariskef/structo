import { expect, test } from "./fixtures";

async function createAndOpenSite(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "New site" }).first().click();
  await page.getByLabel("Site name").fill("Menu Test Site");
  await page.getByLabel(/Site slug/).fill(`menu-site-${Date.now()}`);
  await page.getByRole("button", { name: "Create site" }).click();
  await page.getByRole("link", { name: /Open site/ }).click();
  await page.waitForURL(/\/dashboard\/sites\//);
}

test.describe("Navigation menus", () => {
  test.beforeEach(async ({ page, orgId }) => {
    void orgId;
    await createAndOpenSite(page);
    await page.getByRole("link", { name: "Menus", exact: true }).click();
    await page.waitForURL(/\/navigation$/);
    await expect(page.getByRole("heading", { name: "Menus" })).toBeVisible();
  });

  test("seeds a default menu and persists custom items with nesting", async ({
    page,
  }) => {
    // A default "Main menu" is seeded on first open.
    await expect(page.getByRole("button", { name: /Main menu/ })).toBeVisible();

    // Add two custom links.
    await page.getByLabel("Type").selectOption("custom");
    await page.getByLabel("Label").fill("Docs");
    await page.getByLabel("URL").fill("/docs");
    await page.getByRole("button", { name: "Add to menu" }).click();

    await page.getByLabel("Label").fill("Guides");
    await page.getByLabel("URL").fill("/docs/guides");
    await page.getByRole("button", { name: "Add to menu" }).click();

    await expect(
      page.getByText("Custom URL · /docs", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Custom URL · /docs/guides", { exact: true }),
    ).toBeVisible();

    // Nest "Guides" under "Docs" via the indent control.
    await page.getByRole("button", { name: "Indent" }).nth(1).click();

    await page.getByRole("button", { name: "Save menu" }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    // Reload: both items persist.
    await page.reload();
    await expect(
      page.getByText("Custom URL · /docs", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Custom URL · /docs/guides", { exact: true }),
    ).toBeVisible();
  });

  test("creates a second named menu", async ({ page }) => {
    await page.getByRole("button", { name: "New menu" }).click();
    await page.getByLabel("Name").fill("Footer");
    await page.getByRole("button", { name: "Create menu" }).click();
    await expect(page.getByRole("button", { name: /Footer/ })).toBeVisible();
  });
});
