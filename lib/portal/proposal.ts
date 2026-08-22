import "server-only";
import { createClient } from "@/lib/supabase/server";
import { tierById, type Tier } from "@/lib/packages/tiers";
import type { ProposalContent } from "@/lib/proposal/schema";

// Stage 5's output for the dashboard. The proposal row is RLS-scoped to the
// run's owner, and so is the object: the signed URL is minted by the session
// client under the storage policy keyed on run ownership (t-019-spec.md D5),
// so the dashboard never holds a service credential or a public path.

export type ProposalSource = { id: string; title: string; source: string | null; similarity: number };

export type Proposal = {
  content: ProposalContent;
  tier: Tier;
  sources: ProposalSource[];
  // Short-lived; minted per page render.
  downloadUrl: string | null;
  created_at: string;
};

type StoredProposal = {
  content: ProposalContent;
  pdf_path: string;
  sources: ProposalSource[];
  created_at: string;
};

const BUCKET = "proposals";
const SIGNED_URL_SECONDS = 60;

export async function getRunProposal(runId: string): Promise<Proposal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("proposals")
    .select("content, pdf_path, sources, created_at")
    .eq("run_id", runId)
    .maybeSingle<StoredProposal>();

  if (error) {
    console.error("proposal lookup failed", runId, error.message);
    return null;
  }
  if (!data) return null;

  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(data.pdf_path, SIGNED_URL_SECONDS, { download: "SME24-proposal.pdf" });
  if (signError) {
    console.error("proposal signed url failed", runId, signError.message);
  }

  return {
    content: data.content,
    tier: tierById(data.content.recommended_tier),
    sources: data.sources,
    downloadUrl: signed?.signedUrl ?? null,
    created_at: data.created_at,
  };
}
