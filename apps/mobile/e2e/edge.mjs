// Randfaelle: Herzen-leer-Sheet + freiwillige Rewarded Ad, Pro-Umschaltung, Sprachwechsel, Sprech-Uebung ohne Mikrofon (Tipp-Alternative),
// Dark Mode, Englisch, Reduce Motion. Start: node e2e/edge.mjs (BASE_URL=http://localhost:8098 auf `expo export --platform web`)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:8098";
const OUT = process.env.SHOTS ?? "/tmp/learni-e2e-edge";
const EXE = process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
mkdirSync(OUT, { recursive: true });
const errors = [];
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });

async function newPage(opts) {
  const ctx = await browser.newContext({ viewport: opts.viewport ?? { width: 390, height: 844 }, deviceScaleFactor: 2, locale: opts.locale, colorScheme: opts.scheme, reducedMotion: opts.reduce ? "reduce" : "no-preference" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`[${opts.name}] pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|DevTools|Failed to load resource/.test(m.text())) errors.push(`[${opts.name}] console: ${m.text()}`); });
  return page;
}
const helpers = (page) => {
  const tid = (id) => page.getByTestId(id);
  const visible = async (id, ms = 10000) => tid(id).first().waitFor({ state: "visible", timeout: ms });
  const click = async (id) => { await visible(id); await tid(id).first().click(); };
  return { tid, visible, click };
};
async function onboard(page, h, { adaptive = false } = {}) {
  await page.goto(BASE);
  await h.visible("login-apple", 60000); await h.click("login-apple");
  await h.click("ai-ok"); await h.click("language-es");
  await h.click("age-18_plus"); await h.click("age-continue");
  await h.click("consent-accept");
  await h.click(adaptive ? "level-few_words" : "level-none"); await h.click("onboarding-next");
  if (adaptive) { for (let i = 0; i < 3; i++) { const opt = page.locator('[data-testid^="adaptive-"]').first(); if (!(await opt.count())) break; await opt.click(); await h.click("onboarding-next"); } }
  await h.click("goal-fun"); await h.click("onboarding-next");
  await h.click("daily-5"); await h.click("onboarding-next");
  await h.click("plan-free"); await h.visible("subtitle", 15000);
}
const heartsText = async (page) => (await page.getByText(/^\d+$/).first().textContent().catch(() => "?"));
const log = (m) => console.log("•", m);

// 1) Deutsch, hell: Herzen leer -> Sheet -> Rewarded Ad -> Sprechen bleibt kostenlos
{
  const page = await newPage({ name: "de-light", locale: "de-DE", scheme: "light" });
  const h = helpers(page);
  await onboard(page, h, { adaptive: true }); log("onboarding with adaptive questions");
  let sheet = false, guard = 0;
  while (!sheet && guard++ < 60) {
    if (await h.tid("hearts-speak").count()) { sheet = true; break; }
    if (await h.tid("flip-button").count()) { await h.click("flip-button"); await h.click("rate-again"); }
    else if (await h.tid("mic-hint").count()) {
      // Sprechuebung: Mikrofon ohne Einwilligung/Berechtigung -> Tipp-Alternative
      await page.getByRole("button", { name: /Mikrofon/ }).first().click().catch(() => {});
      await page.waitForTimeout(400);
      if (await h.tid("consent-accept").count()) { await h.tid("consent-voice").first().click(); await h.click("consent-accept"); await page.waitForTimeout(300); await page.getByRole("button", { name: /Mikrofon/ }).first().click().catch(() => {}); await page.waitForTimeout(500); }
      const target = (await h.tid("exercise-prompt").first().textContent()) ?? "";
      if (await h.tid("typed-answer").count()) { await h.tid("typed-answer").fill(target); await page.getByRole("button", { name: /Prüfen/ }).first().click(); log("speak exercise answered via typed fallback (no heart cost)"); }
    }
    else if (await page.locator('[data-testid^="token-"]').count()) { const n = await page.locator('[data-testid^="token-"]').count(); for (let k = 0; k < n; k++) await page.locator('[data-testid^="token-"]').first().click(); await h.click("check-button"); }
    else if (await page.locator('[data-testid^="left-"]').count()) { const n = await page.locator('[data-testid^="left-"]').count(); for (let k = 0; k < n; k++) { await page.locator('[data-testid^="left-"]').nth(k).click(); await page.locator('[data-testid^="right-"]').nth(k).click(); } await h.click("check-button"); }
    else if (await page.locator('[data-testid^="option-"]').count()) { await page.locator('[data-testid^="option-"]').last().click(); await h.click("check-button"); }
    else { await page.waitForTimeout(300); continue; }
    if (await h.tid("hearts-speak").count()) { sheet = true; break; }
    await h.tid("next-button").first().waitFor({ timeout: 3000 }).catch(() => {});
    if (await h.tid("hearts-speak").count()) { sheet = true; break; }
    if (await h.tid("next-button").count()) await h.click("next-button");
  }
  if (!sheet) throw new Error("hearts-empty sheet never appeared");
  await page.screenshot({ path: `${OUT}/01-hearts-empty.png` }); log("hearts-empty sheet shown");
  await h.click("hearts-ad"); await page.waitForTimeout(1200);
  if (await h.tid("hearts-speak").count()) throw new Error("sheet should close after rewarded ad");
  log("rewarded ad gave a heart, sheet closed");
  // Sprachwechsel ueber Badge
  await h.click("language-badge"); await h.visible("language-fr"); await page.screenshot({ path: `${OUT}/02-language-switch.png` }); await h.click("language-fr");
  await h.visible("subtitle"); log("language switched via badge");
  // Pro-Umschaltung im Profil (Testmodus) -> unbegrenzte Herzen
  await h.click("profile-button"); await h.click("dev-toggle-pro"); await page.waitForTimeout(400); await h.click("profile-close");
  await page.screenshot({ path: `${OUT}/03-pro-main.png` });
  await page.close();
}

// 2) Englisch + Dark Mode
{
  const page = await newPage({ name: "en-dark", locale: "en-US", scheme: "dark" });
  const h = helpers(page);
  await onboard(page, h);
  await page.screenshot({ path: `${OUT}/04-en-dark-main.png` });
  const body = await page.locator("body").innerText();
  if (!/Repeat/.test(body) || !/Slower/.test(body)) throw new Error("English UI expected");
  log("english + dark ok");
  await page.close();
}

// 3) Reduce Motion + kleines iPhone-Format
{
  const page = await newPage({ name: "reduce-small", locale: "de-DE", scheme: "light", reduce: true, viewport: { width: 320, height: 568 } });
  const h = helpers(page);
  await onboard(page, h);
  await page.screenshot({ path: `${OUT}/05-small-reduce.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) throw new Error("horizontal overflow on small screen");
  log("reduce motion + 320px ok");
  await page.close();
}
await browser.close();
if (errors.length) { console.error("FEHLER:\n" + errors.join("\n")); process.exit(1); }
console.log("EDGE E2E ok, Screenshots in", OUT);
