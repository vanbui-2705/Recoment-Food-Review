import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { request } from "node:https";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import console from "node:console";
import process from "node:process";

const root = fileURLToPath(new URL("../../", import.meta.url));
const project = `rec-food-tls-drill-${randomBytes(8).toString("hex")}`;
assert.match(project, /^rec-food-tls-drill-[a-f0-9]{16}$/);
const env = {
  ...process.env,
  APP_DOMAIN: "localhost",
  TLS_CONTACT_EMAIL: "synthetic@drill.invalid",
  BACKEND_IMAGE: process.env.DRILL_CURRENT_IMAGE || "rec-food-backend:plan-sync",
  FRONTEND_IMAGE: process.env.DRILL_FRONTEND_IMAGE || "rec-food-frontend:plan-sync",
  MIGRATION_IMAGE: "rec-food-migrate:plan-ops",
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
  PUBLIC_APP_URL: "https://localhost",
  EMAIL_ALLOWED_ORIGINS: "https://localhost",
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
  "compose.staging.yaml",
  "-f",
  "compose.tls-drill.yaml",
  "--profile",
  "background",
];
function docker(command) {
  const result = spawnSync("docker", command, {
    cwd: root,
    env,
    windowsHide: true,
    encoding: "utf8",
    timeout: 180000,
  });
  if (result.status !== 0)
    throw new Error(`TLS drill failed (${command[0]}). Logs suppressed to protect credentials.`);
  return result.stdout.trim();
}
const compose = (command) => docker([...args, ...command]);
function get(port, ca, path, method = "GET", headers = {}) {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: "127.0.0.1",
        port,
        servername: "localhost",
        ca,
        path,
        method,
        headers: { Host: "localhost", ...headers },
        timeout: 10000,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body,
            authorized: res.socket?.authorized,
          }),
        );
      },
    );
    req.once("timeout", () => req.destroy(new Error("TLS smoke timeout")));
    req.once("error", reject);
    req.end();
  });
}
let created = false;
try {
  for (const networkId of docker(["network", "ls", "--quiet"]).split(/\r?\n/).filter(Boolean)) {
    const info = JSON.parse(docker(["network", "inspect", networkId]));
    assert.ok(
      !info[0].IPAM.Config?.some((row) => row.Subnet === "172.30.5.0/24"),
      "Staging test subnet already exists; choose another isolated test host",
    );
  }
  compose(["config", "--quiet"]);
  created = true;
  compose(["up", "--no-build", "-d"]);
  const binding = compose(["port", "edge", "443"]);
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const port = Number(binding.split(":")[1]);
  let ca;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      ca = compose(["exec", "-T", "edge", "cat", "/data/caddy/pki/authorities/local/root.crt"]);
      break;
    } catch {
      await delay(500);
    }
  }
  assert.match(ca || "", /BEGIN CERTIFICATE/);
  const ready = await get(port, ca, "/api/ready");
  assert.equal(ready.status, 200);
  assert.equal(JSON.parse(ready.body).database, "ready");
  assert.match(ready.headers["strict-transport-security"], /max-age=31536000/);
  assert.equal((await get(port, ca, "/")).status, 200);
  const denied = await get(port, ca, "/api/admin/metrics");
  assert.equal(denied.status, 401);
  const cors = await get(port, ca, "/api/auth/login", "OPTIONS", {
    Origin: "https://untrusted.invalid",
    "Access-Control-Request-Headers": "authorization",
  });
  assert.equal(cors.headers["access-control-allow-origin"], undefined);
  // Query text must not appear in nginx request logs.
  await get(port, ca, "/api/ready?probe=synthetic-private-query");
  const logs = compose(["logs", "--no-color", "frontend"]);
  assert.ok(!logs.includes("synthetic-private-query"));
  console.log(
    JSON.stringify(
      {
        synthetic: true,
        certificate: "validated using local CA",
        httpsReadiness: "200",
        protectedMetrics: "401",
        hsts: "enabled",
        crossOriginAccess: "denied",
        nginxQueryLogging: "redacted",
      },
      null,
      2,
    ),
  );
} finally {
  if (created) compose(["down", "--volumes", "--remove-orphans"]);
}
