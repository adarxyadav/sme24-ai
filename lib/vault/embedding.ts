import "server-only";
import { embed } from "ai";

// The EHS Vault's embedding model (t-019-spec.md D2). One model, one
// dimension: ehs_documents.embedding is vector(1536) and match_ehs_documents
// takes the same, so a model change is a migration, not an env var. Routed
// through the Gateway like every other model call (library-docs.md).
export const EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

export async function embedText(value: string, signal?: AbortSignal): Promise<number[]> {
  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value,
    maxRetries: 0,
    abortSignal: signal,
  });
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`embedding has ${embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`);
  }
  return embedding;
}
