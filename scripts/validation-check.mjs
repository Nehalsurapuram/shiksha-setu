/*
 * Human validation, end to end.
 *
 *   npm run build && npm start
 *   node scripts/validation-check.mjs
 *
 * The claim worth checking is not that the buttons exist. It is that approval
 * changes what a teacher is shown: that an expert's verdict, and only an
 * expert's verdict, turns a correction into verified text and a verified
 * glossary term — and that a rejected correction verifies nothing.
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
const PORT = 9347;

const probe = (...args) =>
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/validation-probe.ts", ...args],
    { encoding: "utf8" },
  ).trim();

const { check, summary } = reporter();
const chrome = launchChrome(PORT);

/**
 * Clicks a button inside the review card that mentions `marker`, and keeps
 * trying until the click actually lands.
 *
 * A single click is not enough: these forms are Server Actions, and one fired
 * before React has hydrated the page does nothing at all — silently. That
 * produced a "Reject does not work" failure against a Reject button that works
 * perfectly by hand.
 */
const actOnCard = (marker, buttonText) => `(async () => {
  const findCard = () => [...document.querySelectorAll("li")]
    .find(li => li.innerText.includes(${JSON.stringify(marker)}));

  for (let attempt = 0; attempt < 5; attempt++) {
    const card = findCard();
    if (!card) return "card not found";
    const button = [...card.querySelectorAll("button")]
      .find(b => b.textContent.trim() === ${JSON.stringify(buttonText)});
    if (!button) return attempt === 0
      ? "button not found: " + ${JSON.stringify(buttonText)}
      : "clicked";

    button.click();
    await new Promise(r => setTimeout(r, 2000));

    const after = findCard();
    // A card that is missing mid-render proves nothing; only a card that is
    // present and no longer offering this button means the click landed.
    if (after && ![...after.querySelectorAll("button")]
      .some(b => b.textContent.trim() === ${JSON.stringify(buttonText)})) return "clicked";
  }
  return "click never took effect";
})()`;

/**
 * Presses a button and waits for the database to show the effect.
 *
 * These are Server Action forms: a click fired before React hydrates does
 * nothing, silently, and the page looks identical either way. Reloading and
 * pressing again is what a person would do, and the database is the only
 * witness worth believing.
 */
async function actUntilRecorded(page, marker, buttonText, verify) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto(`${ORIGIN}/expert/review`, 4000);
    await page.evaluate(actOnCard(marker, buttonText), { userGesture: true });
    await wait(1500);
    const row = verify();
    if (row) return { landed: true, row, attempts: attempt + 1 };
  }
  return { landed: false, row: verify(), attempts: 4 };
}

try {
  console.log("--- RESET ---");
  console.log(`cleared: ${probe("reset")}`);

  const approved = JSON.parse(
    probe("seed-correction", "जड़", "AI SANTHALI FOR ROOT", "TEACHER SANTHALI FOR ROOT"),
  );
  const rejected = JSON.parse(
    probe("seed-correction", "पत्ती", "AI SANTHALI FOR LEAF", "WRONG TEACHER TEXT"),
  );
  const expertWrites = JSON.parse(
    probe("seed-correction", "तना", "AI SANTHALI FOR STEM", "TEACHER TEXT FOR STEM"),
  );
  console.log("seeded three corrections awaiting review");

  const cdp = new CDP(await connect(await browserWebSocket(PORT)));
  const page = await openPage(cdp);

  /* ------------------------------------------------------- the screen */

  console.log("\n--- /expert/review ---");
  await page.goto(`${ORIGIN}/expert/review`);

  const body = await page.evaluate(`document.body.innerText`);
  const text = String(body.value ?? "");

  check("The review screen renders", text.includes("Expert review"), `${text.length} chars`);
  check(
    "Hindi, AI Santhali and the teacher's correction are all shown",
    text.includes("जड़") &&
      text.includes("AI SANTHALI FOR ROOT") &&
      text.includes("TEACHER SANTHALI FOR ROOT"),
    "",
  );
  check(
    "The three panels are labelled, not just laid out",
    text.includes("AI TRANSLATION") && text.includes("TEACHER'S CORRECTION"),
    "",
  );
  check(
    "The chain AI → correction → verified is on the page",
    text.includes("AI translation") &&
      text.includes("Teacher / expert correction") &&
      text.includes("Verified translation"),
    "",
  );
  check(
    "It states there is no sign-in on this prototype",
    text.includes("no sign-in"),
    "",
  );

  const buttons = await page.evaluate(`(() => {
    const labels = [...document.querySelectorAll("button")].map(b => b.textContent.trim());
    return ["Approve", "Correct", "Reject"].filter(l => labels.includes(l)).join(",");
  })()`);
  check(
    "Approve, Correct and Reject are present",
    String(buttons.value) === "Approve,Correct,Reject",
    String(buttons.value),
  );

  /* ---------------------------------------------------------- approve */

  console.log("\n--- APPROVE ---");
  const approveOutcome = await actUntilRecorded(
    page,
    "TEACHER SANTHALI FOR ROOT",
    "Approve",
    () => {
      const row = JSON.parse(probe("correction", approved.translationId));
      return row?.status === "APPROVED" ? row : null;
    },
  );
  check(
    "Approve is actionable",
    approveOutcome.landed,
    `${approveOutcome.attempts} attempt(s)`,
  );

  const approvedRow = approveOutcome.row ?? JSON.parse(probe("correction", approved.translationId));
  check(
    "The correction is APPROVED and attributed to the expert",
    approvedRow?.status === "APPROVED" && approvedRow?.reviewedBy?.role === "LANGUAGE_EXPERT",
    JSON.stringify({ status: approvedRow?.status, by: approvedRow?.reviewedBy }),
  );
  check(
    "The AI translation was kept alongside the correction",
    approvedRow?.aiTranslation === "AI SANTHALI FOR ROOT",
    JSON.stringify(approvedRow?.aiTranslation),
  );

  /* ----------------------------------------------------------- reject */

  console.log("\n--- REJECT ---");
  const rejectOutcome = await actUntilRecorded(page, "WRONG TEACHER TEXT", "Reject", () => {
    const row = JSON.parse(probe("correction", rejected.translationId));
    return row?.status === "REJECTED" ? row : null;
  });
  check(
    "Reject is actionable",
    rejectOutcome.landed,
    `${rejectOutcome.attempts} attempt(s)`,
  );

  const rejectedRow = rejectOutcome.row ?? JSON.parse(probe("correction", rejected.translationId));
  check(
    "The rejected correction is recorded as REJECTED",
    rejectedRow?.status === "REJECTED",
    JSON.stringify(rejectedRow?.status),
  );

  /* ------------------------------------------- expert writes their own */

  console.log("\n--- CORRECT (expert's own wording) ---");
  await page.goto(`${ORIGIN}/expert/review`, 4000);
  let openEditor = await page.evaluate(actOnCard("TEACHER TEXT FOR STEM", "Correct"), {
    userGesture: true,
  });
  if (openEditor.value !== "clicked") {
    await page.goto(`${ORIGIN}/expert/review`, 5000);
    openEditor = await page.evaluate(actOnCard("TEACHER TEXT FOR STEM", "Correct"), {
      userGesture: true,
    });
  }
  check("Correct opens the expert's editor", openEditor.value === "clicked", String(openEditor.value));

  const wrote = await page.evaluate(`(async () => {
    const cards = [...document.querySelectorAll("li")]
      .filter(li => li.innerText.includes("TEACHER TEXT FOR STEM"));
    const card = cards[0];
    if (!card) return "card gone";
    const box = card.querySelector("textarea");
    if (!box) return "no textarea";
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(box, "EXPERT WORDING FOR STEM");
    box.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    const save = [...card.querySelectorAll("button")].find(b => b.textContent.trim() === "Save as verified");
    if (!save) return "no save button";
    save.click();
    await new Promise(r => setTimeout(r, 2500));
    return "saved";
  })()`);
  check("The expert's wording saves", wrote.value === "saved", String(wrote.value ?? wrote.error));

  const expertRow = JSON.parse(probe("correction", expertWrites.translationId));
  check(
    "The expert's text is stored without overwriting the teacher's",
    expertRow?.expertText === "EXPERT WORDING FOR STEM" &&
      expertRow?.correctedText === "TEACHER TEXT FOR STEM",
    JSON.stringify({ expert: expertRow?.expertText, teacher: expertRow?.correctedText }),
  );

  /* -------------------------------------------------- verified glossary */

  console.log("\n--- PROMOTE TO VERIFIED GLOSSARY ---");
  await page.goto(`${ORIGIN}/expert/review`, 4000);
  let openPromote = await page.evaluate(
    actOnCard("TEACHER SANTHALI FOR ROOT", "Add to verified glossary"),
    { userGesture: true },
  );
  if (openPromote.value !== "clicked") {
    await page.goto(`${ORIGIN}/expert/review`, 5000);
    openPromote = await page.evaluate(
      actOnCard("TEACHER SANTHALI FOR ROOT", "Add to verified glossary"),
      { userGesture: true },
    );
  }
  check(
    "Approved corrections offer promotion",
    openPromote.value === "clicked",
    String(openPromote.value),
  );

  const promoted = await page.evaluate(`(async () => {
    const cards = [...document.querySelectorAll("li")]
      .filter(li => li.innerText.includes("TEACHER SANTHALI FOR ROOT"));
    const card = cards[0];
    if (!card) return "card gone";
    const save = [...card.querySelectorAll("button")].find(b => b.textContent.trim() === "Save verified term");
    if (!save) return "no save button";
    save.click();
    await new Promise(r => setTimeout(r, 2500));
    return "saved";
  })()`);
  check("The term saves", promoted.value === "saved", String(promoted.value ?? promoted.error));

  const term = JSON.parse(probe("glossary", "जड़"));
  check(
    "It is a verified glossary term, traceable to the approval",
    term?.isVerified === true && term?.sourceCorrectionId === approved.correctionId,
    JSON.stringify(term),
  );
  check(
    "Verification is attributed to the language expert",
    term?.createdBy?.role === "LANGUAGE_EXPERT",
    JSON.stringify(term?.createdBy),
  );

  const rejectedTerm = JSON.parse(probe("glossary", "पत्ती"));
  check(
    "A rejected correction produced no verified term",
    rejectedTerm === null,
    JSON.stringify(rejectedTerm),
  );

  /* -------------------------------------- the verified term is now used */

  console.log("\n--- THE TRANSLATOR USES IT ---");
  const translated = await page.evaluate(`fetch("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceLanguage: "hi-IN", targetLanguage: "sat-IN", text: "जड़" }),
  }).then(r => r.json()).then(j => JSON.stringify({
    text: j.translatedText, provider: j.provider, verifiedBy: j.verifiedBy,
    approver: j.verifiedApprover, isDemo: j.isDemo,
  }))`);
  const outcome = JSON.parse(String(translated.value ?? "{}"));
  check(
    "Translating that term returns the verified text, not a model's",
    outcome.text === "TEACHER SANTHALI FOR ROOT" && outcome.verifiedBy === "glossary",
    JSON.stringify(outcome),
  );
  check(
    "It is not labelled a demo result even with no API key",
    outcome.isDemo === false,
    JSON.stringify(outcome.isDemo),
  );

  await page.goto(`${ORIGIN}/translator`);
  const shown = await page.evaluate(`(async () => {
    const box = document.querySelector("textarea");
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(box, "जड़");
    box.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise(r => setTimeout(r, 300));
    const go = [...document.querySelectorAll("button")].find(b => b.textContent.includes("Translate"));
    if (!go) return "no translate button";
    go.click();
    await new Promise(r => setTimeout(r, 4000));
    return document.body.innerText;
  })()`);
  const shownText = String(shown.value ?? "");
  check(
    "The translator labels it verified rather than machine output",
    shownText.includes("Verified term") && shownText.includes("No model was asked"),
    shownText.includes("Verified term") ? "labelled" : shownText.slice(0, 200).replace(/\\s+/g, " "),
  );

  process.exitCode = summary() ? 0 : 1;
} catch (error) {
  console.log(`ERROR: ${error.stack ?? error}`);
  process.exitCode = 1;
} finally {
  chrome.kill();
  setTimeout(() => process.exit(process.exitCode ?? 0), 500);
}
