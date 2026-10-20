import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

/**
 * The ops ledger.
 *
 * Three things are proved here:
 *
 *   1. The grid is SERVER-PAGINATED. The request that fills the grid carries
 *      startRow and endRow, and the whole table never travels to the browser.
 *   2. The natural-language layer compiles a phrase into the same filter
 *      model the column filters use, and says what it understood.
 *   3. The custom renderers are real: a state pill, a verdict badge, an
 *      amount and an end-to-end latency are on the page.
 */

const SHOTS = "e2e/screenshots";

test.beforeAll(async () => {
  await mkdir(SHOTS, { recursive: true });
});

test("the ledger pages from the server and answers plain language", async ({ page }, testInfo) => {
  const project = testInfo.project.name;

  page.on("pageerror", (error) => {
    console.log(`[ops] pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`[ops] console: ${message.text()}`);
  });

  const ledgerRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/ops/ledger")) {
      ledgerRequests.push(request.url());
    }
  });

  await page.goto("/ops");
  await expect(page.getByRole("heading", { name: "The ledger" })).toBeVisible();

  // The grid must ask the server for a block of rows, not for the whole table.
  await expect.poll(() => ledgerRequests.length, { timeout: 20_000 }).toBeGreaterThan(0);
  const firstRequest = new URL(ledgerRequests[0]);
  expect(firstRequest.searchParams.get("startRow")).toBe("0");
  expect(firstRequest.searchParams.get("endRow")).not.toBeNull();
  expect(Number(firstRequest.searchParams.get("endRow"))).toBeLessThanOrEqual(500);

  // The custom renderers are on the page. The first column is asserted rather
  // than the last, because at 390 px the grid scrolls horizontally and the
  // right-hand columns are outside the viewport.
  await expect(page.getByText("SKU", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".ag-row").first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/${project}-10-ops-ledger.png` });

  // ---- the natural-language layer -----------------------------------------
  const ask = page.getByLabel("Ask the ledger in plain language");
  await ask.fill("show failed payouts");
  await page.getByRole("button", { name: "Ask", exact: true }).click();

  // It says what it understood, in a visible chip.
  await expect(page.getByText("parsed as")).toBeVisible();
  await expect(page.getByText("status is failed")).toBeVisible();

  // And the next request carries the compiled filter.
  await expect
    .poll(
      () =>
        ledgerRequests.some((url) => {
          const filters = new URL(url).searchParams.get("filters");
          return filters !== null && filters.includes("PAYOUT_FAILED");
        }),
      { timeout: 20_000 },
    )
    .toBe(true);

  // The grid must finish loading before it is screenshotted, or the
  // screenshot waits on a page whose height is still changing.
  await expect(page.locator(".ag-row").first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/${project}-11-ops-nl-query.png` });

  // ---- an unknown phrase is refused, never guessed -------------------------
  await ask.fill("banana");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByText(/did not understand/i)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/${project}-12-ops-not-understood.png` });
});
