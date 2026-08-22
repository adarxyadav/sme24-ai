"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CANONICAL_METRICS,
  COUNT_METRICS,
  METRIC_HINTS,
  METRIC_LABELS,
  type CanonicalMetric,
} from "@/lib/runs/metrics";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type KpiPayload = { metric: CanonicalMetric; value: number };

const COUNT_METRIC_SET = new Set<string>(COUNT_METRICS);

// Blank means "not supplied" and is dropped, never sent as an empty string: the
// route rejects "" rather than coercing it, so a zero is only ever recorded
// because the client typed one (t-003-spec.md D7).
function collectKpis(form: FormData): KpiPayload[] {
  const kpis: KpiPayload[] = [];
  for (const metric of CANONICAL_METRICS) {
    const raw = form.get(metric);
    if (typeof raw !== "string" || raw.trim() === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    kpis.push({ metric, value });
  }
  return kpis;
}

export function SearchForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(event.currentTarget);
    const companyDomain = String(form.get("companyDomain") ?? "").trim();
    const reportingPeriod = String(form.get("reportingPeriod") ?? "").trim();
    const report = form.get("report");

    try {
      // The report goes up first, on its own route; the run then carries only
      // the returned path, which the trigger route checks against the session.
      let uploadedReportPath: string | undefined;
      if (report instanceof File && report.size > 0) {
        const upload = new FormData();
        upload.set("file", report);
        const uploadResponse = await fetch("/api/uploads", { method: "POST", body: upload });
        const uploadBody: unknown = await uploadResponse.json().catch(() => null);
        if (!uploadResponse.ok) {
          const message =
            uploadBody && typeof uploadBody === "object" && "error" in uploadBody &&
            typeof uploadBody.error === "string"
              ? uploadBody.error
              : "We could not upload the report. Please try again.";
          setError(message);
          setPending(false);
          return;
        }
        if (uploadBody && typeof uploadBody === "object" && "path" in uploadBody && typeof uploadBody.path === "string") {
          uploadedReportPath = uploadBody.path;
        }
      }

      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: String(form.get("companyName") ?? "").trim(),
          ...(companyDomain ? { companyDomain } : {}),
          ...(reportingPeriod ? { reportingPeriod } : {}),
          ...(uploadedReportPath ? { uploadedReportPath } : {}),
          kpis: collectKpis(form),
        }),
      });

      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          body && typeof body === "object" && "error" in body &&
          typeof body.error === "string"
            ? body.error
            : "We could not start your search. Please try again.";
        setError(message);
        setPending(false);
        return;
      }

      const runId =
        body && typeof body === "object" && "runId" in body &&
        typeof body.runId === "string"
          ? body.runId
          : null;
      if (!runId) {
        setError("We could not start your search. Please try again.");
        setPending(false);
        return;
      }

      router.push(`/dashboard/runs/${runId}`);
    } catch {
      setError("We could not reach the server. Please try again.");
      setPending(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Benchmark your safety KPIs</CardTitle>
        <CardDescription>
          Your company name is enough. Add your own figures if you have them —
          they override anything we find.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-8" noValidate={false}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="companyName">Company name</FieldLabel>
              <Input
                id="companyName"
                name="companyName"
                required
                maxLength={200}
                autoComplete="organization"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="companyDomain">Website</FieldLabel>
              <Input
                id="companyDomain"
                name="companyDomain"
                maxLength={253}
                autoComplete="url"
                placeholder="example.ch"
              />
              <FieldDescription>
                Optional. Helps us find the right company.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="report">Your latest safety report (PDF)</FieldLabel>
              <Input id="report" name="report" type="file" accept="application/pdf" />
              <FieldDescription>
                Optional. Figures in your own report override what we find on the web. PDF, up to 20 MB; it never leaves our EU systems.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <FieldSet>
            <FieldLegend>Your figures</FieldLegend>
            <FieldDescription>
              All optional. Anything you leave blank, we research.
            </FieldDescription>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="reportingPeriod">
                  Reporting period
                </FieldLabel>
                <Input
                  id="reportingPeriod"
                  name="reportingPeriod"
                  maxLength={100}
                  placeholder="2025"
                />
                <FieldDescription>
                  Applies to every figure below.
                </FieldDescription>
              </Field>
              <div className="grid gap-6 sm:grid-cols-2">
                {CANONICAL_METRICS.map((metric) => (
                  <Field key={metric}>
                    <FieldLabel htmlFor={metric}>
                      {METRIC_LABELS[metric]}
                    </FieldLabel>
                    <Input
                      id={metric}
                      name={metric}
                      type="number"
                      min={0}
                      step={COUNT_METRIC_SET.has(metric) ? 1 : "any"}
                      inputMode={
                        COUNT_METRIC_SET.has(metric) ? "numeric" : "decimal"
                      }
                    />
                    <FieldDescription>{METRIC_HINTS[metric]}</FieldDescription>
                  </Field>
                ))}
              </div>
            </FieldGroup>
          </FieldSet>

          {error && <FieldError role="alert">{error}</FieldError>}

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Starting…" : "Run the analysis"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
