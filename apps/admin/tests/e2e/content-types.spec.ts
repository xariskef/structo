import { expect, test } from "./fixtures";

// Helper: from the org dashboard, create a site and open it.
async function createAndOpenSite(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "New site" }).first().click();
  await page.getByLabel("Site name").fill("CT Test Site");
  await page.getByLabel(/Site slug/).fill(`ct-site-${Date.now()}`);
  await page.getByRole("button", { name: "Create site" }).click();
  await page.getByRole("link", { name: /Open site/ }).click();
  await page.waitForURL(/\/dashboard\/sites\//);
}

test.describe("Collections", () => {
  test.beforeEach(async ({ page, orgId }) => {
    void orgId;
    await createAndOpenSite(page);
    await page.getByRole("link", { name: "Collections", exact: true }).click();
    await page.waitForURL(/\/collections$/);
  });

  test("shows empty state with create button", async ({ page }) => {
    await expect(page.getByText("No collections yet")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New collection" }).first(),
    ).toBeVisible();
  });

  test("creates a collection and opens it with Content + Structure tabs", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New collection" }).first().click();
    await page.getByLabel(/Name \(plural\)/).fill("Articles");
    await page.getByLabel(/Name \(singular\)/).fill("Article");
    await page.getByLabel(/Slug/).fill("articles");
    await page.getByRole("button", { name: "Create and configure" }).click();

    await page.waitForURL(/\/collections\/.+/);
    await expect(page.getByRole("heading", { name: "Articles" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Content" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Structure" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Categories" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Tags" })).toBeVisible();
  });

  test("builds a structure, activates, and creates an item", async ({
    page,
  }) => {
    // Create the collection
    await page.getByRole("button", { name: "New collection" }).first().click();
    await page.getByLabel(/Name \(plural\)/).fill("Products");
    await page.getByLabel(/Name \(singular\)/).fill("Product");
    await page.getByLabel(/Slug/).fill("products");
    await page.getByRole("button", { name: "Create and configure" }).click();
    await page.waitForURL(/\/collections\/.+/);

    // Structure tab → add a field → activate
    await page.getByRole("tab", { name: "Structure" }).click();
    await page.getByRole("button", { name: "Add field" }).first().click();
    await page.getByRole("button", { name: /Short plain text/ }).click();
    await expect(page.getByText("Fields (1)")).toBeVisible();
    await page.getByRole("button", { name: "Activate" }).click();
    await expect(page.getByText("Published structure: v1")).toBeVisible({
      timeout: 15_000,
    });

    // Content tab → create a new Product
    await page.getByRole("tab", { name: "Content" }).click();
    await page.getByRole("button", { name: "New Product" }).first().click();
    await page.getByLabel("Title").fill("First Product");
    await page.getByLabel(/Slug/).fill("first-product");
    await page.getByRole("button", { name: "Create Product" }).click();

    // Lands on the item editor
    await page.waitForURL(/\/items\/.+/);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "First Product",
    );
  });
});

test.describe("Pages", () => {
  test.beforeEach(async ({ page, orgId }) => {
    void orgId;
    await createAndOpenSite(page);
    await page.getByRole("link", { name: "Pages", exact: true }).click();
    await page.waitForURL(/\/pages$/);
  });

  test("shows empty state with create button", async ({ page }) => {
    await expect(page.getByText("No pages yet")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New page" }).first(),
    ).toBeVisible();
  });

  test("creates a page, activates structure, and edits single content", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New page" }).first().click();
    await page.getByLabel(/Name/).fill("About");
    await page.getByLabel(/Slug/).fill("about");
    await page.getByRole("button", { name: "Create and configure" }).click();
    await page.waitForURL(/\/pages\/.+/);

    await expect(page.getByRole("heading", { name: "About" })).toBeVisible();

    // Content tab prompts to activate first
    await expect(page.getByText(/Activate this page/)).toBeVisible();

    // Structure tab → add field → activate
    await page.getByRole("tab", { name: "Structure" }).click();
    await page.getByRole("button", { name: "Add field" }).first().click();
    await page.getByRole("button", { name: /Short plain text/ }).click();
    await page.getByRole("button", { name: "Activate" }).click();
    await expect(page.getByText("Published structure: v1")).toBeVisible({
      timeout: 15_000,
    });

    // Content tab now resolves the single item editor
    await page.getByRole("tab", { name: "Content" }).click();
    await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
  });
});
