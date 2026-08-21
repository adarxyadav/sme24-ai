import { logger, schedules, tasks } from "@trigger.dev/sdk";
import { agentLog, LOG_MESSAGES } from "@/lib/runs/agent-log";
import { createServiceClient } from "@/lib/supabase/service";
import { COMPANY_RESEARCH_QUEUE } from "@/lib/runs/queues";
import type { companyResearchTask } from "@/trigger/company-research";

// T-010 — the owner of `queued`.
//
// Every other status has a task inside it that will eventually write a
// terminal: onFailure covers exhausted retries, onCancel covers cancellation.
// Both need the task to have *started*. `queued` alone means "a task will pick
// this up", and until this sweeper existed nothing verified that ever happened.
// Three ways a run never reaches a worker: the route's enqueue throws after the
// row is committed, a deploy skew leaves the run PENDING_VERSION, or a worker
// dies before its first attempt.
//
// The database is the authority, not Trigger.dev's idempotency store. Stage 1
// claims its run with a conditional `queued -> researching` update, so "still
// queued" is proof no task holds it, and a redundant trigger loses the claim
// and exits. That store could not play this role: it clears a failed run's key
// and expires at 30 days.

const STAGE = "research";

// Long enough that a briefly-queued run is picked up normally before the first
// sweep ever looks at it; short enough that a genuinely stranded run recovers
// in minutes. It is NOT sized to exceed the longest legitimate queue wait —
// a second concurrent search can sit `queued` behind concurrency 1 for a full
// ultra run — because re-triggering such a run is harmless: the extra trigger
// inherits the same per-user queue and waits behind the same limit, and the
// claim guard makes the loser a no-op.
const STALE_AFTER_MINUTES = 5;

// After this many recorded sweeps a run is terminated rather than swept
// forever, so a permanently unenqueueable run cannot become a new quiet stuck
// state. Counted from agent_logs rather than a new column: the rows are already
// written, already indexed by (run_id, created_at), and carry why each sweep
// happened.
const MAX_SWEEPS = 3;

// One page is far more than a healthy system produces in five minutes; a
// backlog above it is drained by subsequent sweeps rather than in one run.
const SWEEP_LIMIT = 100;

type QueuedRun = {
  id: string;
  user_id: string;
  created_at: string;
};

export const sweepQueuedRunsTask = schedules.task({
  id: "sweep-queued-runs",
  cron: { pattern: "*/5 * * * *", timezone: "UTC" },

  run: async () => {
    const service = createServiceClient();
    const staleBefore = new Date(Date.now() - STALE_AFTER_MINUTES * 60_000).toISOString();

    const { data: stranded, error: selectError } = await service
      .from("analysis_runs")
      .select("id, user_id, created_at")
      .eq("status", "queued")
      .lt("created_at", staleBefore)
      .order("created_at", { ascending: true })
      .limit(SWEEP_LIMIT)
      .returns<QueuedRun[]>();

    if (selectError) throw new Error(`queued sweep select failed: ${selectError.message}`);

    const runs = stranded ?? [];
    if (runs.length === 0) return { swept: 0, terminated: 0 };

    let swept = 0;
    let terminated = 0;

    for (const run of runs) {
      // Counted before this sweep is recorded, so the run is terminated on the
      // sweep *after* its MAX_SWEEPS-th — it gets that many real re-trigger
      // attempts, not one fewer.
      const { count, error: countError } = await service
        .from("agent_logs")
        .select("id", { count: "exact", head: true })
        .eq("run_id", run.id)
        .eq("message", LOG_MESSAGES.sweptQueued);

      if (countError) {
        // One run's bookkeeping failing must not abandon the rest of the batch.
        logger.error("sweep count failed", { runId: run.id, message: countError.message });
        continue;
      }

      const priorSweeps = count ?? 0;

      if (priorSweeps >= MAX_SWEEPS) {
        // The same terminal shape as the task's own final-failure hook
        // (pipeline-rules.md: status + the error column + one agent_logs row),
        // guarded on `queued` so a run that started between the select and here
        // is left alone.
        const { error: failError } = await service
          .from("analysis_runs")
          .update({
            status: "failed",
            error: `Run never started: ${priorSweeps} sweeps did not reach a worker`,
            completed_at: new Date().toISOString(),
          })
          .eq("id", run.id)
          .eq("status", "queued");

        if (failError) {
          logger.error("sweep terminate failed", { runId: run.id, message: failError.message });
          continue;
        }

        await agentLog(service, {
          runId: run.id,
          stage: STAGE,
          level: "error",
          message: LOG_MESSAGES.failed,
          payload: { reason: "never_enqueued", sweeps: priorSweeps },
        });

        terminated += 1;
        continue;
      }

      try {
        await tasks.trigger<typeof companyResearchTask>(
          "company-research",
          { runId: run.id },
          {
            // The same queue and per-user key the route uses: a swept run must
            // not bypass the concurrency-1 throttle its owner is subject to
            // (pipeline-rules.md, Quota).
            queue: COMPANY_RESEARCH_QUEUE,
            concurrencyKey: run.user_id,
            region: "eu-central-1",
          },
        );
      } catch (triggerError) {
        const cause =
          triggerError instanceof Error ? triggerError.message : String(triggerError);
        await agentLog(service, {
          runId: run.id,
          stage: STAGE,
          level: "warn",
          message: LOG_MESSAGES.enqueueFailed,
          payload: { source: "sweeper", cause: cause.slice(0, 500) },
        });
      }

      // Written whether or not the trigger above succeeded: the count is of
      // sweeps spent on this run, which is what bounds it.
      await agentLog(service, {
        runId: run.id,
        stage: STAGE,
        level: "warn",
        message: LOG_MESSAGES.sweptQueued,
        payload: { sweep: priorSweeps + 1, queued_since: run.created_at },
      });

      swept += 1;
    }

    logger.log("queued sweep complete", { found: runs.length, swept, terminated });
    return { swept, terminated };
  },
});
