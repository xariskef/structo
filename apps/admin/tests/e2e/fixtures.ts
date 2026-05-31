import { expect, test as base } from "@playwright/test";

let emailCounter = 0;

export function uniqueEmail() {
  emailCounter += 1;
  return `e2e-${Date.now()}-${emailCounter}@structo-test.dev`;
}

export interface TestUser {
  name: string;
  email: string;
  password: string;
  orgName: string;
  orgSlug: string;
}

export const test = base.extend<{ user: TestUser; orgId: string }>({
  user: async ({}, applyFixture) => {
    const email = uniqueEmail();
    await applyFixture({
      name: "E2E User",
      email,
      password: "TestPassword123!",
      orgName: "E2E Org",
      orgSlug: `e2e-org-${Date.now()}`,
    });
  },

  orgId: async ({ page, user }, applyFixture) => {
    await page.goto("/register");
    await page.getByLabel("Your name").fill(user.name);
    await page.getByLabel("Organization name").fill(user.orgName);
    await page.getByLabel(/Organization slug/).fill(user.orgSlug);
    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Password").fill(user.password);
    await page.getByRole("button", { name: "Create account" }).click();

    await page.waitForURL(/\/dashboard\/organizations\//);
    const orgId = page.url().split("/organizations/")[1]!.split("/")[0]!;
    await applyFixture(orgId);
  },
});

export { expect };
