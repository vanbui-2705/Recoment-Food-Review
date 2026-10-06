import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import console from "node:console";
import process from "node:process";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";

// All resources are newly created, synthetic and labeled. Never connects to DATABASE_URL.
const suffix = randomBytes(8).toString("hex");
const name = `rec-food-drill-${suffix}`,
  network = `${name}-net`,
  password = randomBytes(24).toString("hex");
const current = process.env.DRILL_CURRENT_IMAGE || "rec-food-backend:plan-content";
const previous = process.env.DRILL_PREVIOUS_IMAGE || "rec-food-backend:plan-ai-budget";
const migrate = process.env.DRILL_MIGRATION_IMAGE || "rec-food-migrate:plan-ops";
const label = `rec-food.drill=${suffix}`;
if (!/^rec-food-drill-[a-f0-9]{16}$/.test(name)) throw new Error("Invalid drill target");
function docker(args, input) {
  const result = spawnSync("docker", args, {
    input,
    encoding: "utf8",
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.status !== 0) {
    const codes = [
      ...`${result.stdout}\n${result.stderr}`.matchAll(
        /(?:code: ['"]|code":"|Error \[)([A-Z][A-Z0-9_]+)/g,
      ),
    ].map((match) => match[1]);
    throw new Error(
      `Drill operation failed: ${args[0]} (${codes.join(",") || "no structured code"}). Output suppressed to protect connection credentials.`,
    );
  }
  return result.stdout.trim();
}
function run(image, database, program) {
  return docker(
    [
      "run",
      "--rm",
      "-i",
      "--network",
      network,
      "--label",
      label,
      "-e",
      `DATABASE_URL=postgresql://drill:${password}@${name}:5432/${database}?schema=public`,
      "-e",
      "JWT_ACCESS_SECRET=synthetic-drill-only-secret-32-characters",
      "-e",
      "WORKER_ENABLED=false",
      "-e",
      "SECURITY_NAMESPACE=recovery-drill",
      image,
      "node",
      "--input-type=module",
    ],
    program,
  );
}
const fixture = `
import assert from 'node:assert/strict';
import { buildApp } from './dist/app.js';
import { hashPassword } from './dist/common/security/password.js';
const app = buildApp({logger:false}); await app.ready();
try {
 const passwordHash = await hashPassword('synthetic-drill-password');
 for (const email of ['owner@drill.invalid','other@drill.invalid']) await app.prisma.user.create({data:{email,displayName:'Synthetic drill',passwordHash}});
 const owner = await app.prisma.user.findUniqueOrThrow({where:{email:'owner@drill.invalid'}});
 const cuisine = await app.prisma.cuisine.create({data:{code:'DRILL_ONLY',name:'Synthetic cuisine'}});
 const dish = await app.prisma.dish.create({data:{slug:'drill-only',name:'Synthetic dish',cuisineId:cuisine.id,priceMin:10000,priceMax:20000,spicyLevel:0,sweetLevel:0,sourLevel:0,saltyLevel:0}});
 await app.prisma.userInteraction.create({data:{userId:owner.id,dishId:dish.id,interactionType:'EATEN',createdAt:new Date(Date.now()-86400000),idempotencyKey:'synthetic-history'}});
 await app.prisma.tasteProfile.create({data:{userId:owner.id,onboardingCompleted:true,budgetMin:0,budgetMax:50000,maxDistanceMeters:3500,spicyLevel:0,sweetLevel:0,sourLevel:0,saltyLevel:0}});
 await app.prisma.personalFoodKnowledge.create({data:{userId:owner.id,description:'Synthetic taste note',revision:1,analyzedRevision:1}});
 await app.prisma.tasteAnalysisJob.create({data:{userId:owner.id,sourceRevision:1,status:'RUNNING',attempt:1,leaseToken:'11111111-1111-4111-8111-111111111111',leaseUntil:new Date(Date.now()-1000)}});
 console.log(JSON.stringify({users:2,history:1,expiredLease:1}));
} finally {await app.close();}
`;
const verify = `
import assert from 'node:assert/strict';
import { buildApp } from './dist/app.js';
const app=buildApp({logger:false}); await app.ready();
try {
 const tokens=[];
 for (const email of ['owner@drill.invalid','other@drill.invalid']) {
  const login=await app.inject({method:'POST',url:'/auth/login',payload:{email,password:'synthetic-drill-password'}});
  assert.equal(login.statusCode,200); tokens.push({authorization:'Bearer '+login.json().data.accessToken});
 }
 const history=await app.inject({url:'/users/me/food-history',headers:tokens[0]}); assert.equal(history.statusCode,200); assert.equal(history.json().data.items.length,1);
 assert.equal((await app.inject({url:'/users/me/food-history',headers:tokens[1]})).json().data.items.length,0);
 const row=await app.prisma.userInteraction.findUniqueOrThrow({where:{idempotencyKey:'synthetic-history'}});
 assert.equal(row.dishId,history.json().data.items[0].dishId); assert.equal(row.interactionType,'EATEN');
 const today=await app.inject({url:'/recommendations/today',headers:tokens[0]}); assert.equal(today.statusCode,200); assert.equal(today.json().data.repeatAfterHours,96); assert.equal(today.json().data.items.length,0);
 assert.equal(await app.prisma.tasteAnalysisJob.count({where:{status:'RUNNING'}}),1);
 assert.equal((await app.inject({url:'/ready'})).statusCode,200);
 console.log(JSON.stringify({ownership:'verified',history:'preserved',readiness:'ok'}));
} finally {await app.close();}
`;
const recover = `
import assert from 'node:assert/strict';
import { buildApp } from './dist/app.js';
import { createTasteAnalysisService } from './dist/modules/taste-analysis/taste-analysis.service.js';
import { loadAiConfig } from './dist/modules/ai/ai.config.js';
const app=buildApp({logger:false}); await app.ready();
try {
 const config=loadAiConfig({...process.env,WORKER_ENABLED:'true',LLM_API_KEY:'synthetic-not-sent'});
 const service=createTasteAnalysisService(app.prisma,config,{configured:true,generate:async()=>{throw Object.assign(new Error('synthetic'),{code:'AI_UNAVAILABLE'});}});
 assert.equal(await service.tick(),true);
 const job=await app.prisma.tasteAnalysisJob.findFirstOrThrow(); assert.equal(job.attempt,2); assert.notEqual(job.leaseToken,'11111111-1111-4111-8111-111111111111');
 assert.equal(await app.prisma.userInteraction.count(),1);
 console.log(JSON.stringify({expiredLease:'reclaimed',attempts:job.attempt,history:'preserved'}));
} finally {await app.close();}
`;
const results = { synthetic: true, currentImage: current, previousImage: previous };
let createdNetwork = false,
  createdContainer = false;
try {
  docker(["network", "create", "--label", label, network]);
  createdNetwork = true;
  docker([
    "run",
    "-d",
    "--name",
    name,
    "--network",
    network,
    "--label",
    label,
    "--tmpfs",
    "/var/lib/postgresql/data",
    "-e",
    "POSTGRES_USER=drill",
    "-e",
    `POSTGRES_PASSWORD=${password}`,
    "-e",
    "POSTGRES_DB=source",
    "postgres:17-alpine",
  ]);
  createdContainer = true;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const probe = spawnSync("docker", ["exec", name, "pg_isready", "-U", "drill", "-d", "source"], {
      windowsHide: true,
      stdio: "ignore",
    });
    if (probe.status === 0) {
      ready = true;
      break;
    }
    await delay(500);
  }
  if (!ready) throw new Error("Isolated database did not become ready");
  docker([
    "run",
    "--rm",
    "--network",
    network,
    "--label",
    label,
    "-e",
    `DATABASE_URL=postgresql://drill:${password}@${name}:5432/source?schema=public`,
    migrate,
  ]);
  results.fixture = JSON.parse(run(current, "source", fixture));
  const snapshotAt = performance.now();
  docker([
    "exec",
    name,
    "pg_dump",
    "-U",
    "drill",
    "-d",
    "source",
    "--format=custom",
    "--file=/tmp/drill.dump",
  ]);
  results.backupMs = Math.round(performance.now() - snapshotAt);
  const restoreStart = performance.now();
  docker(["exec", name, "createdb", "-U", "drill", "restored"]);
  docker([
    "exec",
    name,
    "pg_restore",
    "-U",
    "drill",
    "-d",
    "restored",
    "--exit-on-error",
    "--no-owner",
    "/tmp/drill.dump",
  ]);
  results.restoreMs = Math.round(performance.now() - restoreStart);
  results.rpoMs = 0; // No writes after snapshot in this synthetic drill; not a production RPO claim.
  results.restored = JSON.parse(run(current, "restored", verify));
  results.recoveryReadyMs = Math.round(performance.now() - restoreStart);
  results.rollback = JSON.parse(run(previous, "restored", verify));
  results.leaseRecovery = JSON.parse(run(current, "restored", recover));
  if (process.env.DRILL_LOAD === "true")
    results.load = JSON.parse(
      run(
        current,
        "restored",
        await readFile(new URL("./load-workload.mjs", import.meta.url), "utf8"),
      ),
    );
  console.log(JSON.stringify(results, null, 2));
} finally {
  if (createdContainer) {
    const resourceLabel = docker([
      "inspect",
      "--format",
      `{{index .Config.Labels "rec-food.drill"}}`,
      name,
    ]);
    assert.equal(resourceLabel, suffix, "Refusing cleanup: drill label mismatch");
    docker(["rm", "--force", name]);
  }
  if (createdNetwork) {
    const resourceLabel = docker([
      "network",
      "inspect",
      "--format",
      `{{index .Labels "rec-food.drill"}}`,
      network,
    ]);
    assert.equal(resourceLabel, suffix, "Refusing cleanup: network label mismatch");
    docker(["network", "rm", network]);
  }
}
