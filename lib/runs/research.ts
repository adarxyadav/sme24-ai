import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EhsOutput, ParallelBasis } from "@/lib/parallel/ehs-schema";
import type { ProcessorTier } from "@/lib/parallel/client";
import type { UploadRead } from "@/lib/upload/read";

// Stage-1 cache lookup and the research envelope (t-004-spec.md D6, D8).
// pipeline-rules.md, Caching: no cache table — a hit copies the research jsonb
// from the newest completed run with the same cache_key, no older than 30 days.

const CACHE_WINDOW_DAYS = 30;

// One integer, not an abstraction: research is a jsonb blob a later stage
// reads, and the first shape change has to be diagnosable from the row.
const SCHEMA_VERSION = 1;

export type ResearchEnvelope = {
  schema_version: number;
  source: "parallel" | "cache";
  fetched_at: string;
  output: EhsOutput;
  basis: ParallelBasis;
  parallel_run_id: string | null;
  processor: ProcessorTier;
  cache?: { donor_run_id: string; age_days: number };
  // Stage 1 step 4: the client's own report, read by the model. Never copied
  // to another run by the cache (t-020-spec.md D2).
  upload?: UploadRead;
};

export type CacheMiss = { hit: false; reason: "none" | "expired" | "tier" };
export type CacheHit = { hit: true; donorRunId: string; ageDays: number; research: ResearchEnvelope };
export type CacheLookup = CacheHit | CacheMiss;

type DonorRow = {
  id: string;
  research: ResearchEnvelope | null;
  processor: ProcessorTier;
  created_at: string;
};

// The query mirrors analysis_runs_cache_key_idx exactly —
// (cache_key, created_at desc) where status = 'completed'.
//
// Tier rule (pipeline-rules.md): an ultra run ignores cached base research and
// refreshes the cache with its own result; cached ultra research is reused
// as-is. Applied as a post-filter on the single newest row rather than as a
// second query: if the newest run is the wrong tier we pay for a fresh call,
// instead of reaching further back for an older ultra result already closer to
// expiry.
export async function findCachedResearch(
  service: SupabaseClient,
  { cacheKey, runId, processor }: { cacheKey: string; runId: string; processor: ProcessorTier },
): Promise<CacheLookup> {
  const cutoff = new Date(Date.now() - CACHE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await service
    .from("analysis_runs")
    .select("id, research, processor, created_at")
    .eq("cache_key", cacheKey)
    .eq("status", "completed")
    .neq("id", runId)
    .gt("created_at", cutoff)
    .not("research", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<DonorRow>();

  if (error) throw new Error(`cache lookup failed: ${error.message}`);
  if (!data?.research) return { hit: false, reason: "none" };

  if (processor === "ultra" && data.processor === "base") {
    return { hit: false, reason: "tier" };
  }

  const ageDays = Math.floor((Date.now() - new Date(data.created_at).getTime()) / (24 * 60 * 60 * 1000));

  // The run owns its own copy of the jsonb. Pointing at the donor by id instead
  // would let a donor's deletion empty a completed report.
  // A donor's uploaded-report findings are that client's document; only the
  // web research is shared.
  const { upload: _donorUpload, ...shared } = data.research;
  void _donorUpload;
  return {
    hit: true,
    donorRunId: data.id,
    ageDays,
    research: {
      ...shared,
      source: "cache",
      cache: { donor_run_id: data.id, age_days: ageDays },
    },
  };
}

export function buildResearchEnvelope({
  output,
  basis,
  parallelRunId,
  processor,
}: {
  output: EhsOutput;
  basis: ParallelBasis;
  parallelRunId: string;
  processor: ProcessorTier;
}): ResearchEnvelope {
  return {
    schema_version: SCHEMA_VERSION,
    source: "parallel",
    fetched_at: new Date().toISOString(),
    output,
    basis,
    parallel_run_id: parallelRunId,
    processor,
  };
}

// no_data is a terminal, not a failure (t-004-spec.md D8): the call succeeded
// and there is genuinely nothing. A run with zero web findings but client KPIs
// continues — the client gave us figures, so the report has content.
export function isNoData({
  output,
  clientKpiCount,
  hasUpload,
}: {
  output: EhsOutput;
  clientKpiCount: number;
  hasUpload: boolean;
}): boolean {
  return (
    output.findings.length === 0 &&
    !output.disclosure.has_ehs_disclosure &&
    clientKpiCount === 0 &&
    !hasUpload
  );
}
