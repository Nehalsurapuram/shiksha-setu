import { CDP, browserWebSocket, connect, launchChrome, openPage, wait } from "./scripts/cdp.mjs";
const chrome = launchChrome(9343);
try {
  const cdp = new CDP(await connect(await browserWebSocket(9343)));
  const page = await openPage(cdp);
  cdp.on((m) => {
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")
      console.log("CONSOLE", JSON.stringify(m.params.args.map(a => a.value ?? a.description).slice(0,2)));
    if (m.method === "Runtime.exceptionThrown")
      console.log("EXCEPTION", m.params.exceptionDetails.exception?.description?.slice(0, 200));
  });
  await page.goto("http://localhost:3000/offline");
  console.log("alive1:", JSON.stringify(await page.evaluate(`1+1`, { timeoutMs: 5000 })));
  console.log("click:", JSON.stringify(await page.evaluate(`(()=>{const b=[...document.querySelectorAll("button")].find(b=>b.textContent.trim().startsWith("Sync now"));b.click();return "ok"})()`, { timeoutMs: 5000 })));
  for (const t of [2, 5, 10, 20]) {
    await wait(t * 1000);
    const alive = await page.evaluate(`1+1`, { timeoutMs: 4000 });
    const state = await page.evaluate(`(()=>{try{return "idb-open"}catch(e){return String(e)}})()`, { timeoutMs: 4000 });
    console.log(`t=${t}s alive:`, JSON.stringify(alive), JSON.stringify(state));
  }
  const counts = await page.evaluate(`(async()=>{const db=await new Promise((res,rej)=>{const r=indexedDB.open("shikshasetu-offline");r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);r.onblocked=()=>rej("BLOCKED");});return db.version + ":" + [...db.objectStoreNames].join(",")})()`, { timeoutMs: 8000 });
  console.log("db:", JSON.stringify(counts));
} catch (e) { console.log("ERR", e.message); } finally { chrome.kill(); process.exit(0); }
