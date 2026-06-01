import { expect, test } from "./fixtures";

async function createAndOpenSite(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "New site" }).first().click();
  await page.getByLabel("Site name").fill("Taxonomy Test Site");
  await page.getByLabel(/Site slug/).fill(`taxonomy-site-${Date.now()}`);
  await page.getByRole("button", { name: "Create site" }).click();
  await page.getByRole("link", { name: /Open site/ }).click();
  await page.waitForURL(/\/dashboard\/sites\//);
}

test.describe("Taxonomies", () => {
  test.beforeEach(async ({ page, orgId }) => {
    void orgId;
    await createAndOpenSite(page);
  });

  test("creates hierarchical categories", async ({ page }) => {
    await page
      .getByRole("link", { name: "Page categories", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Page categories" }),
    ).toBeVisible();

    await page.getByRole("tab", { name: "Fields" }).click();
    await page.getByRole("button", { name: "Add field" }).first().click();
    await page.getByRole("button", { name: /Short plain text/ }).click();
    await page.getByRole("button", { name: "Save fields" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
    await page.getByRole("tab", { name: "Terms" }).click();
    // The added "Text" field (its picker description is "Short plain text")
    // renders in the term form under its field label.
    await expect(page.getByLabel("Text", { exact: true })).toBeVisible();

    await page.getByLabel("Name", { exact: true }).fill("News");
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(
      page.getByRole("cell", { name: "News", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("");

    await page.getByLabel("Name", { exact: true }).fill("Tutorials");
    await page.getByLabel("Parent category").selectOption({ label: "News" });
    await page.getByRole("button", { name: "Add category" }).click();
    await expect(page.getByText("Parent: News")).toBeVisible();
  });

  test("creates tags", async ({ page }) => {
    await page.getByRole("link", { name: "Page tags", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Page tags" }),
    ).toBeVisible();

    await page.getByLabel("Name", { exact: true }).fill("Featured");
    await page.getByRole("button", { name: "Add tag" }).click();
    await expect(
      page.getByRole("cell", { name: "Featured", exact: true }),
    ).toBeVisible();
  });
});
