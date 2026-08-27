import { z } from "zod";
import { TIER_IDS } from "@/lib/packages/tiers";

// Stage 5's Output.object schema (t-019-spec.md D3): the proposal's content,
// stored as jsonb and rendered to PDF by code. Vault passages are cited by
// index; code maps them to the stored sources.
export const proposalSchema = z.object({
  title: z.string().min(1),
  executive_summary: z.string().min(1),
  situation: z.array(z.string().min(1)).min(1).max(8),
  key_risks: z
    .array(z.object({ risk: z.string().min(1), why_it_matters: z.string().min(1) }))
    .min(1)
    .max(6),
  recommended_tier: z.enum(TIER_IDS),
  recommendation_rationale: z.string().min(1),
  roadmap: z
    .array(z.object({ phase: z.string().min(1), actions: z.array(z.string().min(1)).min(1).max(5) }))
    .min(1)
    .max(4),
  experts_note: z.string().min(1),
  // Indices into the retrieved passages actually relied on; empty when none.
  passage_indices: z.array(z.number().int().nonnegative()).max(5),
});

export type ProposalContent = z.infer<typeof proposalSchema>;
