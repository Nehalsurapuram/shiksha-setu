import { CDP, browserWebSocket, connect, launchChrome, openPage } from "./scripts/cdp.mjs";
const chrome = launchChrome(9345);
try {
  const cdp = new CDP(await connect(await browserWebSocket(9345)));
  const page = await openPage(cdp);
  for (const route of ["/", "/offline.html", "/settings", "/dashboard", "/library", "/offline"]) {
    await page.goto("http://localhost:3000" + route, 800);
    const r = await page.evaluate(`1+1`, { timeoutMs: 6000 });
    console.log(route.padEnd(16), r.value === 2 ? "RESPONSIVE" : "BLOCKED " + (r.error ?? ""));
  }
} catch (e) { console.log("ERR", e.message); } finally { chrome.kill(); process.exit(0); }
