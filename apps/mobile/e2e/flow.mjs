// E2E im Browser (Expo Web, lokaler Mock-Modus): Onboarding -> Hauptscreen -> Lektion -> Profil -> Konto loeschen.
// Start:  npx expo start --web --port 8099   (anderes Terminal)   dann:  node e2e/flow.mjs
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:8099";
const OUT = process.env.SHOTS ?? "/tmp/learni-e2e";
const EXE = process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
mkdirSync(OUT, { recursive: true });

const errors = [];
// Push-to-talk = Halten. Ein kurzer Klick zeigt nur den Hinweis, gehalten startet die Aufnahme.
async function holdMic(page, ms = 350) { const box = await page.getByTestId("mic-button").first().boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); await page.waitForTimeout(300); }
const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: process.env.LOCALE ?? "de-DE", colorScheme: process.env.SCHEME ?? "light", reducedMotion: process.env.REDUCE ? "reduce" : "no-preference" });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !/favicon|DevTools|Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });

const tid = (id) => page.getByTestId(id);
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const visible = async (id, ms = 8000) => { await tid(id).first().waitFor({ state: "visible", timeout: ms }); };
const click = async (id) => { await visible(id); await tid(id).first().click(); };
const step = (m) => console.log("•", m);

await page.goto(BASE);
await visible("login-apple", 60000); await shot("01-login"); step("login screen");
await click("login-apple");
await visible("ai-ok"); await shot("02-ai-notice"); await click("ai-ok"); step("ai notice acknowledged");
await visible("language-es"); await shot("03-language"); await click("language-es"); step("language chosen");
await click("age-18_plus"); await click("age-continue"); step("age gate");
await visible("consent-accept"); await shot("04-consent"); await tid("consent-voice").first().click().catch(() => {}); await click("consent-accept"); step("consent");
await click("level-none"); await shot("05-onboarding"); await click("onboarding-next");
await click("goal-travel"); await click("onboarding-next");
await click("daily-10"); await click("onboarding-next"); step("onboarding");
await visible("plan-free"); await shot("06-plan"); await click("plan-free"); step("plan -> free");
await visible("subtitle", 15000); await shot("07-main"); step("main screen");

const seen = new Set();
for (let i = 0; i < 8; i++) {
  await visible("exercise-prompt", 10000).catch(() => {});
  if (await tid("flip-button").count()) { seen.add("flashcard"); await click("flip-button"); await click("rate-good"); }
  else if (await tid("play-button").count()) { seen.add("listen_pick"); await tid("option-").first().click().catch(() => {}); await page.locator('[role="button"][data-testid^="option-"]').first().click(); await click("check-button"); }
  else if (await page.locator('[data-testid^="token-"]').count()) { seen.add("word_order"); const n = await page.locator('[data-testid^="token-"]').count(); for (let k = 0; k < n; k++) await page.locator('[data-testid^="token-"]').first().click(); await click("check-button"); }
  else if (await page.locator('[data-testid^="left-"]').count()) { seen.add("matching"); const n = await page.locator('[data-testid^="left-"]').count(); for (let k = 0; k < n; k++) { await page.locator('[data-testid^="left-"]').nth(k).click(); await page.locator('[data-testid^="right-"]').nth(k).click(); } await click("check-button"); }
  else if (await tid("mic-hint").count()) {
    seen.add("speak_repeat"); await holdMic(page);
    if (await tid("consent-accept").count()) { await tid("consent-voice").first().click(); await click("consent-accept"); await page.waitForTimeout(400); await holdMic(page); await page.waitForTimeout(600); }
    const target = (await tid("exercise-prompt").first().textContent()) ?? "";
    await visible("typed-answer", 5000); await tid("typed-answer").fill(target); await page.getByRole("button", { name: /Prüfen/ }).first().click();
  }
  else if (await page.locator('[data-testid^="option-"]').count()) { seen.add("options"); await page.locator('[data-testid^="option-"]').first().click(); await click("check-button"); }
  else throw new Error("unknown exercise state at step " + i);
  if (i === 2) await shot("08-exercise");
  if (await tid("next-button").count() === 0) { await tid("next-button").first().waitFor({ timeout: 4000 }).catch(() => {}); }
  if (await tid("next-button").count()) { if (i === 2) await shot("09-result"); await click("next-button"); }
  else { step("(no next button; speaking exercise needs consent flow) exercise " + i); break; }
}
step("exercises seen: " + [...seen].join(", "));

// Lektionsende, Celebrations
await visible("lesson-done", 15000); await shot("09b-lesson-end"); step("lesson finished");
await click("lesson-continue");
for (let k = 0; k < 3 && (await tid("celebration-title").count()); k++) { if (k === 0) await shot("09c-celebration"); await click("celebration-continue"); step("celebration " + (k + 1)); }
await visible("profile-button", 10000);
// Profil-Einstellungen
await click("profile-button"); await visible("setting-sfx"); await shot("10-profile");
await click("setting-haptics"); step("toggled haptics");
await click("delete-account"); await visible("delete-confirm"); await shot("11-delete"); await click("delete-confirm");
await visible("login-apple", 15000); step("account deleted -> login");
await browser.close();
if (errors.length) { console.error("FEHLER:\n" + errors.join("\n")); process.exit(1); }
console.log("E2E ok, Screenshots in", OUT);
