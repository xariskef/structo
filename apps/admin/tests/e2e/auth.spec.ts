import { expect, test } from "@playwright/test";

test.describe("Authentication", () => {
  test("home page loads with navigation cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "A clean foundation",
    );
    await expect(page.getByRole("link", { name: /Open →/ }).first()).toBeVisible();
  });

  test("/dashboard redirects to /login when unauthenticated", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test("/dashboard/organizations/:id redirects to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard/organizations/nonexistent");
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test("/dashboard/sites/:id/settings redirects to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard/sites/nonexistent/settings");
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test("/dashboard/sites/:id/content-types redirects to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard/sites/nonexistent/content-types");
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("heading", { name: "Welcome back" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
  });

  test("register page renders correctly", async ({ page }) => {
    await page.goto("/register");
    await expect(
      page.getByRole("heading", { name: "Create your workspace" }),
    ).toBeVisible();
    await expect(page.getByLabel("Your name")).toBeVisible();
    await expect(page.getByLabel("Organization name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
  });

  test("login and register pages link to each other", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Register" }).click();
    await expect(page).toHaveURL(/\/register/);
    await page.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
