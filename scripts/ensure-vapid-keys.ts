import { resolve } from "node:path";

import { resolveVapidDetails } from "@/helpers/notifications/vapid-env";

async function main(): Promise<void> {
  const details = await resolveVapidDetails({
    nodeEnv: "development",
    envFilePath: resolve(process.cwd(), ".env.local"),
  });

  if (!details) {
    console.error("Failed to configure web push VAPID keys");
    process.exit(1);
  }

  console.log("Web push VAPID keys are configured in .env.local");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
