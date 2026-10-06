import "dotenv/config";
import { buildApp } from "./app.js";
import { loadAiConfig } from "./modules/ai/ai.config.js";
import { createGeminiProvider } from "./modules/ai/ai.provider.js";
import { createTasteAnalysisService } from "./modules/taste-analysis/taste-analysis.service.js";
import { createChatService } from "./modules/chat/chat.service.js";
import { loadEmailConfig } from "./modules/email/email.config.js";
import { createEmailProvider } from "./modules/email/email.provider.js";
import { createEmailService } from "./modules/email/email.service.js";

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
  const chat = createChatService(app.prisma);
  const emailConfig = loadEmailConfig();
  const email = createEmailService(app.prisma, emailConfig, createEmailProvider(emailConfig));
  if (!config.workerEnabled) {
    app.log.info(
      { enabled: config.workerEnabled, configured: service.configured },
      "Background worker disabled",
    );
  } else {
    app.log.info(
      {
        analysisConfigured: service.configured,
        chatConfigured: chat.configured,
        emailConfigured: email.configured,
      },
      "Background worker started",
    );
    while (!stopping) {
      let worked = false;
      try {
        if (email.configured) worked = await email.tick();
        if (!stopping && service.configured) worked = (await service.tick()) || worked;
        if (!stopping && chat.configured) worked = (await chat.tick()) || worked;
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
