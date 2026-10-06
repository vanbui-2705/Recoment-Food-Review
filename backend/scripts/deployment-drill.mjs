import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath, URL } from "node:url";
import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";
const { fetch, AbortSignal } = globalThis;

const root = fileURLToPath(new URL("../../", import.meta.url));
const project = `rec-food-deploy-drill-${randomBytes(8).toString("hex")}`;
if (!/^rec-food-deploy-drill-[a-f0-9]{16}$/.test(project))
  throw new Error("Invalid cleanup target");
const env = {
  ...process.env,
  JWT_ACCESS_SECRET: randomBytes(32).toString("hex"),
  POSTGRES_PASSWORD: randomBytes(24).toString("hex"),
  WORKER_ENABLED: "true",
  SECURITY_NAMESPACE: project,
  LLM_API_KEY: "",
  GOOGLE_PLACES_API_KEY: "",
  THEMEALDB_API_KEY: "",
  SPOONACULAR_API_KEY: "",
  GOONG_API_KEY: "",
  FOURSQUARE_API_KEY: "",
  GEOAPIFY_API_KEY: "",
  RESEND_API_KEY: "",
  EMAIL_PROVIDER: "disabled",
  PUBLIC_APP_URL: "",
  EMAIL_ALLOWED_ORIGINS: "",
  EMAIL_OUTBOX_ENCRYPTION_KEY: "",
};
const args = [
  "compose",
  "--env-file",
  fileURLToPath(new URL("../.env.example", import.meta.url)),
  "-p",
  project,
  "-f",
  "compose.yaml",
  "-f",
  "compose.drill.yaml",
  "--profile",
  "background",
];
function compose(command) {
  const result = spawnSync("docker", [...args, ...command], {
    cwd: root,
    env,
    windowsHide: true,
    encoding: "utf8",
    timeout: 180000,
  });
  if (result.status !== 0)
    throw new Error(
      `Isolated deployment operation failed (${command[0]}). Logs suppressed to avoid exposing credentials.`,
    );
  return result.stdout.trim();
}
let created = false;
try {
  compose(["config", "--quiet"]);
  created = true;
  const start = performance.now();
  compose(["up", "--no-build", "-d"]);
  const binding = compose(["port", "frontend", "80"]);
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const origin = `http://${binding}`;
  const ready = await fetch(`${origin}/api/ready`, { signal: AbortSignal.timeout(10000) });
  assert.equal(ready.status, 200);
  const html = await fetch(origin);
  assert.equal(html.status, 200);
  assert.match(await html.text(), /<div id="root"><\/div>/);
  const policy = await fetch(`${origin}/api/privacy-policy`);
  assert.equal(policy.status, 200);
  assert.notEqual((await policy.json()).data.cleanupState, "DISABLED");
  const denied = await fetch(`${origin}/api/admin/operations`);
  assert.equal(denied.status, 401);
  const startupMs = Math.round(performance.now() - start);
  const stop = performance.now();
  compose(["stop", "--timeout", "120", "worker"]);
  const workerStopMs = Math.round(performance.now() - stop);
  const rows = compose(["ps", "--all", "--format", "json"])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert.equal(rows.find((row) => row.Service === "worker")?.ExitCode, 0);
  compose(["start", "worker"]);
  const webStop = performance.now();
  compose(["stop", "--timeout", "120", "frontend", "backend"]);
  const webStopMs = Math.round(performance.now() - webStop);
  console.log(
    JSON.stringify(
      {
        synthetic: true,
        startupMs,
        workerStopMs,
        webStopMs,
        readiness: "verified through nginx",
        workerWithoutAi: "running",
        protectedOperations: "401",
        gracefulExit: "verified",
      },
      null,
      2,
    ),
  );
} finally {
  // Compose scopes every resource to the freshly generated project; do not run against an existing deployment.
  if (created) compose(["down", "--volumes", "--remove-orphans"]);
}
