import "dotenv/config";
import { buildApp } from "./app.js";
import { loadAiConfig } from "./modules/ai/ai.config.js";
import { createGeminiProvider } from "./modules/ai/ai.provider.js";
import { createTasteAnalysisService } from "./modules/taste-analysis/taste-analysis.service.js";

const config = loadAiConfig();
const app = buildApp({ logger: true });
let stopping = false;
let wake: (() => void) | undefined;
process.once("SIGINT", () => {
  stopping = true;
  wake?.();
});
process.once("SIGTERM", () => {
  stopping = true;
  wake?.();
});
try {
  await app.ready();
  const service = createTasteAnalysisService(app.prisma, config, createGeminiProvider(config));
  if (!config.workerEnabled || !service.configured) {
    app.log.info(
      { enabled: config.workerEnabled, configured: service.configured },
      "Taste analysis worker disabled",
    );
  } else {
    app.log.info("Taste analysis worker started");
    while (!stopping) {
      let worked = false;
      try {
        worked = await service.tick();
      } catch {
        app.log.error({ code: "WORKER_TICK_FAILED" }, "Worker tick failed");
      }
      if (!worked && !stopping)
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            wake = undefined;
            resolve();
          }, 2000);
          wake = () => {
            clearTimeout(timer);
            wake = undefined;
            resolve();
          };
        });
    }
  }
} catch {
  app.log.error({ code: "WORKER_START_FAILED" }, "Worker start failed");
  process.exitCode = 1;
} finally {
  await app.close();
}
