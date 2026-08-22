import { z } from "zod";
import { COMPETENCIES, keysOf } from "@/lib/experts/catalogue";

// Stage 4's Output.object schema (t-018-spec.md). The model derives the risk
// profile and ranks experts by index; code maps indices back to rows and
// writes nothing the schema did not bound.
export const matchingSchema = z.object({
  risk_profile: z.object({
    summary: z.string(),
    competencies_needed: z.array(z.enum(keysOf(COMPETENCIES))).max(6),
  }),
  matches: z
    .array(
      z.object({
        expert_index: z.number().int().nonnegative(),
        score: z.number().int().min(0).max(100),
        rationale: z.string().min(1),
      }),
    )
    .max(3),
});

export type Matching = z.infer<typeof matchingSchema>;
