import "dotenv/config";
import { Template, defaultBuildLogger } from "e2b";
import { template } from "./template";

async function main() {
  console.log("Building template for production...");

  await Template.build(template, {
    alias: "appily-web-prod",
    cpuCount: 8,
    memoryMB: 8192,
    onBuildLogs: defaultBuildLogger(),
  });

  console.log("\n✅ Production build successful!");
  console.log(`Template alias: appily-web-prod`);
  console.log(`\nUpdate lib/e2b.ts to use the new template ID from the build output.`);
}

main().catch(console.error);
