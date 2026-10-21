import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(await readFile(resolve(root, ".next/required-server-files.json"), "utf8")).config;
const reservation = createServer();
await new Promise((done) => reservation.listen(0, "127.0.0.1", done));
const port = reservation.address().port;
await new Promise((done) => reservation.close(done));
const server = spawn(process.execPath, ["apps/login/server.js"], {
  cwd: resolve(root, ".next/standalone"),
  env: {
    ...process.env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    NODE_ENV: "production",
    ZITADEL_TLS_ENABLED: "false",
    ZITADEL_API_URL: "",
    OTEL_SDK_DISABLED: "true",
    CSP_FETCH_ENABLED: "false",
  },
  stdio: "ignore",
});

try {
  const base = `http://127.0.0.1:${port}${config.basePath ?? ""}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      ready = (await fetch(`${base}/healthy`, { signal: AbortSignal.timeout(1000) })).ok;
      if (ready) break;
    } catch {
      /* The process may still be starting. */
    }
    await delay(100);
  }
  assert.ok(ready, "The packaged login server must become healthy");
  const response = await fetch(`${base}/products/roamie-mark.png`, { signal: AbortSignal.timeout(3000) });
  assert.equal(response.status, 200, "The packaged server must serve Roamie's genuine logo");
  assert.match(response.headers.get("content-type") ?? "", /^image\/png/);
  const source = await readFile(resolve(root, "public/products/roamie-mark.png"));
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), source);
  console.log("Packaged login health and genuine Roamie logo verified.");
} finally {
  server.kill("SIGTERM");
}
