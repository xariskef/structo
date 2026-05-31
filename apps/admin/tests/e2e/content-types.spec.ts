import { expect, test } from "./fixtures";

test.describe("Content type builder", () => {
  test.beforeEach(async ({ page, orgId }) => {
    void orgId;
    // Create a site and navigate to content types
    await page.getByRole("button", { name: "New site" }).first().click();
    await page.getByLabel("Site name").fill("CT Test Site");
    await page.getByLabel(/Site slug/).fill(`ct-site-${Date.now()}`);
    await page.getByRole("button", { name: "Create site" }).click();
    await page.getByRole("link", { name: /Open site/ }).click();
    await page.waitForURL(/\/dashboard\/sites\//);
    await page.getByRole("link", { name: "Content Types" }).click();
    await page.waitForURL(/\/content-types$/);
  });

  test("shows empty state with create button", async ({ page }) => {
    await expect(page.getByText("No content types yet")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New content type" }).first(),
    ).toBeVisible();
  });

  test("can create a content type and open editor", async ({ page }) => {
    await page
      .getByRole("button", { name: "New content type" })
      .first()
      .click();
    await page.getByLabel("Name").fill("Blog Post");
    await page.getByLabel(/Slug/).fill("blog-post");
    await page.getByRole("button", { name: "Create and edit" }).click();

    await page.waitForURL(/\/content-types\/.+/);
    await expect(
      page.getByRole("heading", { name: "Blog Post" }),
    ).toBeVisible();
    await expect(page.getByText("DRAFT")).toBeVisible();
    await expect(page.getByText("Fields (0)")).toBeVisible();
  });

  test("field type picker shows all 18 types in 6 groups", async ({ page }) => {
    await page
      .getByRole("button", { name: "New content type" })
      .first()
      .click();
    await page.getByLabel("Name").fill("Test CT");
    await page.getByLabel(/Slug/).fill("test-ct");
    await page.getByRole("button", { name: "Create and edit" }).click();
    await page.waitForURL(/\/content-types\/.+/);

    await page.getByRole("button", { name: "Add field" }).first().click();
    const picker = page.getByRole("region", { name: "Choose field type" });
    await expect(picker.locator("p")).toHaveText([
      "Basic",
      "Selection",
      "Date & Time",
      "Specialized",
      "Media",
      "Structure",
    ]);

    const fieldButtons = picker.getByRole("button", {
      name: /Short plain text|Multi-line|Formatted text|Integer|True \/ false|Pick one|Pick multiple|Calendar|Date with|Time of|Web address|Email address|Color picker|Single image|Multiple images|Link to|Nested group|Repeatable/,
    });
    await expect(fieldButtons).toHaveCount(18);
  });

  test("can add fields and activate content type", async ({ page }) => {
    await page
      .getByRole("button", { name: "New content type" })
      .first()
      .click();
    await page.getByLabel("Name").fill("Article");
    await page.getByLabel(/Slug/).fill("article");
    await page.getByRole("button", { name: "Create and edit" }).click();
    await page.waitForURL(/\/content-types\/.+/);

    // Activate is disabled with no fields
    await expect(page.getByRole("button", { name: "Activate" })).toBeDisabled();

    // Add a text field
    await page.getByRole("button", { name: "Add field" }).first().click();
    await page.getByRole("button", { name: /Short plain text/ }).click();
    await expect(page.getByText("Fields (1)")).toBeVisible();

    // Add a rich text field
    await page.getByRole("button", { name: "Add field" }).first().click();
    await page.getByRole("button", { name: /Formatted text/ }).click();
    await expect(page.getByText("Fields (2)")).toBeVisible();

    // Activate button should now be enabled
    await expect(page.getByRole("button", { name: "Activate" })).toBeEnabled();

    // Activate
    await page.getByRole("button", { name: "Activate" }).click();
    await expect(page.getByText("ACTIVE")).toBeVisible();
    await expect(page.getByText("v1")).toBeVisible();
    await expect(page.getByText("Saved")).toBeVisible();
  });

  test("activated content type appears in list with ACTIVE badge", async ({
    page,
  }) => {
    // Create and activate a content type
    await page
      .getByRole("button", { name: "New content type" })
      .first()
      .click();
    await page.getByLabel("Name").fill("Product");
    await page.getByLabel(/Slug/).fill("product");
    await page.getByRole("button", { name: "Create and edit" }).click();
    await page.waitForURL(/\/content-types\/.+/);

    await page.getByRole("button", { name: "Add field" }).first().click();
    await page.getByRole("button", { name: /Short plain text/ }).click();
    await page.getByRole("button", { name: "Activate" }).click();
    await expect(page.getByText("v1")).toBeVisible();

    // Go back to list
    await page
      .locator("aside")
      .getByRole("link", { name: "Content Types" })
      .click();
    await expect(page).toHaveURL(/\/content-types$/);
    const productRow = page.getByRole("link").filter({ hasText: "Product" });
    await expect(productRow).toBeVisible();
    await expect(productRow).toContainText("ACTIVE");
  });
});
