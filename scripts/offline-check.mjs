/*
 * Offline verification: drives a real Chrome over CDP with the network cut.
 *
 *   npm run build && npm start        # the worker is inactive in dev
 *   node scripts/offline-check.mjs
 *
 * "Offline" here is Chrome's own network emulation applied to the page *and*
 * the service worker target, so requests genuinely fail rather than being
 * answered by a server that is still running.
 */
import {
  CDP,
  browserWebSocket,
  connect,
  launchChrome,
  openPage,
  reporter,
  signIn,
  wait,
} from "./cdp.mjs";

const ORIGIN = "http://localhost:3000";
const PORT = 9333;

const chrome = launchChrome(PORT);
const { check, summary } = reporter();
const say = (line) => console.log(line);

try {
  const cdp = new CDP(await connect(await browserWebSocket(PORT)));
  const page = await openPage(cdp);

  // Since Phase 13 the app requires a session; everything below acts as a
  // real signed-in user rather than as an anonymous caller.
  await signIn(page, ORIGIN, "teacher@shikshasetu.local");
  const { evaluate, goto, setOffline } = page;
  const evaluateWithGesture = (expression) =>
    evaluate(expression, { userGesture: true });

  /* ------------------------------------------------------ online phase */

  say("\n--- ONLINE ---");
  await goto(`${ORIGIN}/offline`);

  // The service worker registers after hydration; poll rather than assume.
  let registration = null;
  for (let i = 0; i < 20; i++) {
    const res = await evaluate(
      `navigator.serviceWorker.getRegistration().then(r => r ? (r.active ? "active" : "registered") : "none")`,
    );
    registration = res.value ?? res.error;
    if (registration === "active") break;
    await wait(1000);
  }
  check(
    "Service worker registers and activates",
    registration === "active",
    String(registration),
  );

  // Download content to the device by pressing the real button.
  const clicked = await evaluate(`(() => {
    const button = [...document.querySelectorAll("button")]
      .find(b => b.textContent.trim().startsWith("Sync now"));
    if (!button) return "button not found";
    button.click();
    return "clicked";
  })()`);
  check("Sync now is pressable", clicked.value === "clicked", String(clicked.value ?? clicked.error));

  const countScript = `(async () => {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("shikshasetu-offline");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const out = {};
    for (const name of [...db.objectStoreNames]) {
      out[name] = await new Promise((resolve) => {
        const r = db.transaction(name).objectStore(name).count();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(-1);
      });
    }
    return out;
  })()`;

  let counts = {};
  for (let i = 0; i < 30; i++) {
    const res = await evaluate(countScript);
    counts = res.value ?? {};
    if ((counts.lessons ?? 0) > 0 || (counts.translations ?? 0) > 0) break;
    await wait(1000);
  }
  check(
    "Content written to IndexedDB",
    Object.values(counts).some((n) => n > 0),
    JSON.stringify(counts),
  );
  check(
    "Curriculum store exists on the device",
    Object.prototype.hasOwnProperty.call(counts, "curriculum"),
    `curriculum rows: ${counts.curriculum}`,
  );

  // Nothing secret may be in the bundle that lands in IndexedDB.
  const bundle = await evaluate(
    `fetch("/api/offline/bundle").then(r => r.text()).then(t => t.slice(0, 400000))`,
  );
  const text = String(bundle.value ?? "");
  const leaked = ["sk-", "SARVAM", "sarvam_", "DATABASE_URL", "postgres://", "postgresql://", "api_key", "apiKey", "Bearer "].filter(
    (needle) => text.includes(needle),
  );
  check("No credentials in the offline bundle", leaked.length === 0, leaked.join(", ") || "none found");

  const seeded = await evaluate(`(async () => {
    // A real 0.3s WAV, built in the page: 44-byte header plus PCM samples.
    const rate = 8000, seconds = 0.3, samples = rate * seconds;
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    const ascii = (offset, text) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
    ascii(0, "RIFF"); view.setUint32(4, 36 + samples * 2, true); ascii(8, "WAVEfmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    ascii(36, "data"); view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) {
      view.setInt16(44 + i * 2, Math.sin((i / rate) * 2 * Math.PI * 440) * 12000, true);
    }
    const blob = new Blob([buffer], { type: "audio/wav" });

    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open("shikshasetu-offline");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("audio", "readwrite");
      tx.objectStore("audio").put({
        id: "flashcard:offline-check",
        ownerKey: "flashcard:offline-check",
        languageCode: "hi-IN",
        transcript: "offline playback check",
        mimeType: "audio/wav",
        blob,
        sizeBytes: blob.size,
        cachedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return blob.size;
  })()`);
  check(
    "An audio clip can be stored as bytes on the device",
    Number(seeded.value ?? 0) > 1000,
    `${seeded.value ?? seeded.error} bytes`,
  );

  const manifest = await evaluate(
    `fetch("/manifest.webmanifest").then(r => r.json()).then(m => JSON.stringify({icons: m.icons.map(i => i.src + " " + i.sizes), start: m.start_url, display: m.display}))`,
  );
  check(
    "Manifest serves PNG icons for install",
    String(manifest.value ?? "").includes("icon-192.png"),
    String(manifest.value ?? manifest.error),
  );

  /* ----------------------------------------------------- offline phase */

  say("\n--- OFFLINE (network emulated off on page + worker targets) ---");
  await setOffline(true);

  const online = await evaluate(`navigator.onLine`);
  check("navigator.onLine is false", online.value === false, String(online.value));

  const health = await evaluate(
    `fetch("/api/health").then(() => "reachable").catch(() => "failed")`,
  );
  check("Network is genuinely cut (API fetch fails)", health.value === "failed", String(health.value));

  // Saved content page, loaded with no network at all.
  await goto(`${ORIGIN}/library`);

  const libraryBody = await evaluate(`document.body.innerText`);
  const body = String(libraryBody.value ?? "");
  check("/library loads offline from the cached shell", body.length > 200, `${body.length} chars rendered`);
  check("Header shows Offline", body.includes("Offline"), "");
  check(
    "Saved content is listed offline",
    body.includes("Saved content") && !body.includes("Nothing is saved on this device yet"),
    body.slice(0, 160).replace(/\s+/g, " "),
  );

  const tabs = await evaluate(`(() => {
    const labels = [...document.querySelectorAll("button")].map(b => b.textContent.trim());
    return labels.filter(l => /^(Lessons|Worksheets|Flashcards|Assessments|Translations|Audio|Curriculum)/.test(l)).join(" | ");
  })()`);
  check("Offline tabs include Audio and Curriculum", String(tabs.value ?? "").includes("Audio") && String(tabs.value ?? "").includes("Curriculum"), String(tabs.value));

  // Open a saved lesson with no network.
  const opened = await evaluate(`(async () => {
    const open = [...document.querySelectorAll("button")].find(b => b.textContent.trim() === "Open");
    if (!open) return "no lesson to open";
    open.click();
    await new Promise(r => setTimeout(r, 1500));
    // innerText reflects CSS, and the section label is uppercased.
    const text = document.body.innerText.toLowerCase();
    return text.includes("source text") && text.includes("close")
      ? "lesson body rendered"
      : "opened but no body :: " + text.slice(0, 600).replace(/\s+/g, " ");
  })()`);
  check("A saved lesson opens offline", opened.value === "lesson body rendered", String(opened.value ?? opened.error));

  // Curriculum tab, offline.
  const curriculumTab = await evaluate(`(async () => {
    const tab = [...document.querySelectorAll("button")].find(b => b.textContent.trim().startsWith("Curriculum"));
    if (!tab) return "no curriculum tab";
    tab.click();
    await new Promise(r => setTimeout(r, 800));
    return document.body.innerText.includes("Curriculum on this device") ? "rendered" : "clicked but not rendered";
  })()`);
  check("Curriculum reads from the device offline", curriculumTab.value === "rendered", String(curriculumTab.value ?? curriculumTab.error));

  const audioTab = await evaluate(`(async () => {
    const tab = [...document.querySelectorAll("button")].find(b => b.textContent.trim().startsWith("Audio"));
    if (!tab) return "no audio tab";
    tab.click();
    await new Promise(r => setTimeout(r, 800));
    return document.body.innerText.includes("offline playback check") ? "listed" : "tab open, clip missing";
  })()`);
  check("Cached audio is listed offline", audioTab.value === "listed", String(audioTab.value ?? audioTab.error));

  /*
   * Two questions, deliberately separated.
   *
   * "Do the cached bytes decode?" is about this application: the clip came out
   * of IndexedDB with no network and the browser could read it as audio.
   * "Did it come out of the speakers?" also depends on the machine having a
   * working audio output, which a headless-ish test profile may not — after
   * this laptop slept, `play()` stopped settling at all. Reporting that as an
   * offline-cache failure would be blaming the app for the room.
   */
  const decoded = await evaluate(`(async () => {
    const db = await new Promise((resolve) => {
      const req = indexedDB.open("shikshasetu-offline");
      req.onsuccess = () => resolve(req.result);
    });
    const clip = await new Promise((resolve) => {
      const r = db.transaction("audio").objectStore("audio").get("flashcard:offline-check");
      r.onsuccess = () => resolve(r.result);
    });
    if (!clip) return JSON.stringify({ error: "clip not on device" });

    const audio = new Audio(URL.createObjectURL(clip.blob));
    const ready = await new Promise((resolve) => {
      audio.addEventListener("loadedmetadata", () => resolve("metadata"), { once: true });
      audio.addEventListener("error", () => resolve("decode error"), { once: true });
      setTimeout(() => resolve("timeout"), 8000);
    });
    return JSON.stringify({
      ready,
      duration: audio.duration,
      bytes: clip.blob.size,
      type: clip.mimeType,
    });
  })()`);

  const decodedInfo = JSON.parse(String(decoded.value ?? "{}"));
  check(
    "Cached audio decodes from IndexedDB with no network",
    decodedInfo.ready === "metadata" && Number(decodedInfo.duration) > 0,
    String(decoded.value ?? decoded.error),
  );

  // Playback itself, bounded so a machine that cannot open an audio device
  // fails fast instead of hanging the run inside `play()`.
  const playScript = (source) => `(async () => {
    const audio = ${source};
    const settled = await Promise.race([
      audio.play().then(() => "started").catch((e) => "rejected: " + e.name),
      new Promise((r) => setTimeout(() => r("play() never settled"), 4000)),
    ]);
    if (settled !== "started") return JSON.stringify({ settled });
    await new Promise((r) => {
      audio.addEventListener("ended", r, { once: true });
      setTimeout(r, 3000);
    });
    return JSON.stringify({ settled, currentTime: audio.currentTime });
  })()`;

  const fromDevice = await evaluateWithGesture(playScript(`await (async () => {
    const db = await new Promise((resolve) => {
      const req = indexedDB.open("shikshasetu-offline");
      req.onsuccess = () => resolve(req.result);
    });
    const clip = await new Promise((resolve) => {
      const r = db.transaction("audio").objectStore("audio").get("flashcard:offline-check");
      r.onsuccess = () => resolve(r.result);
    });
    return new Audio(URL.createObjectURL(clip.blob));
  })()`));

  const devicePlay = JSON.parse(String(fromDevice.value ?? "{}"));
  if (Number(devicePlay.currentTime ?? 0) > 0) {
    check(
      "Cached audio plays with no network",
      true,
      String(fromDevice.value),
    );
  } else {
    // Control: a clip that never touched IndexedDB, played the same way. If
    // this fails too, the machine has no working audio and neither result says
    // anything about the cache.
    const control = await evaluateWithGesture(
      playScript(`new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=")`),
    );
    const controlPlay = JSON.parse(String(control.value ?? "{}"));
    const machineCanPlay = controlPlay.settled === "started";

    check(
      machineCanPlay
        ? "Cached audio plays with no network"
        : "Cached audio playback SKIPPED — this machine has no working audio output",
      !machineCanPlay,
      `device: ${fromDevice.value ?? fromDevice.error} | control: ${control.value ?? control.error}`,
    );
  }

  // Other cached routes.
  for (const route of ["/dashboard", "/offline", "/curriculum"]) {
    await goto(`${ORIGIN}${route}`);
    const res = await evaluate(`document.body.innerText.length`);
    check(`${route} opens offline`, Number(res.value ?? 0) > 200, `${res.value} chars`);
  }

  // A cloud feature must NOT pretend to work.
  await goto(`${ORIGIN}/translator`);
  const translator = await evaluate(`document.body.innerText`);
  const tBody = String(translator.value ?? "");
  check(
    "Translator is not silently served from cache",
    tBody.includes("offline") || tBody.includes("Offline") || tBody.includes("no internet"),
    tBody.slice(0, 200).replace(/\s+/g, " "),
  );

  await setOffline(false);
  process.exitCode = summary() ? 0 : 1;
} catch (error) {
  say(`ERROR: ${error.stack ?? error}`);
  process.exitCode = 1;
} finally {
  chrome.kill();
  setTimeout(() => process.exit(process.exitCode ?? 0), 500);
}
