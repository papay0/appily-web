import "dotenv/config";
import { Template, defaultBuildLogger } from "e2b";
import { template } from "./template";

async function main() {
  console.log("Building template for development...");

  await Template.build(template, {
    alias: "appily-web-dev",
    cpuCount: 8,
    memoryMB: 8192,
    onBuildLogs: defaultBuildLogger(),
  });

  console.log("✅ Development build successful!");
}

main().catch(console.error);
