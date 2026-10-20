import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

/**
 * The demo, end to end.
 *
 * It walks the exact path a judge walks: post a bounty on the console, open
 * the claim link on a phone, accept it, photograph the shelf, submit, and
 * watch the money move.
 *
 * The camera is replaced by the DISCLOSED DEMO FIXTURE — the same one a judge
 * can use when they have no camera — so the test is deterministic and does
 * not depend on a device.
 *
 * Every step is screenshotted. The screenshots are committed, because a
 * screenshot is evidence, and the submission asks for evidence.
 */

const SHOTS = "e2e/screenshots";

/** The seeded demo store, so the geofence rule is satisfied. */
const STORE_LAT = 37.7955;
const STORE_LNG = -122.3937;

test.use({
  permissions: ["geolocation"],
  geolocation: { latitude: STORE_LAT, longitude: STORE_LNG },
});

test.beforeAll(async () => {
  await mkdir(SHOTS, { recursive: true });
});

test("a bounty is posted, proved, and paid", async ({ page }, testInfo) => {
  const project = testInfo.project.name;

  // ---- 1. the console ------------------------------------------------------
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Agents need facts/i })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/${project}-01-console.png`, fullPage: true });

  // ---- 2. post a bounty ----------------------------------------------------
  await page.getByLabel("SKU").fill("4471");
  await page.getByLabel("Expected price").fill("6.00");
  await page.getByLabel("Reward").fill("6.00");
  await page.getByLabel("Store").fill("Ferry Plaza Market");
  await page.getByLabel("Address").fill("1 Ferry Building, San Francisco, CA");
  await page.getByLabel("Latitude").fill(String(STORE_LAT));
  await page.getByLabel("Longitude").fill(String(STORE_LNG));
  await page.getByLabel("Requester email").fill("agent@groundtruth.test");
  await page.getByLabel("Mock vision scenario").selectOption("match");

  await page.getByRole("button", { name: "Post bounty" }).click();

  const claimLinkInput = page.getByLabel("Claim link");
  await expect(claimLinkInput).toBeVisible({ timeout: 20_000 });
  const claimLink = await claimLinkInput.inputValue();
  expect(claimLink).toContain("/claim/");
  await page.screenshot({ path: `${SHOTS}/${project}-02-bounty-posted.png`, fullPage: true });

  // ---- 3. the claim link, on a phone ---------------------------------------
  await page.goto(claimLink);
  await expect(page.getByText("A verification bounty")).toBeVisible();
  await expect(page.getByText("You earn")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/${project}-03-claim-accept.png`, fullPage: true });

  // ---- 4. accept -----------------------------------------------------------
  await page.getByLabel("Your email").fill("demo@shopper.test");
  await page.getByRole("button", { name: /Accept and earn/i }).click();
  await expect(page.getByText("Photograph the price tag")).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${SHOTS}/${project}-04-accepted.png`, fullPage: true });

  // ---- 5. the evidence -----------------------------------------------------
  await page.getByRole("button", { name: /demo fixture/i }).click();
  await expect(page.getByText(/KB uploaded/)).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${SHOTS}/${project}-05-evidence.png`, fullPage: true });

  // ---- 6. submit -----------------------------------------------------------
  await page.getByRole("button", { name: /Submit evidence/i }).click();

  await expect(page.getByText("Evidence accepted")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Paid", { exact: true })).toBeVisible();
  await expect(page.getByText("demo@shopper.test")).toBeVisible();
  await expect(page.getByText("The six rules")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/${project}-06-paid.png`, fullPage: true });

  // ---- 7. the evidence record ---------------------------------------------
  const bountyHref = await page
    .getByRole("link", { name: /full evidence record/i })
    .getAttribute("href");
  expect(bountyHref).toBeTruthy();

  await page.goto(bountyHref!);
  await expect(page.getByText("The six rules")).toBeVisible();
  await expect(page.getByText("6 passed · 0 failed")).toBeVisible();
  await expect(page.getByText("PAID").first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/${project}-07-evidence-record.png`, fullPage: true });
});
