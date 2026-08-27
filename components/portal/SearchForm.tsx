"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Paperclip, X } from "lucide-react";
import {
  CANONICAL_METRICS,
  COUNT_METRICS,
  METRIC_LABELS,
  type CanonicalMetric,
} from "@/lib/runs/metrics";
import { Button } from "@/components/ui/button";
import { DisclosureChip } from "@/components/portal/DisclosureChip";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type KpiPayload = { metric: CanonicalMetric; value: number };

const COUNT_METRIC_SET = new Set<string>(COUNT_METRICS);

// Composer-only presentation: an example answers "what format?", the suffix
// keeps the basis visible while typing (the ledger still carries the full
// per-metric hints from lib/runs/metrics.ts).
const METRIC_PLACEHOLDERS: Record<CanonicalMetric, string> = {
  TRIR: "e.g. 1.2",
  LTIFR: "e.g. 0.8",
  total_recordable_injuries: "e.g. 4",
  lost_time_injuries: "e.g. 2",
  fatalities: "e.g. 0",
  near_misses: "e.g. 120",
  hours_worked: "e.g. 500000",
};
const METRIC_SUFFIXES: Partial<Record<CanonicalMetric, string>> = {
  TRIR: "/1M h",
  LTIFR: "/1M h",
  hours_worked: "hours",
};

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
  const [websiteOpen, setWebsiteOpen] = useState(false);
  const [figuresOpen, setFiguresOpen] = useState(false);
  const [websiteFilled, setWebsiteFilled] = useState(false);
  const [figuresCount, setFiguresCount] = useState(0);
  const [periodFilled, setPeriodFilled] = useState(false);
  const [attachedName, setAttachedName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // The disclosures float over the page like a menu, so they close like one:
  // Escape (focus returns to the chip) and any press outside the composer.
  // The open panel is also fitted to the viewport — max-height measured from
  // its top edge to the fold — so it can never clip past the screen.
  useEffect(() => {
    if (!websiteOpen && !figuresOpen) return;
    const chipId = websiteOpen ? "chip-website" : "chip-figures";
    const sectionId = websiteOpen ? "composer-website" : "composer-figures";
    const fit = () => {
      const panel = document.getElementById(sectionId);
      if (!panel) return;
      const room = window.innerHeight - panel.getBoundingClientRect().top - 16;
      panel.style.maxHeight = `${Math.min(416, Math.max(160, room))}px`;
    };
    fit();
    const close = () => {
      setWebsiteOpen(false);
      setFiguresOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      document.getElementById(chipId)?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (
        formRef.current &&
        event.target instanceof Node &&
        !formRef.current.contains(event.target)
      ) {
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", fit);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", fit);
    };
  }, [websiteOpen, figuresOpen]);

  function toggleSection(section: "website" | "figures") {
    const open = section === "website" ? websiteOpen : figuresOpen;
    setWebsiteOpen(section === "website" && !open);
    setFiguresOpen(section === "figures" && !open);
    if (!open) {
      // Focus the first field, but never steal from a field the user has
      // already reached on their own in the meantime.
      requestAnimationFrame(() => {
        const active = document.activeElement;
        if (active instanceof HTMLInputElement) return;
        document
          .getElementById(section === "website" ? "companyDomain" : "reportingPeriod")
          ?.focus();
      });
    }
  }

  function closeFigures() {
    setFiguresOpen(false);
    document.getElementById("chip-figures")?.focus();
  }

  function removeAttachment() {
    if (fileRef.current) fileRef.current.value = "";
    setAttachedName(null);
  }

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
      // The sidebar's analyses history renders in the layout, which push alone
      // does not re-fetch — refresh so the new run appears at once (T-035).
      router.refresh();
    } catch {
      setError("We could not reach the server. Please try again.");
      setPending(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex w-full max-w-2xl flex-col gap-4"
      noValidate={false}
    >
      <div className="relative rounded-xl border bg-card transition-shadow focus-within:border-input focus-within:ring-2 focus-within:ring-ring/30">
        <input
          name="companyName"
          type="text"
          required
          maxLength={200}
          autoComplete="organization"
          autoFocus
          aria-label="Company name"
          placeholder="Company name"
          className="w-full bg-transparent px-5 pt-4 pb-1 text-lg outline-none placeholder:text-muted-foreground"
        />

        {attachedName ? (
          <div className="flex flex-wrap gap-1.5 px-4 pt-1.5">
            <span className="flex items-center gap-2 rounded-full border py-1 pr-1.5 pl-3 text-xs">
              <Paperclip aria-hidden="true" className="size-3 text-muted-foreground" />
              <span className="max-w-64 truncate">{attachedName}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove attached report"
                onClick={removeAttachment}
                className="size-5 rounded-full text-muted-foreground"
              >
                <X aria-hidden="true" className="size-3" />
              </Button>
            </span>
          </div>
        ) : null}

        <div className="flex items-center gap-1 p-3 pt-2">
          <input
            ref={fileRef}
            id="report"
            name="report"
            type="file"
            accept="application/pdf"
            className="hidden"
            tabIndex={-1}
            onChange={(event) =>
              setAttachedName(event.currentTarget.files?.[0]?.name ?? null)
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Attach your latest safety report (PDF)"
            onClick={() => fileRef.current?.click()}
            className="rounded-full text-muted-foreground"
          >
            <Paperclip aria-hidden="true" className="size-4" />
          </Button>
          <DisclosureChip
            id="chip-website"
            label="Website"
            controls="composer-website"
            expanded={websiteOpen}
            filled={websiteFilled}
            onClick={() => toggleSection("website")}
          />
          <DisclosureChip
            id="chip-figures"
            label="Your figures"
            controls="composer-figures"
            expanded={figuresOpen}
            filled={figuresCount > 0 || periodFilled}
            count={figuresCount}
            onClick={() => toggleSection("figures")}
          />
          <Button
            type="submit"
            size="icon"
            disabled={pending}
            aria-label="Run the analysis"
            className="ml-auto rounded-full"
          >
            {pending ? (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <ArrowRight aria-hidden="true" className="size-4" />
            )}
          </Button>
        </div>

        {/* Closed sections stay mounted so their typed values still submit;
            open, they float below the bar — the composer itself never grows. */}
        <div
          id="composer-website"
          hidden={!websiteOpen}
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-y-auto rounded-xl border bg-popover p-5 text-popover-foreground"
        >
          <Field
            onInput={(event) =>
              setWebsiteFilled(
                event.currentTarget.querySelector("input")?.value.trim() !== "",
              )
            }
          >
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
        </div>

        <div
          id="composer-figures"
          hidden={!figuresOpen}
          className="absolute inset-x-0 top-full z-20 mt-2 max-h-[min(26rem,60vh)] overflow-y-auto rounded-xl border bg-popover px-5 py-4 text-popover-foreground"
          onInput={(event) => {
            setFiguresCount(
              Array.from(
                event.currentTarget.querySelectorAll<HTMLInputElement>(
                  'input[type="number"]',
                ),
              ).filter((input) => input.value.trim() !== "").length,
            );
            setPeriodFilled(
              (
                event.currentTarget.querySelector<HTMLInputElement>(
                  "#reportingPeriod",
                )?.value ?? ""
              ).trim() !== "",
            );
          }}
        >
          {/* Examples + in-field unit suffixes replace the eight hint lines,
              so the panel fits the desktop viewport without scrolling
              (per-metric bases still render in the ledger). */}
          <FieldSet className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <FieldLegend>Your figures</FieldLegend>
              <div className="flex items-center gap-2">
                <FieldLabel
                  htmlFor="reportingPeriod"
                  className="text-xs font-normal text-muted-foreground"
                >
                  Reporting period
                </FieldLabel>
                <Input
                  id="reportingPeriod"
                  name="reportingPeriod"
                  maxLength={100}
                  placeholder="2025"
                  className="h-8 w-24"
                />
              </div>
            </div>
            <FieldDescription>
              All optional — we research anything left blank, and your figures
              override what we find.
            </FieldDescription>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {CANONICAL_METRICS.map((metric) => {
                const suffix = METRIC_SUFFIXES[metric];
                return (
                  <Field key={metric} className="gap-1.5">
                    <FieldLabel htmlFor={metric}>
                      {METRIC_LABELS[metric]}
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        id={metric}
                        name={metric}
                        type="number"
                        min={0}
                        step={COUNT_METRIC_SET.has(metric) ? 1 : "any"}
                        inputMode={
                          COUNT_METRIC_SET.has(metric) ? "numeric" : "decimal"
                        }
                        placeholder={METRIC_PLACEHOLDERS[metric]}
                        aria-describedby={suffix ? `${metric}-unit` : undefined}
                        className={suffix ? "pr-14" : undefined}
                      />
                      {suffix ? (
                        <span
                          id={`${metric}-unit`}
                          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground"
                        >
                          {suffix}
                        </span>
                      ) : null}
                    </div>
                  </Field>
                );
              })}
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <span className="text-xs text-muted-foreground">
                {figuresCount === 0
                  ? "No figures yet — we’ll research everything."
                  : `${figuresCount} ${figuresCount === 1 ? "figure" : "figures"} added · kept with your search`}
              </span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={closeFigures}
                className="rounded-full"
              >
                Done
              </Button>
            </div>
          </FieldSet>
        </div>
      </div>

      {error && (
        <FieldError role="alert" className="px-2">
          {error}
        </FieldError>
      )}
    </form>
  );
}
