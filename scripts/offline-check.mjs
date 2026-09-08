/*
 * Offline verification: drives a real Chrome over CDP with the network cut.
 *
 *   npm run build && npm start        # the worker is inactive in dev
 *   node scripts/offline-check.mjs
 *
 * Headful on purpose. Headless Chrome discards service worker registrations —
 * `register()` resolves and `getRegistration()` then returns nothing — so the
 * cached-shell path, the one thing most worth checking, cannot be exercised
 * there at all.
 *
 * "Offline" here is Chrome's own network emulation applied to the page *and*
 * the service worker target, so requests genuinely fail rather than being
 * answered by a server that is still running.
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CHROME =
  process.env.CHROME_PATH ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ORIGIN = "http://localhost:3000";
const PORT = 9333;

const userDataDir = mkdtempSync(path.join(tmpdir(), "sstest-"));
const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=Translate,OptimizationGuideModelDownloading",
    "--window-size=1280,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const log = [];
const say = (line) => {
  log.push(line);
  console.log(line);
};

async function browserWs() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const json = await res.json();
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Chrome did not expose a debugging endpoint");
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.handlers = [];
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else {
        for (const handler of this.handlers) handler(msg);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout: ${method}`));
        }
      }, 120000);
    });
  }

  on(handler) {
    this.handlers.push(handler);
  }
}

const connect = (url) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", reject);
  });

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  say(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

try {
  const cdp = new CDP(await connect(await browserWs()));

  const sessions = new Set();
  cdp.on((msg) => {
    if (msg.method === "Target.attachedToTarget") {
      sessions.add(msg.params.sessionId);
    }
  });

  await cdp.send("Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  });

  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await cdp.send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  sessions.add(sessionId);

  await cdp.send("Page.enable", {}, sessionId);
  await cdp.send("Runtime.enable", {}, sessionId);
  await cdp.send("Network.enable", {}, sessionId);

  const evaluate = async (expression, session = sessionId) => {
    const res = await cdp.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      session,
    );
    if (res.exceptionDetails) {
      return { error: res.exceptionDetails.exception?.description ?? "threw" };
    }
    return { value: res.result.value };
  };

  const evaluateWithGesture = async (expression) => {
    const res = await cdp.send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true, userGesture: true },
      sessionId,
    );
    if (res.exceptionDetails) {
      return { error: res.exceptionDetails.exception?.description ?? "threw" };
    }
    return { value: res.result.value };
  };

  const goto = async (url) => {
    const loaded = new Promise((resolve) => {
      const handler = (msg) => {
        if (msg.method === "Page.loadEventFired" && msg.sessionId === sessionId) {
          cdp.handlers.splice(cdp.handlers.indexOf(handler), 1);
          resolve();
        }
      };
      cdp.on(handler);
    });
    await cdp.send("Page.navigate", { url }, sessionId);
    await loaded;
    // Give React a moment to hydrate and read IndexedDB.
    await new Promise((r) => setTimeout(r, 2500));
  };

  const setOffline = async (offline) => {
    for (const session of sessions) {
      try {
        await cdp.send("Network.enable", {}, session);
        await cdp.send(
          "Network.emulateNetworkConditions",
          {
            offline,
            latency: 0,
            downloadThroughput: offline ? 0 : -1,
            uploadThroughput: offline ? 0 : -1,
          },
          session,
        );
      } catch {
        // Some attached targets (e.g. the browser itself) have no Network
        // domain; the page and worker sessions are the ones that matter.
      }
    }
  };

  /* ------------------------------------------------------ online phase */

  say("\n--- ONLINE ---");
  await goto(`${ORIGIN}/offline-sync`);

  // The service worker registers after hydration; poll rather than assume.
  let registration = null;
  for (let i = 0; i < 20; i++) {
    const res = await evaluate(
      `navigator.serviceWorker.getRegistration().then(r => r ? (r.active ? "active" : "registered") : "none")`,
    );
    registration = res.value ?? res.error;
    if (registration === "active") break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  check(
    "Service worker registers and activates",
    registration === "active",
    String(registration),
  );

  // Download content to the device by pressing the real button.
  const clicked = await evaluate(`(() => {
    const button = [...document.querySelectorAll("button")]
      .find(b => b.textContent.trim().startsWith("Download for offline"));
    if (!button) return "button not found";
    button.click();
    return "clicked";
  })()`);
  check("Download for offline is pressable", clicked.value === "clicked", String(clicked.value ?? clicked.error));

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
    await new Promise((r) => setTimeout(r, 1000));
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

  const played = await evaluateWithGesture(`(async () => {
    const db = await new Promise((resolve) => {
      const req = indexedDB.open("shikshasetu-offline");
      req.onsuccess = () => resolve(req.result);
    });
    const clip = await new Promise((resolve) => {
      const r = db.transaction("audio").objectStore("audio").get("flashcard:offline-check");
      r.onsuccess = () => resolve(r.result);
    });
    if (!clip) return "clip not on device";
    const audio = new Audio(URL.createObjectURL(clip.blob));
    const ended = new Promise((resolve) => {
      audio.addEventListener("ended", () => resolve("ended"), { once: true });
      setTimeout(() => resolve("timeout"), 3000);
    });
    await audio.play();
    const how = await ended;
    return JSON.stringify({
      how,
      paused: audio.paused,
      duration: audio.duration,
      currentTime: audio.currentTime,
      readyState: audio.readyState,
    });
  })()`);
  check(
    "Cached audio plays with no network",
    String(played.value ?? "").includes('"how":"ended"') ||
      Number(JSON.parse(String(played.value ?? "{}")).currentTime ?? 0) > 0,
    String(played.value ?? played.error),
  );

  // Other cached routes.
  for (const route of ["/dashboard", "/offline-sync", "/curriculum"]) {
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
  say("\n--- SUMMARY ---");
  const failed = results.filter((r) => !r.pass);
  say(`${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) say(`Failed: ${failed.map((f) => f.name).join("; ")}`);
} catch (error) {
  say(`ERROR: ${error.stack ?? error}`);
} finally {
  chrome.kill();
  process.exit(0);
}
