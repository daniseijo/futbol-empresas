// Screenshot of a page at an exact viewport, for visual checks of the site.
//
//   node scripts/screenshot.mjs <url> <out.png> [width=1280] [height=2000]
//
// Uses Chrome through the DevTools protocol with device emulation, because
// `chrome --headless --window-size` does not go below ~500 px wide and so
// cannot show the 390 px phone layout. WebGL runs in software (SwiftShader) so maps
// render. Set CHROME_PATH if Chrome is elsewhere.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [url, out, width = "1280", height = "2000"] = process.argv.slice(2);
if (!url || !out) {
  console.error("Usage: node scripts/screenshot.mjs <url> <out.png> [width] [height]");
  process.exit(1);
}

const chromePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const port = 9300 + Math.floor(Math.random() * 600);
const profile = mkdtempSync(join(tmpdir(), "screenshot-"));
const chrome = spawn(chromePath, ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], {
  stdio: "ignore",
});

try {
  let tab;
  for (let attempt = 0; attempt < 50 && !tab; attempt++) {
    try {
      tab = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  if (!tab) throw new Error("Chrome did not start");

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    pending.get(message.id)?.(message.result);
    pending.delete(message.id);
  });
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      pending.set(++id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send("Emulation.setDeviceMetricsOverride", { width: Number(width), height: Number(height), deviceScaleFactor: 1, mobile: Number(width) < 600 });
  await send("Page.navigate", { url });
  // Streaming pages keep loading after the first paint: give them time to settle.
  await new Promise((resolve) => setTimeout(resolve, 6000));
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(data, "base64"));
  ws.close();
  console.log(`Saved ${out} (${width}×${height})`);
} finally {
  // Chrome keeps writing to its profile while it closes: wait before removing it.
  const exited = new Promise((resolve) => chrome.once("exit", resolve));
  chrome.kill();
  await exited;
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
