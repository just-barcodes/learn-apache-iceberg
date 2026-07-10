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

test("the query planner prunes files whose stats cannot match", async ({ page }) => {
  await page.locator(".segmented__btn", { hasText: "Advanced" }).click();
  await page.locator(".query__select").first().selectOption("order_id");
  await page.locator(".query__select").nth(1).selectOption(">");
  await page.locator(".query__input").fill("1003");
  await page.locator(".query__run").click();
  await expect(page.locator(".query__result")).toContainText("1/2 scanned");
  await expect(page.locator(".query__result")).toContainText("1 pruned");
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
