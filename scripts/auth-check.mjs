/*
 * Authentication and authorization, checked against a running server.
 *
 *   npm run build && npm start
 *   node scripts/auth-check.mjs
 *
 * The question is not whether the sign-in form works. It is whether the server
 * refuses the things it should refuse when the browser is not cooperating:
 * a stranger calling an API directly, a teacher calling an admin endpoint, a
 * teacher opening an admin page. Hiding a menu item is not an answer to any of
 * those, so none of these checks look at menus.
 */
import { execFileSync } from "node:child_process";

import {
  CDP,
  browserWebSocket,
  connect,
  launchChrome,
  openPage,
  reporter,
  wait,
} from "./cdp.mjs";

const ORIGIN = "http://localhost:3000";
const PORT = 9351;
const PASSWORD = process.env.SEED_PASSWORD ?? "shiksha-dev-1234";

const ACCOUNTS = {
  teacher: "teacher@shikshasetu.local",
  expert: "expert@shikshasetu.local",
  admin: "admin@shikshasetu.local",
};

const probe = (...args) =>
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/auth-probe.ts", ...args],
    { encoding: "utf8" },
  ).trim();

const { check, summary } = reporter();
const chrome = launchChrome(PORT);

/*
 * Fills the form and submits, returning immediately.
 *
 * Nothing may be awaited in the page across the submit: signing in navigates,
 * the execution context is destroyed, and an `await` inside it never resolves —
 * which reads as "sign-in is broken" when sign-in worked perfectly.
 */
const signInScript = (email) => `(() => {
  const emailField = document.querySelector('input[name="email"]');
  const passwordField = document.querySelector('input[name="password"]');
  if (!emailField || !passwordField) return "no form";
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(emailField, ${JSON.stringify(email)});
  emailField.dispatchEvent(new Event("input", { bubbles: true }));
  setter.call(passwordField, ${JSON.stringify(PASSWORD)});
  passwordField.dispatchEvent(new Event("input", { bubbles: true }));
  const submit = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Sign in"));
  if (!submit) return "no submit";
  submit.click();
  return "submitted";
})()`;

/** Polls from outside the page, so a navigation cannot swallow the answer. */
async function pathAfter(page, expected, attempts = 12) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    await wait(1000);
    const where = await page.evaluate(`location.pathname`, { timeoutMs: 5000 });
    if (where.value === expected) return String(where.value);
  }
  const last = await page.evaluate(`location.pathname`, { timeoutMs: 5000 });
  return String(last.value ?? last.error);
}

/** Signs the current session out through Auth.js's own page. */
async function signOut(page) {
  await page.goto(`${ORIGIN}/api/auth/signout`, 2000);
  await page.evaluate(
    `(() => {
      const button = [...document.querySelectorAll("button")]
        .find(b => b.textContent.toLowerCase().includes("sign out"));
      if (button) button.click();
      return "clicked";
    })()`,
    { userGesture: true },
  );
  await wait(2500);
}

/** Calls an API from the page, so the browser's cookies come with it. */
const callApi = (path, init = "{}") => `fetch(${JSON.stringify(path)}, ${init})
  .then(async r => JSON.stringify({ status: r.status, body: (await r.text()).slice(0, 200) }))
  .catch(e => JSON.stringify({ status: 0, body: String(e) }))`;

try {
  const cdp = new CDP(await connect(await browserWebSocket(PORT)));
  const page = await openPage(cdp);

  /* ------------------------------------------------ stored credentials */

  console.log("--- STORED CREDENTIALS ---");
  const stored = JSON.parse(probe("hash", ACCOUNTS.teacher));
  check(
    "Passwords are stored hashed, not in plain text",
    stored.looksHashed && stored.algorithm === "scrypt",
    `${stored.algorithm} ${stored.parameters}`,
  );
  check(
    "The hash is salted and long enough to be a real derivation",
    stored.length > 100,
    `${stored.length} chars`,
  );

  /* -------------------------------------------------- signed out state */

  console.log("\n--- SIGNED OUT ---");
  await page.goto(`${ORIGIN}/dashboard`);
  const landed = await page.evaluate(`location.pathname`);
  check(
    "A signed-out visitor is sent to sign in, not to the dashboard",
    String(landed.value).startsWith("/login"),
    String(landed.value),
  );

  for (const path of ["/api/offline/bundle", "/api/admin/languages"]) {
    const res = JSON.parse(
      (await page.evaluate(callApi(path))).value ?? '{"status":0}',
    );
    check(
      `${path} refuses an unauthenticated caller`,
      res.status === 401,
      `HTTP ${res.status}`,
    );
  }

  const post = JSON.parse(
    (
      await page.evaluate(
        callApi(
          "/api/translate",
          '{ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceLanguage: "hi-IN", targetLanguage: "sat-IN", text: "जड़" }) }',
        ),
      )
    ).value ?? '{"status":0}',
  );
  check(
    "A write API refuses an unauthenticated caller",
    post.status === 401,
    `HTTP ${post.status}`,
  );

  /* --------------------------------------------------------- teacher */

  console.log("\n--- SIGNED IN AS TEACHER ---");
  await page.goto(`${ORIGIN}/login`, 3000);
  await page.evaluate(signInScript(ACCOUNTS.teacher), { userGesture: true });
  const teacherLanding = await pathAfter(page, "/dashboard");
  check("A teacher can sign in", teacherLanding === "/dashboard", teacherLanding);

  const cookies = await cdp.send("Network.getCookies", { urls: [ORIGIN] }, page.sessionId);
  const session = cookies.cookies.find((cookie) =>
    cookie.name.includes("authjs.session-token"),
  );
  check(
    "The session cookie is httpOnly and same-site",
    Boolean(session?.httpOnly) && session?.sameSite !== "None",
    `httpOnly=${session?.httpOnly} sameSite=${session?.sameSite}`,
  );

  const readable = await page.evaluate(`document.cookie`);
  check(
    "The session cookie is not readable by page scripts",
    !String(readable.value ?? "").includes("session-token"),
    String(readable.value ?? "").slice(0, 120) || "(no script-visible cookies)",
  );

  const ownWork = JSON.parse(
    (await page.evaluate(callApi("/api/offline/bundle"))).value ?? '{"status":0}',
  );
  check(
    "A signed-in teacher can reach their own data",
    ownWork.status === 200,
    `HTTP ${ownWork.status}`,
  );

  /* ------------------------------------- teacher against admin things */

  console.log("\n--- TEACHER AGAINST ADMIN ---");
  const adminGet = JSON.parse(
    (await page.evaluate(callApi("/api/admin/languages"))).value ?? '{"status":0}',
  );
  check(
    "A teacher is refused by an admin API (403, not 200)",
    adminGet.status === 403,
    `HTTP ${adminGet.status}`,
  );

  const adminWrite = JSON.parse(
    (
      await page.evaluate(
        callApi(
          "/api/admin/languages",
          '{ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: "sat-IN", status: "DEPRECATED" }) }',
        ),
      )
    ).value ?? '{"status":0}',
  );
  check(
    "A teacher cannot switch a language off",
    adminWrite.status === 403,
    `HTTP ${adminWrite.status}`,
  );

  const glossaryWrite = JSON.parse(
    (
      await page.evaluate(
        callApi(
          "/api/admin/glossary",
          '{ method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "anything", isVerified: false }) }',
        ),
      )
    ).value ?? '{"status":0}',
  );
  check(
    "A teacher cannot change what is marked verified",
    glossaryWrite.status === 403,
    `HTTP ${glossaryWrite.status}`,
  );

  await page.goto(`${ORIGIN}/admin`, 3000);
  const adminPage = await page.evaluate(`location.pathname`);
  check(
    "A teacher opening /admin is refused server-side",
    String(adminPage.value) === "/forbidden",
    String(adminPage.value),
  );

  await page.goto(`${ORIGIN}/expert/review`, 3000);
  const reviewPage = await page.evaluate(`location.pathname`);
  check(
    "A teacher opening /expert/review is refused server-side",
    String(reviewPage.value) === "/forbidden",
    String(reviewPage.value),
  );

  /* -------------------------------------------------------- the expert */

  console.log("\n--- SIGNED IN AS LANGUAGE EXPERT ---");
  await signOut(page);
  await page.goto(`${ORIGIN}/login`, 3000);
  await page.evaluate(signInScript(ACCOUNTS.expert), { userGesture: true });
  await pathAfter(page, "/dashboard");

  await page.goto(`${ORIGIN}/expert/review`, 3000);
  const expertPage = await page.evaluate(`location.pathname`);
  check(
    "A language expert can open the review screen",
    String(expertPage.value) === "/expert/review",
    String(expertPage.value ?? expertPage.error),
  );

  const expertAtAdmin = JSON.parse(
    (await page.evaluate(callApi("/api/admin/languages"))).value ?? '{"status":0}',
  );
  check(
    "A language expert is still refused by admin APIs",
    expertAtAdmin.status === 403,
    `HTTP ${expertAtAdmin.status}`,
  );

  /* --------------------------------------------------------- the admin */

  console.log("\n--- SIGNED IN AS ADMIN ---");
  await signOut(page);
  await page.goto(`${ORIGIN}/login`, 3000);
  await page.evaluate(signInScript(ACCOUNTS.admin), { userGesture: true });
  await pathAfter(page, "/dashboard");

  await page.goto(`${ORIGIN}/admin`, 3000);
  const adminLanding = await page.evaluate(`location.pathname`);
  check(
    "An administrator can open /admin",
    String(adminLanding.value) === "/admin",
    String(adminLanding.value),
  );

  const adminApi = JSON.parse(
    (await page.evaluate(callApi("/api/admin/languages"))).value ?? '{"status":0}',
  );
  check(
    "An administrator can call the admin API",
    adminApi.status === 200,
    `HTTP ${adminApi.status}`,
  );

  /* ------------------------------------------------------- no leakage */

  console.log("\n--- SECRETS ---");
  const pageSource = await page.evaluate(`(async () => {
    const html = await fetch("/dashboard").then(r => r.text());
    const scripts = [...document.querySelectorAll("script[src]")].map(s => s.src);
    const bundles = await Promise.all(scripts.slice(0, 12).map(src =>
      fetch(src).then(r => r.text()).catch(() => "")));
    return html + bundles.join("");
  })()`);
  const delivered = String(pageSource.value ?? "");
  const secret = process.env.AUTH_SECRET ?? "";
  const leaks = [
    ["AUTH_SECRET value", secret.length > 0 && delivered.includes(secret)],
    ["a scrypt hash", delivered.includes("scrypt$")],
    ["the database URL", delivered.includes("postgresql://")],
    ["the seed password", delivered.includes(PASSWORD)],
  ].filter(([, found]) => found);

  check(
    "No secret reaches the browser",
    leaks.length === 0,
    leaks.length ? leaks.map(([what]) => what).join(", ") : `${delivered.length} chars scanned`,
  );

  process.exitCode = summary() ? 0 : 1;
} catch (error) {
  console.log(`ERROR: ${error.stack ?? error}`);
  process.exitCode = 1;
} finally {
  chrome.kill();
  setTimeout(() => process.exit(process.exitCode ?? 0), 500);
}
