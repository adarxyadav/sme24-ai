import { defineConfig } from "@trigger.dev/sdk";

// Pipeline orchestration (AGENTS.md: all AI calls live in trigger/ tasks).
// Task semantics — chaining, retries, queues — are owned by
// context/product/pipeline-rules.md, not by this file.
export default defineConfig({
  project: "proj_llpdhtuktqpldiubeqsr",
  runtime: "node-24",
  logLevel: "log",
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      // pipeline-rules.md, Escalation: model-call retry backoff >= 60s. The
      // init default of 1s would retry a rate-limited model call before the
      // limit window has moved.
      minTimeoutInMs: 60_000,
      maxTimeoutInMs: 300_000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./trigger"],
});
