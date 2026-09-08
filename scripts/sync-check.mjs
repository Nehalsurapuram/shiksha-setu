/*
 * Two-way sync verification, with the network genuinely cut.
 *
 *   npm run build && npm start
 *   node scripts/sync-check.mjs
 *
 * The property worth proving is not that sync works when nothing goes wrong.
 * It is that a correction typed with no signal survives, reaches the server
 * when one appears, and that a change made against a stale copy never buries
 * somebody else's newer work. So this drives the real UI offline, edits the
 * database behind the tablet's back to stand in for a second device, and then
 * reads the database directly rather than believing the screen.
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
const PORT = 9335;

const probe = (...args) =>
  execFileSync("npx", ["tsx", "scripts/sync-probe.ts", ...args], {
    encoding: "utf8",
    shell: process.platform === "win32",
  }).trim();

const { check, summary } = reporter();
const chrome = launchChrome(PORT);

const readOutbox = `(async () => {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open("shikshasetu-offline");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const rows = await new Promise((resolve) => {
    const r = db.transaction("outbox").objectStore("outbox").getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve([]);
  });
  return JSON.stringify(rows.map(row => ({
    entityId: row.entityId,
    status: row.status,
    operation: row.operation,
    text: row.payload.correctedText,
    force: row.force,
    conflict: row.conflict ? row.conflict.serverText : null,
  })));
})()`;

const readTranslations = `(async () => {
  const db = await new Promise((resolve) => {
    const req = indexedDB.open("shikshasetu-offline");
    req.onsuccess = () => resolve(req.result);
  });
  const rows = await new Promise((resolve) => {
    const r = db.transaction("translations").objectStore("translations").getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => resolve([]);
  });
  return JSON.stringify(rows.slice(0, 3).map(row => ({
    id: row.id,
    text: row.correctedText ?? row.targetText,
    updatedAt: row.updatedAt,
  })));
})()`;

/** Types a correction through the real UI on the Translations tab. */
const correctInLibrary = (index, text) => `(async () => {
  const tab = [...document.querySelectorAll("button")]
    .find(b => b.textContent.trim().startsWith("Translations"));
  if (!tab) return "no translations tab";
  tab.click();
  await new Promise(r => setTimeout(r, 600));

  const buttons = [...document.querySelectorAll("button")]
    .filter(b => b.textContent.trim() === "Correct");
  if (buttons.length <= ${index}) return "no correct button at index ${index}";
  buttons[${index}].click();
  await new Promise(r => setTimeout(r, 600));

  const box = document.querySelector("textarea");
  if (!box) return "no editor";
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, "value").set;
  setter.call(box, ${JSON.stringify(text)});
  box.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise(r => setTimeout(r, 300));

  const save = [...document.querySelectorAll("button")]
    .find(b => b.textContent.trim() === "Save correction");
  if (!save) return "no save button";
  save.click();
  await new Promise(r => setTimeout(r, 1200));
  return "saved";
})()`;

try {
  console.log("--- RESET ---");
  console.log(`cleared: ${probe("reset")}`);

  const cdp = new CDP(await connect(await browserWebSocket(PORT)));
  const page = await openPage(cdp);

  /* ------------------------------------------------------------- online */

  console.log("\n--- ONLINE: download content ---");
  await page.goto(`${ORIGIN}/offline`);

  let registration = "none";
  for (let i = 0; i < 20; i++) {
    const res = await page.evaluate(
      `navigator.serviceWorker.getRegistration().then(r => r && r.active ? "active" : "waiting")`,
    );
    registration = res.value ?? "none";
    if (registration === "active") break;
    await wait(1000);
  }
  check("Service worker active", registration === "active", registration);

  const synced = await page.evaluate(`(() => {
    const b = [...document.querySelectorAll("button")].find(b => b.textContent.trim().startsWith("Sync now"));
    if (!b) return "no sync button";
    b.click();
    return "clicked";
  })()`);
  check("Sync now is present on /offline", synced.value === "clicked", String(synced.value));

  let translations = [];
  for (let i = 0; i < 30; i++) {
    const res = await page.evaluate(readTranslations);
    translations = JSON.parse(res.value ?? "[]");
    if (translations.length >= 3) break;
    await wait(1000);
  }
  check(
    "Translations downloaded to the device",
    translations.length >= 3,
    `${translations.length} read back`,
  );

  const [mine, rivalWins, mineWins] = translations;

  /* ------------------------------------------------------------ offline */

  console.log("\n--- OFFLINE: correct three translations with no network ---");
  await page.setOffline(true);

  const offlineConfirmed = await page.evaluate(
    `fetch("/api/health").then(() => "reachable").catch(() => "failed")`,
  );
  check(
    "Network is genuinely cut",
    offlineConfirmed.value === "failed",
    String(offlineConfirmed.value),
  );

  await page.goto(`${ORIGIN}/library`);

  const typed = await page.evaluate(correctInLibrary(0, "OFFLINE CORRECTION ONE"));
  check("A correction can be typed offline", typed.value === "saved", String(typed.value));

  const badge = await page.evaluate(`document.body.innerText.includes("Waiting to upload")`);
  check("The row shows it is waiting to upload", badge.value === true, String(badge.value));

  await page.evaluate(correctInLibrary(1, "MY VERSION FOR THE CONFLICT"));
  await page.evaluate(correctInLibrary(2, "MY VERSION I WILL KEEP"));

  let queue = JSON.parse((await page.evaluate(readOutbox)).value ?? "[]");
  check(
    "Three changes are queued on the device",
    queue.length === 3 && queue.every((row) => row.status === "PENDING"),
    JSON.stringify(queue.map((row) => row.status)),
  );

  // Nothing may have reached the server: there was no server to reach.
  const beforeSync = JSON.parse(probe("latest-correction", mine.id));
  check(
    "Nothing reached the server while offline",
    beforeSync === null,
    JSON.stringify(beforeSync),
  );

  /* --------------------------------------- another device edits the row */

  console.log("\n--- MEANWHILE: another device corrects two of the same rows ---");
  probe("rival-correction", rivalWins.id, "ANOTHER TEACHERS VERSION");
  probe("rival-correction", mineWins.id, "ANOTHER TEACHERS VERSION TOO");
  check("Rival corrections written straight to the database", true, "2 rows");

  /* ------------------------------------------------ internet comes back */

  console.log("\n--- ONLINE AGAIN: the queue drains by itself ---");
  await page.setOffline(false);
  // The `online` event fires on the page; SyncOnReconnect drains from there.
  await page.evaluate(`window.dispatchEvent(new Event("online"))`);
  await wait(6000);

  queue = JSON.parse((await page.evaluate(readOutbox)).value ?? "[]");
  const clean = queue.find((row) => row.entityId === mine.id);
  check(
    "The uncontested change synced without being asked",
    clean?.status === "SYNCED",
    JSON.stringify(queue.map((row) => `${row.status}`)),
  );

  const landed = JSON.parse(probe("latest-correction", mine.id));
  check(
    "It is in the database, with the teacher's text",
    landed?.correctedText === "OFFLINE CORRECTION ONE",
    JSON.stringify(landed?.correctedText),
  );

  /* ------------------------------------------------------------ conflict */

  const conflicted = queue.filter((row) => row.status === "CONFLICT");
  check(
    "Both stale changes came back as conflicts",
    conflicted.length === 2,
    JSON.stringify(queue.map((row) => row.status)),
  );

  const rivalStill = JSON.parse(probe("latest-correction", rivalWins.id));
  check(
    "The other teacher's newer text was NOT overwritten",
    rivalStill?.correctedText === "ANOTHER TEACHERS VERSION",
    JSON.stringify(rivalStill?.correctedText),
  );

  const items = JSON.parse(probe("sync-items"));
  check(
    "The server recorded the queue: 1 synced, 2 conflicts",
    items.filter((i) => i.status === "SYNCED").length === 1 &&
      items.filter((i) => i.status === "CONFLICT").length === 2,
    JSON.stringify(items.map((i) => i.status)),
  );

  /* -------------------------------------------------- teacher decides */

  console.log("\n--- RESOLVING: one each way ---");
  await page.goto(`${ORIGIN}/offline`);

  const conflictShown = await page.evaluate(`(() => {
    const text = document.body.innerText;
    return text.includes("changed somewhere else") &&
      text.includes("ANOTHER TEACHERS VERSION") &&
      text.includes("MY VERSION FOR THE CONFLICT");
  })()`);
  check(
    "The Sync Center shows both versions side by side",
    conflictShown.value === true,
    String(conflictShown.value),
  );

  // Keep the server's on the first conflict shown.
  const keptTheirs = await page.evaluate(`(async () => {
    const cards = [...document.querySelectorAll("div")].filter(d =>
      d.className.includes("border-warning") && d.innerText.includes("MY VERSION FOR THE CONFLICT"));
    const card = cards[cards.length - 1];
    if (!card) return "conflict card not found";
    const button = [...card.querySelectorAll("button")].find(b => b.textContent.includes("Keep the server"));
    if (!button) return "no keep-server button";
    button.click();
    await new Promise(r => setTimeout(r, 1500));
    return "clicked";
  })()`);
  check("Keep the server's is actionable", keptTheirs.value === "clicked", String(keptTheirs.value));

  // Keep mine on the second, then upload.
  const keptMine = await page.evaluate(`(async () => {
    const cards = [...document.querySelectorAll("div")].filter(d =>
      d.className.includes("border-warning") && d.innerText.includes("MY VERSION I WILL KEEP"));
    const card = cards[cards.length - 1];
    if (!card) return "conflict card not found";
    const button = [...card.querySelectorAll("button")].find(b => b.textContent.trim() === "Keep mine");
    if (!button) return "no keep-mine button";
    button.click();
    await new Promise(r => setTimeout(r, 1200));

    const upload = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Upload changes"));
    if (!upload) return "no upload button";
    upload.click();
    await new Promise(r => setTimeout(r, 3000));
    return "uploaded";
  })()`);
  check("Keep mine re-sends the change", keptMine.value === "uploaded", String(keptMine.value));

  const mineLanded = JSON.parse(probe("latest-correction", mineWins.id));
  check(
    "Keeping mine overwrites only after the teacher chose it",
    mineLanded?.correctedText === "MY VERSION I WILL KEEP",
    JSON.stringify(mineLanded?.correctedText),
  );

  const theirsKept = JSON.parse(probe("latest-correction", rivalWins.id));
  check(
    "Keeping theirs left the server untouched",
    theirsKept?.correctedText === "ANOTHER TEACHERS VERSION",
    JSON.stringify(theirsKept?.correctedText),
  );

  queue = JSON.parse((await page.evaluate(readOutbox)).value ?? "[]");
  check(
    "No conflicts remain in the queue",
    queue.filter((row) => row.status === "CONFLICT").length === 0,
    JSON.stringify(queue.map((row) => row.status)),
  );

  const localAfter = JSON.parse((await page.evaluate(readTranslations)).value ?? "[]");
  const localRival = localAfter.find((row) => row.id === rivalWins.id);
  check(
    "The device took the server's text where the teacher chose it",
    localRival?.text === "ANOTHER TEACHERS VERSION",
    JSON.stringify(localRival?.text),
  );

  process.exitCode = summary() ? 0 : 1;
} catch (error) {
  console.log(`ERROR: ${error.stack ?? error}`);
  process.exitCode = 1;
} finally {
  chrome.kill();
  setTimeout(() => process.exit(process.exitCode ?? 0), 500);
}
