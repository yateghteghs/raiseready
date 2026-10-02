import { expect, test } from "@playwright/test";

/** Everything a signed-out visitor can reach. Runs without accounts or keys. */

const PUBLIC_PAGES = [
  "/",
  "/how-it-works",
  "/pricing",
  "/about",
  "/privacy",
  "/terms",
  "/login",
  "/register",
  "/forgot-password",
  "/account-deleted",
  "/admin/login",
  "/testimonials",
  "/partners",
  "/faq",
];

for (const path of PUBLIC_PAGES) {
  test(`${path} loads, has a heading and fits the screen`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, "no sideways scrolling").toBeLessThanOrEqual(0);
    expect(errors, "no script errors or blocked resources").toEqual([]);
  });
}

// Translated pages in a right-to-left language and one with many accents.
for (const locale of ["ar", "yo"]) {
  for (const path of ["/", "/pricing", "/faq", "/login", "/register"]) {
    test(`${path} in ${locale} loads and fits the screen`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: "rr_locale", value: locale, url: baseURL! }]);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "no sideways scrolling").toBeLessThanOrEqual(0);
      expect(errors).toEqual([]);
    });
  }
}

test("visitors can switch language, and untranslated pages stay in English", async ({ page }) => {
  await page.goto("/");
  await page.locator("footer select[name=locale]").selectOption("fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Entraînez-vous d'abord avec l'IA/);
  await page.goto("/privacy");
  await expect(page.locator("article")).toHaveAttribute("lang", "en");
  await page.locator("footer select[name=locale]").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("legal pages are marked as drafts", async ({ page }) => {
  for (const path of ["/privacy", "/terms"]) {
    await page.goto(path);
    await expect(page.getByText(/DRAFT: requires legal review/)).toBeVisible();
  }
});

test("pricing shows naira prices", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByText("₦15,000").first()).toBeVisible();
  await expect(page.getByText("₦5,000").first()).toBeVisible();
});

test("the main call to action leads to sign-up", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /test my readiness/i }).first().click();
  await expect(page).toHaveURL(/\/register/);
});

test("signed-in areas send visitors to log in and come back afterwards", async ({ page }) => {
  for (const path of ["/app", "/app/documents", "/app/settings", "/app/decks"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
  }
  for (const path of ["/admin", "/admin/users", "/admin/users/00000000-0000-4000-8000-000000000000"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/admin/login\\?next=${encodeURIComponent(path)}$`));
  }
});

test("staff have their own sign-in page", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to admin" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Founder login" })).toHaveAttribute("href", "/login");
});

test("unknown pages show a friendly 404", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /isn't here/i })).toBeVisible();
});

test("login asks for missing details instead of failing", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Log in" }).click();
  // The browser's required-field check stops the form before it is sent.
  await expect(page).toHaveURL(/\/login$/);
  expect(await page.getByLabel("Email").evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
});

test("responses carry security headers", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("the Investor Room endpoint refuses cross-site and signed-out requests", async ({ request, baseURL }) => {
  const url = "/api/simulations/00000000-0000-0000-0000-000000000000/turn";
  const crossSite = await request.post(url, { headers: { origin: "https://evil.example" }, data: { answer: "hi" } });
  expect(crossSite.status()).toBe(403);
  const signedOut = await request.post(url, { headers: { origin: baseURL! }, data: { answer: "hi" } });
  expect(signedOut.status()).toBe(401);
});

test("the Paystack webhook rejects unsigned requests", async ({ request }) => {
  const res = await request.post("/api/paystack/webhook", { data: { event: "charge.success", data: { reference: "x" } } });
  expect(res.status()).toBe(401);
});
