import { defineConfig, devices } from "@playwright/test";
import config from "./playwright.config";

// Keep CDP-only touch injection suites in the existing Chromium configuration.
export default defineConfig({
  ...config,
  testMatch: ["case-support-inputs.spec.ts", "target-workflow.spec.ts", "first-activation-diagnostic.spec.ts", "provider-first-activation.spec.ts", "dashboard-attention.spec.ts", "post-workflow-interaction.spec.ts", "dashboard-continuity-harness.spec.ts", "field-observation-viewport.spec.ts"],
  projects: [{ name: "mobile-webkit", use: { ...devices["iPhone 13"], browserName: "webkit" } }],
});
