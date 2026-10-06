import "dotenv/config";
import { buildApp } from "./app.js";
import { loadAiConfig } from "./modules/ai/ai.config.js";
import { createBudgetedGeminiProvider } from "./modules/ai/ai.budget.js";
import { createTasteAnalysisService } from "./modules/taste-analysis/taste-analysis.service.js";
import { createChatService } from "./modules/chat/chat.service.js";
import { loadEmailConfig } from "./modules/email/email.config.js";
import { createEmailProvider } from "./modules/email/email.provider.js";
import { createEmailService } from "./modules/email/email.service.js";
import { createAccountService } from "./modules/account/account.service.js";
import { createRetentionService } from "./modules/account/account.retention.js";

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
  const service = createTasteAnalysisService(
    app.prisma,
    config,
    createBudgetedGeminiProvider(app.prisma, config),
  );
  const chat = createChatService(app.prisma);
  const emailConfig = loadEmailConfig();
  const email = createEmailService(app.prisma, emailConfig, createEmailProvider(emailConfig));
  const account = createAccountService(app.prisma, config.workerEnabled);
  const retention = createRetentionService(app.prisma, config.workerEnabled);
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
        worked = await account.tick();
        if (!stopping) worked = (await retention.tick()) || worked;
        if (!stopping && email.configured) worked = (await email.tick()) || worked;
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
