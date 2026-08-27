import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateText, Output } from "ai";
import { z } from "zod";
import { pipelineModel } from "@/lib/extraction/extract";
import { UPLOADS_BUCKET } from "@/lib/upload/bucket";

// Stage 1 step 4 (pipeline-rules.md): the client's own report, read by the
// pipeline model through the Gateway as a file part. Same finding shape as
// the web result so stage 2 maps both with one prompt; `origin: "upload"` is
// what lets those findings override the web ones for any metric they cover.

const uploadFindingSchema = z.object({
  metric: z.string(),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  basis: z.string().nullable(),
  period: z.string().nullable(),
  scope: z.enum(["employees", "combined", "contractors"]).nullable(),
  source_excerpt: z.string().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
});

const uploadReadSchema = z.object({
  document_title: z.string().nullable(),
  findings: z.array(uploadFindingSchema),
  notes: z.string().nullable(),
});

export type UploadFinding = z.infer<typeof uploadFindingSchema>;

export type UploadRead = {
  path: string;
  read_at: string;
  model: string;
  document_title: string | null;
  findings: UploadFinding[];
  notes: string | null;
};

export async function readUploadedReport(
  service: SupabaseClient,
  { path, companyName, signal }: { path: string; companyName: string; signal?: AbortSignal },
): Promise<UploadRead> {
  const { data, error } = await service.storage.from(UPLOADS_BUCKET).download(path);
  if (error || !data) throw new Error(`upload download failed: ${error?.message ?? "no data"}`);
  const bytes = new Uint8Array(await data.arrayBuffer());

  const model = pipelineModel();
  const { output } = await generateText({
    model,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: [
              `This PDF is a safety or sustainability report uploaded by ${companyName}.`,
              "List every occupational health and safety performance figure it states for this company — injury rates, incident counts, fatalities, near misses, hours worked — exactly as written: the metric name as the document labels it, the numeric value, the unit, the stated denominator as basis (e.g. 'per 1,000,000 hours worked' — the denominator only, never the scope), the scope in its own field, the period and a short verbatim excerpt containing the figure.",
              "Do not convert rates between bases, do not estimate, do not add figures the document does not state. If it states none, return an empty findings list.",
            ].join(" "),
          },
          { type: "file", data: bytes, mediaType: "application/pdf", filename: "report.pdf" },
        ],
      },
    ],
    output: Output.object({ schema: uploadReadSchema, name: "uploaded_report" }),
    maxRetries: 0,
    abortSignal: signal,
  });

  return {
    path,
    read_at: new Date().toISOString(),
    model,
    document_title: output.document_title,
    findings: output.findings,
    notes: output.notes,
  };
}
