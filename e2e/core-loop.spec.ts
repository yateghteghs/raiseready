import { randomUUID } from "node:crypto";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * The core loop (spec section 11, milestone 10) against a real deployment:
 * log in → onboard → upload a deck → analyse → assess → full Investor Room
 * meeting → results → delete the account.
 *
 * It creates a throwaway, pre-confirmed founder with the service-role key and
 * uses real AI calls (a few dozen; roughly the cost of one founder's session).
 * The account deletion step is part of the test; afterAll cleans up if an
 * earlier step failed.
 */

const SUPABASE_URL = process.env.E2E_SUPABASE_URL;
const SERVICE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(process.env.E2E_BASE_URL && SUPABASE_URL && SERVICE_KEY);

test.skip(!configured, "Set E2E_BASE_URL, E2E_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY to run the core loop.");
test.describe.configure({ mode: "serial" });

const DECK = path.join(process.cwd(), "e2e/fixtures/sample-deck.pdf");
const email = `e2e-${Date.now()}-${randomUUID().slice(0, 8)}@raiseready-e2e.test`;
const password = `E2e-${randomUUID()}`;
let userId: string | null = null;

const admin = () => createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

test.beforeAll(async () => {
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`Could not create the test founder: ${error.message}`);
  userId = data.user.id;
});

test.afterAll(async () => {
  if (!userId) return;
  const client = admin();
  const { data } = await client.auth.admin.getUserById(userId);
  if (!data?.user) return; // Deleted by the test, as intended.
  for (const bucket of ["documents", "reports"]) {
    const { data: folders } = await client.storage.from(bucket).list(userId);
    for (const folder of folders ?? []) {
      const { data: files } = await client.storage.from(bucket).list(`${userId}/${folder.name}`);
      const paths = (files ?? []).map((f) => `${userId}/${folder.name}/${f.name}`);
      if (paths.length) await client.storage.from(bucket).remove(paths);
    }
  }
  await client.auth.admin.deleteUser(userId);
});

/** Answers that draw on the sample deck, so the investor has something real to probe. */
const ANSWERS = [
  "We are Kolo Freight. We let small traders in Lagos book a vetted truck from Apapa port in under ten minutes at a fixed price, with live tracking. Traders wait three to five days today.",
  "Monthly revenue was 18 million naira in August 2026, up from 6 million in February. We have 420 paying customers and 35% of revenue comes from repeat bookings.",
  "We take a 12% commission per trip. The average trip is 85,000 naira, so about 10,200 naira per trip. Gross margin is 9% after payment and insurance costs; we expect it to improve with route density.",
  "We estimate about 40,000 small importers in Lagos from port data, and around 120 million dollars a year in last-mile freight we can serve. We would expand to Ibadan next.",
  "Adaeze, our CEO, spent six years running operations at a national logistics firm. Tunde, our CTO, built dispatch software used by 300 drivers.",
  "Competitors are informal truck brokers and a few venture-backed platforms focused on large shippers. We focus on small traders who need one truck at a time and fixed prices.",
  "We are raising 500,000 dollars on a SAFE: half for engineering, 30% for onboarding drivers and 20% for expanding to Ibadan. That gives us 18 months of runway.",
  "The biggest risk is driver supply at peak times. We pre-book drivers for repeat customers and are testing a small retainer for our top drivers.",
];

async function answerUntilTheMeetingEnds(page: Page) {
  const box = page.getByPlaceholder("Type your answer…");
  const over = page.getByText(/The meeting is over/);
  for (let i = 0; i < 25; i++) {
    await expect(box.or(over)).toBeVisible({ timeout: 120_000 });
    if (await over.isVisible()) return;
    await box.fill(ANSWERS[i % ANSWERS.length]);
    await page.getByRole("button", { name: "Send answer" }).click();
    // Wait for the investor's reply: the box comes back, or the meeting ends.
    await expect(page.getByPlaceholder("The investor is responding…")).toBeHidden({ timeout: 120_000 });
    await expect(page.locator("p[role=alert]"), "no error from the investor").toHaveCount(0);
  }
  throw new Error("The meeting did not end after 25 answers.");
}

test("a founder can go from sign-in to feedback, then delete their account", async ({ page }) => {
  test.setTimeout(30 * 60_000);

  await test.step("log in", async () => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/app\/onboarding/);
  });

  await test.step("onboard", async () => {
    await page.getByLabel("Your full name").fill("E2E Test Founder");
    await page.getByLabel("Where are you based?").selectOption("Nigeria");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByLabel("Startup name").fill("Kolo Freight (E2E)");
    await page.getByLabel("Industry").selectOption("Logistics & mobility");
    await page.getByLabel("Main market").selectOption("Nigeria");
    await page.getByLabel("Stage").selectOption("seed");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("button", { name: "Continue" }).click(); // Traction is optional.

    await page.getByLabel("Amount you're raising", { exact: true }).fill("500000");
    await page.getByLabel("Amount you're raising currency").selectOption("USD");
    await page.getByRole("button", { name: "Finish" }).click();
    await expect(page).toHaveURL(/\/app$/);
  });

  await test.step("upload and analyse the pitch deck", async () => {
    await page.goto("/app/documents");
    await page.locator("#upload-pitch_deck").setInputFiles(DECK);
    await expect(page.getByText("sample-deck.pdf").first()).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "Analyse documents" }).click();
    await expect(page.getByText(/Version 1, analysed/)).toBeVisible({ timeout: 5 * 60_000 });
  });

  await test.step("run the readiness assessment", async () => {
    await page.goto("/app/assessment");
    await page.getByRole("button", { name: "Run readiness assessment" }).click();
    await expect(page.getByRole("heading", { name: "Readiness score" })).toBeVisible({ timeout: 5 * 60_000 });
  });

  await test.step("hold a full Investor Room meeting", async () => {
    await page.goto("/app/investor-room");
    await page.getByLabel(/Angel investor/).check();
    await page.getByLabel(/Friendly/).check();
    await page.getByRole("button", { name: "Enter the Investor Room" }).click();
    await expect(page).toHaveURL(/\/app\/investor-room\/[0-9a-f-]{36}$/, { timeout: 60_000 });
    await answerUntilTheMeetingEnds(page);
  });

  await test.step("see the results", async () => {
    await page.getByRole("link", { name: "See feedback on every answer" }).click({ timeout: 3 * 60_000 });
    await expect(page).toHaveURL(/\/app\/simulations\/[0-9a-f-]{36}\/results$/);
    await expect(page.getByText(/Investor confidence/).first()).toBeVisible();
  });

  await test.step("delete the account", async () => {
    await page.goto("/app/settings");
    await page.getByLabel("Type DELETE to confirm").fill("DELETE");
    await page.getByRole("button", { name: "Delete my account permanently" }).click();
    await expect(page).toHaveURL(/\/account-deleted$/, { timeout: 60_000 });

    const { data } = await admin().auth.admin.getUserById(userId!);
    expect(data?.user ?? null, "the auth user is gone").toBeNull();
    const { data: files } = await admin().storage.from("documents").list(userId!);
    expect(files ?? [], "no stored files remain").toEqual([]);

    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
  });
});
