import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText } from "@/lib/vault/embedding";

export type VaultPassage = {
  id: string;
  title: string;
  source: string | null;
  content: string;
  similarity: number;
};

const MATCH_COUNT = 5;

// Cosine top-k over the vault. An empty vault returns [] and the proposal is
// drafted ungrounded (pipeline-rules.md, Stage 5).
export async function retrievePassages(
  service: SupabaseClient,
  query: string,
  signal?: AbortSignal,
): Promise<VaultPassage[]> {
  const embedding = await embedText(query, signal);
  const { data, error } = await service.rpc("match_ehs_documents", {
    query_embedding: embedding,
    match_count: MATCH_COUNT,
  });
  if (error) throw new Error(`vault retrieval failed: ${error.message}`);
  // No generated DB types; the function's declared row shape is VaultPassage.
  return (data ?? []) as VaultPassage[];
}
