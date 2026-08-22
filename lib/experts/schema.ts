import { z } from "zod";
import {
  AVAILABILITY,
  COMPETENCIES,
  LANGUAGES,
  NACE_SECTIONS,
  REGIONS,
  keysOf,
} from "@/lib/experts/catalogue";

// The expert profile as the form submits it and as apply_as_expert stores it.
export const expertProfileSchema = z.object({
  full_name: z.string().trim().min(1, "Enter your name.").max(120),
  headline: z.string().trim().min(1, "Enter a one-line headline.").max(160),
  bio: z.string().trim().max(2000, "Keep the bio under 2000 characters.").optional(),
  competencies: z
    .array(z.enum(keysOf(COMPETENCIES)))
    .min(1, "Pick at least one competency.")
    .max(20),
  sectors: z.array(z.enum(keysOf(NACE_SECTIONS))).max(25),
  languages: z.array(z.enum(keysOf(LANGUAGES))).min(1, "Pick at least one language."),
  regions: z.array(z.enum(keysOf(REGIONS))).max(4),
  years_experience: z.number().int().min(0).max(60).optional(),
  availability: z.enum(keysOf(AVAILABILITY)),
});

export type ExpertProfileInput = z.infer<typeof expertProfileSchema>;
