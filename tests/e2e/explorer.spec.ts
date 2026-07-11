import { expect, test, type Page } from "@playwright/test";

/** Read the numeric value of a stat card by its label. */
async function stat(page: Page, label: string): Promise<number> {
  const card = page.locator(".stat", { hasText: label });
  return Number(await card.locator(".stat__value").innerText());
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".header__title")).toHaveText("Inside an Apache Iceberg Table");
});

test("append commits a snapshot and grows the live-row count", async ({ page }) => {
  expect(await stat(page, "live rows")).toBe(6);
  await page.locator(".append__main").click();
  await expect(page.locator(".view-badge__value")).toHaveText("s2");
  expect(await stat(page, "live rows")).toBe(12);
  expect(await stat(page, "snapshots")).toBe(2);
});

test("time travel views an old snapshot and jumps back to current", async ({ page }) => {
  await page.locator(".append__main").click();
  await expect(page.locator(".view-badge__value")).toHaveText("s2");

  await page.locator(".node--snapshot", { hasText: "s1" }).click();
  await expect(page.locator(".view-badge__label")).toHaveText("TIME TRAVEL");
  await expect(page.locator(".view-badge__value")).toHaveText("s1");

  await page.locator(".view-badge__jump").click();
  await expect(page.locator(".view-badge__value")).toHaveText("s2");
});

test("inspecting a data file opens the grid and Escape closes it", async ({ page }) => {
  await page.locator(".node--data", { hasText: "d1.parquet" }).click();
  const modal = page.locator(".modal-panel");
  await expect(modal).toBeVisible();
  await expect(modal.locator(".modal-head__title")).toHaveText("d1.parquet");
  await expect(modal.locator(".grid")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();
});

test("merge-on-read delete writes a delete file", async ({ page }) => {
  await page.locator(".action", { hasText: "Delete rows" }).click();
  const picker = page.locator(".picker__rows");
  await expect(picker).toBeVisible();
  await picker.locator(".picker__row").first().click();
  await page.locator(".picker__confirm.is-enabled").click();
  expect(await stat(page, "delete files")).toBe(1);
  expect(await stat(page, "live rows")).toBe(5);
});

test("a manifest popout shows at-a-glance facts, jump links, and entries", async ({ page }) => {
  await page.locator(".node--manifest", { hasText: "m1.avro" }).click();
  const modal = page.locator(".modal-panel");
  await expect(modal.locator(".modal-head__title")).toHaveText("m1.avro");
  await expect(modal.locator(".inspector-section").first()).toHaveText("At a glance");
  await expect(modal.locator(".fact", { hasText: "content" })).toContainText("DATA");
  await expect(modal.locator(".fact", { hasText: "spec" })).toContainText("month(order_date)");
  // At medium, per-column min/max stats are hidden.
  await expect(modal.locator(".entry__stats")).toHaveCount(0);
  // Jump link navigates to a referenced data file.
  await modal.locator(".jump-link.node--data").first().click();
  await expect(modal.locator(".grid")).toBeVisible();
  await expect(modal.locator(".modal-head__title")).toContainText(".parquet");
});

test("column min/max stats appear in manifest details only at the advanced level", async ({
  page,
}) => {
  const modal = page.locator(".modal-panel");
  // Medium (default): stats hidden.
  await page.locator(".node--manifest", { hasText: "m1.avro" }).click();
  await expect(modal.locator(".entry__stats")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(modal).toBeHidden();

  // Advanced: stats shown.
  await page.locator(".segmented__btn", { hasText: "Advanced" }).click();
  await page.locator(".node--manifest", { hasText: "m1.avro" }).click();
  await expect(modal.locator(".entry__stats").first()).toContainText("order_id min 1001 max 1003");
});

test("simple mode hides the metadata + manifest layers and trims the panel", async ({ page }) => {
  const columns = page.locator(".graph-col__head");
  // Default (medium): all five columns.
  await expect(columns).toHaveCount(5);

  await page.locator(".segmented__btn", { hasText: "Simple" }).click();
  await expect(columns).toHaveCount(3);
  await expect(columns.nth(0)).toContainText("Catalog");
  await expect(columns.nth(1)).toContainText("Snapshots");
  await expect(columns.nth(2)).toContainText("Data & delete files");
  // Panel trims: fewer stat cards and no metadata/manifest legend entries.
  await expect(page.locator(".stat")).toHaveCount(4);
  await expect(page.locator(".legend__text", { hasText: "Metadata" })).toHaveCount(0);
  await expect(page.locator(".legend__text", { hasText: "Manifest" })).toHaveCount(0);
});

test("the query planner prunes files whose stats cannot match", async ({ page }) => {
  await page.locator(".segmented__btn", { hasText: "Advanced" }).click();
  await page.locator(".query__select").first().selectOption("order_id");
  await page.locator(".query__select").nth(1).selectOption(">");
  await page.locator(".query__input").fill("1003");
  await page.locator(".query__run").click();
  await expect(page.locator(".query__result")).toContainText("1/2 scanned");
  await expect(page.locator(".query__result")).toContainText("1 pruned");
});

test("schema evolution adds a column that old files read back as null", async ({ page }) => {
  await page.locator(".segmented__btn", { hasText: "Advanced" }).click();
  expect(await stat(page, "schema versions")).toBe(1);

  // Evolve the schema: adds the `region` column (metadata-only, no new snapshot).
  await page.locator(".action", { hasText: "Evolve schema" }).click();
  expect(await stat(page, "schema versions")).toBe(2);
  await expect(page.locator(".view-badge__value")).toHaveText("s1"); // pointer unchanged

  // d1 was written under the old schema, so region backfills as null via field id.
  await page.locator(".node--data", { hasText: "d1.parquet" }).click();
  const modal = page.locator(".modal-panel");
  await expect(modal.locator(".modal-head__title")).toHaveText("d1.parquet");
  await expect(modal.locator(".grid__th", { hasText: "region" })).toBeVisible();
  await expect(modal.locator(".grid tbody tr").first().locator("td").last()).toHaveText("null");
});

test("the delete picker follows the current schema", async ({ page }) => {
  await page.locator(".segmented__btn", { hasText: "Advanced" }).click();
  // Evolve twice: add region (schema 1), then rename customer -> customer_name (schema 2).
  const evolve = page.locator(".action", { hasText: "Evolve schema" });
  await evolve.click();
  await evolve.click();

  await page.locator(".action", { hasText: "Delete rows" }).click();
  const header = page.locator(".picker__cols");
  await expect(header).toContainText("customer_name");
  await expect(header).not.toContainText(/\bcustomer\b/); // renamed away from the old label
  await expect(header).toContainText("region");
  // Rows come from files written under schema 0, so region backfills as null.
  await expect(page.locator(".picker__row").first()).toContainText("null");
});

test("the theme toggle flips light and dark", async ({ page }) => {
  const html = page.locator("html");
  await page.locator(".theme-toggle").click();
  const first = await html.getAttribute("data-theme");
  await page.locator(".theme-toggle").click();
  const second = await html.getAttribute("data-theme");
  expect(first).not.toBe(second);
  expect([first, second].sort()).toEqual(["dark", "light"]);
});
