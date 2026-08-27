import { defineConfig } from "@trigger.dev/sdk";
import { syncEnvVars } from "@trigger.dev/build/extensions/core";

// Everything the tasks read at runtime; synced from the deployer's env file on
// every `deploy --env-file .env.local`, so the dashboard never holds state the
// repo does not name.
const TASK_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "PARALLEL_API_KEY",
  "AI_GATEWAY_API_KEY",
] as const;

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
  build: {
    extensions: [
      syncEnvVars(() =>
        TASK_ENV_VARS.filter((name) => process.env[name]).map((name) => ({
          name,
          // Non-null asserted: the filter above just proved presence.
          value: process.env[name]!,
        })),
      ),
    ],
  },
});
