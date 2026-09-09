/*
 * A minimal Chrome DevTools Protocol driver, shared by the offline and sync
 * checks.
 *
 * There is no Playwright or Puppeteer in this project, and neither is worth a
 * dependency for two scripts: Node has `fetch` and a global `WebSocket`, which
 * is all CDP needs.
 *
 * Headful throughout. Headless Chrome discards service worker registrations —
 * `register()` resolves and `getRegistration()` then returns nothing — so the
 * offline behaviour this project depends on cannot be exercised there.
 */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const CHROME =
  process.env.CHROME_PATH ??
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

export function launchChrome(port) {
  const userDataDir = mkdtempSync(path.join(tmpdir(), "shiksha-check-"));
  return spawn(
    CHROME,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=Translate,OptimizationGuideModelDownloading",
      "--window-size=1280,900",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
}

export async function browserWebSocket(port) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const json = await res.json();
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
    } catch {
      // Chrome is still starting.
    }
    await wait(500);
  }
  throw new Error("Chrome did not expose a debugging endpoint");
}

export class CDP {
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
        // Over a copy: a handler that removes itself (the navigation waiter
        // does) would otherwise shift the array mid-iteration and silently
        // skip the handler after it.
        for (const handler of [...this.handlers]) handler(msg);
      }
    });
  }

  send(method, params = {}, sessionId, timeoutMs = 30000) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`timeout: ${method}`));
        }
      }, timeoutMs);
    });
  }

  off(handler) {
    const index = this.handlers.indexOf(handler);
    // Guarded: indexOf(-1) with splice would remove the *last* handler, which
    // is somebody else's.
    if (index >= 0) this.handlers.splice(index, 1);
  }

  on(handler) {
    this.handlers.push(handler);
  }
}

export const connect = (url) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", reject);
  });

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Opens a page target and returns helpers bound to it.
 *
 * Auto-attach is on so the service worker's own target is captured too: network
 * emulation is per target, and emulating offline on the page alone leaves the
 * worker free to reach the network, which is not what any teacher experiences.
 */
export async function openPage(cdp) {
  const sessions = new Set();
  cdp.on((msg) => {
    if (msg.method === "Target.attachedToTarget") sessions.add(msg.params.sessionId);
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

  const evaluate = async (expression, { userGesture = false, timeoutMs = 30000 } = {}) => {
    let res;
    try {
      res = await cdp.send(
        "Runtime.evaluate",
        { expression, awaitPromise: true, returnByValue: true, userGesture },
        sessionId,
        timeoutMs,
      );
    } catch (error) {
      // A blocked renderer or a destroyed context is a finding, not a reason
      // to abandon the whole run.
      return { error: String(error.message ?? error) };
    }
    if (res.exceptionDetails) {
      return { error: res.exceptionDetails.exception?.description ?? "threw" };
    }
    return { value: res.result.value };
  };

  /**
   * Navigates and waits for the document to be usable.
   *
   * Polls `readyState` rather than waiting on `Page.loadEventFired` alone: the
   * event is a single shot, and if it is missed — a race with the navigation
   * command, a target that reloaded itself — the wait never ends and the whole
   * run dies at the first page.
   */
  const goto = async (url, settle = 2500) => {
    await cdp.send("Page.navigate", { url }, sessionId);

    for (let attempt = 0; attempt < 60; attempt++) {
      const state = await evaluate(`document.readyState`, { timeoutMs: 5000 });
      if (state.value === "complete" || state.value === "interactive") break;
      await wait(500);
    }

    // Hydration and the IndexedDB reads that follow it.
    await wait(settle);
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
        // Targets without a Network domain; the page and worker are the ones
        // that matter and those succeed.
      }
    }
  };

  return { sessionId, sessions, evaluate, goto, setOffline };
}

export function reporter() {
  const results = [];
  const check = (name, pass, detail = "") => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  };
  const summary = () => {
    const failed = results.filter((r) => !r.pass);
    console.log("\n--- SUMMARY ---");
    console.log(`${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) console.log(`Failed: ${failed.map((f) => f.name).join("; ")}`);
    return failed.length === 0;
  };
  return { check, summary };
}
