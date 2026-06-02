import { expect, test } from "./fixtures";

async function createAndOpenSite(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "New site" }).first().click();
  await page.getByLabel("Site name").fill("Activity Test Site");
  await page.getByLabel(/Site slug/).fill(`activity-site-${Date.now()}`);
  await page.getByRole("button", { name: "Create site" }).click();
  await page.getByRole("link", { name: /Open site/ }).click();
  await page.waitForURL(/\/dashboard\/sites\//);
}

test.describe("Activity", () => {
  test("site and organization activity show a known audit event", async ({
    page,
    orgId,
  }) => {
    await createAndOpenSite(page);

    // Create an API token to produce a deterministic audit event.
    await page.getByRole("link", { name: "API tokens" }).click();
    await page.waitForURL(/\/api-tokens$/);
    await page.getByLabel("Name").fill("Activity Token");
    await page.getByRole("button", { name: /Create token/ }).click();
    await expect(page.getByText("Copy this token now")).toBeVisible();

    // Site activity lists the event.
    await page.getByRole("link", { name: "Activity", exact: true }).click();
    await page.waitForURL(/\/activity$/);
    await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
    await expect(page.getByText("Api token create").first()).toBeVisible();

    // Organization activity surfaces the same site event.
    await page.goto(`/dashboard/organizations/${orgId}/activity`);
    await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
    await expect(page.getByText("Api token create").first()).toBeVisible();

    // Clearing is destructive but records itself: the token event disappears
    // and an "Audit log clear" event remains. The clear runs a transaction plus
    // a reload against the remote database, so allow extra time.
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Clear log" }).click();
    await expect(page.getByText("Audit log clear").first()).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText("Api token create")).toHaveCount(0, {
      timeout: 30000,
    });
  });
});
