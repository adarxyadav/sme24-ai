"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CircleAlert, Loader2, Paperclip, X } from "lucide-react";
import {
  CANONICAL_METRICS,
  COUNT_METRICS,
  METRIC_LABELS,
  RATE_METRICS,
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
import {
  ValueInput,
  parseLocaleNumber,
} from "@/components/portal/ValueInput";

type KpiPayload = { metric: CanonicalMetric; value: number };

// A placeholder is a realistic example value — it teaches the expected format
// and magnitude, never an instruction (the basis lives in the group caption).
const METRIC_PLACEHOLDERS: Record<CanonicalMetric, string> = {
  TRIR: "1.2",
  LTIFR: "0.8",
  total_recordable_injuries: "4",
  lost_time_injuries: "2",
  fatalities: "0",
  near_misses: "120",
  hours_worked: "500'000",
};

// One caption per group instead of a basis subtitle on every row — the two
// bases the contract knows are the only repetition the ledger would carry.
const METRIC_GROUPS: { id: string; caption: string; metrics: readonly CanonicalMetric[] }[] = [
  { id: "figures-basis-rates", caption: "Per 1'000'000 hours worked", metrics: RATE_METRICS },
  { id: "figures-basis-year", caption: "Past year", metrics: COUNT_METRICS },
];

// fromEntries widens the key type; the entries are exactly the canonical set.
const EMPTY_FIGURES = Object.fromEntries(
  CANONICAL_METRICS.map((metric) => [metric, ""]),
) as Record<CanonicalMetric, string>;

// Blank or unparseable means "not supplied" and is dropped, never sent as an
// empty string: the route rejects "" rather than coercing it, so a zero is
// only ever recorded because the client typed one (t-003-spec.md D7). The
// tolerant parser accepts locale formatting; it never blocks submit.
function collectKpis(figures: Record<CanonicalMetric, string>): KpiPayload[] {
  const kpis: KpiPayload[] = [];
  for (const metric of CANONICAL_METRICS) {
    const value = parseLocaleNumber(figures[metric]);
    if (value === null) continue;
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
  const [figures, setFigures] = useState(EMPTY_FIGURES);
  const [period, setPeriod] = useState("");
  const [attachedName, setAttachedName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const figureRefs = useRef<(HTMLInputElement | null)[]>([]);

  const figuresCount = CANONICAL_METRICS.filter(
    (metric) => figures[metric].trim() !== "",
  ).length;
  const periodFilled = period.trim() !== "";

  // The disclosures float over the page like a menu, so they close like one,
  // and the open panel is fitted to the viewport rather than clipping past
  // the fold.
  useEffect(() => {
    if (!websiteOpen && !figuresOpen) return;
    const chipId = websiteOpen ? "chip-website" : "chip-figures";
    const sectionId = websiteOpen ? "composer-website" : "composer-figures";
    const fit = () => {
      const panel = document.getElementById(sectionId);
      if (!panel) return;
      const room = window.innerHeight - panel.getBoundingClientRect().top - 16;
      panel.style.maxHeight = `${Math.min(512, Math.max(160, room))}px`;
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

  // Enter advances through the ledger like rows in a sheet (the reporting
  // period is row -1); on the last row it falls through to the form's
  // implicit submission.
  function onFigureKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key !== "Enter") return;
    if (index === CANONICAL_METRICS.length - 1) return;
    event.preventDefault();
    figureRefs.current[index + 1]?.focus();
  }

  function removeAttachment() {
    if (fileRef.current) fileRef.current.value = "";
    setAttachedName(null);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Counts are integers in the run contract (the route rejects fractions,
    // and rounding would invent a figure) — name the field here instead of
    // failing the whole run with the route's generic 400.
    const fractionalCount = COUNT_METRICS.find((metric) => {
      const value = parseLocaleNumber(figures[metric]);
      return value !== null && !Number.isInteger(value);
    });
    if (fractionalCount) {
      setError(`${METRIC_LABELS[fractionalCount]} must be a whole number.`);
      return;
    }

    setPending(true);

    const form = new FormData(event.currentTarget);
    const companyDomain = String(form.get("companyDomain") ?? "").trim();
    const reportingPeriod = period.trim();
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
          kpis: collectKpis(figures),
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
      <div className="relative">
        {/* The panels are siblings of the bar, not children, so the bar's
            focus ring reflects only its own fields — a panel holding focus
            leaves the bar at rest. */}
        <div className="rounded-xl border bg-card transition-[border-color,box-shadow] focus-within:border-input focus-within:ring-2 focus-within:ring-ring/30">
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
        </div>

        {/* Closed sections stay mounted so their typed values still submit;
            open, they float below the bar — the composer itself never grows. */}
        <div
          id="composer-website"
          hidden={!websiteOpen}
          className="absolute inset-x-0 top-full z-20 mt-2 overflow-y-auto rounded-xl border bg-popover px-5 pt-4 pb-5 text-popover-foreground"
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
          className="absolute inset-x-0 top-full z-20 mt-2 max-h-[min(32rem,60vh)] overflow-y-auto rounded-xl border bg-popover px-5 pt-4 pb-5 text-popover-foreground"
        >
          <FieldSet className="gap-2">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <FieldLegend variant="label">Your figures</FieldLegend>
              {figuresCount > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {figuresCount} added
                </span>
              ) : null}
            </div>
            <div>
              <div className="flex items-center justify-between gap-4 py-0.5">
                <FieldLabel htmlFor="reportingPeriod">
                  Reporting period
                </FieldLabel>
                <ValueInput
                  id="reportingPeriod"
                  name="reportingPeriod"
                  inputMode="text"
                  maxLength={100}
                  value={period}
                  onChange={(event) => setPeriod(event.target.value)}
                  onKeyDown={(event) => onFigureKeyDown(event, -1)}
                  placeholder="2025"
                  className="w-28 shrink-0"
                />
              </div>
              {METRIC_GROUPS.map((group) => (
                <div key={group.id}>
                  <p
                    id={group.id}
                    className="pt-1.5 pb-0.5 text-xs text-muted-foreground"
                  >
                    {group.caption}
                  </p>
                  <div className="divide-y divide-border/50">
                    {group.metrics.map((metric) => {
                      const index = CANONICAL_METRICS.indexOf(metric);
                      return (
                        <div
                          key={metric}
                          className="flex items-center justify-between gap-4 py-0.5"
                        >
                          <FieldLabel htmlFor={metric}>
                            {METRIC_LABELS[metric]}
                          </FieldLabel>
                          <ValueInput
                            id={metric}
                            name={metric}
                            ref={(el) => {
                              figureRefs.current[index] = el;
                            }}
                            value={figures[metric]}
                            onChange={(event) =>
                              setFigures((prev) => ({
                                ...prev,
                                [metric]: event.target.value,
                              }))
                            }
                            onKeyDown={(event) => onFigureKeyDown(event, index)}
                            placeholder={METRIC_PLACEHOLDERS[metric]}
                            aria-describedby={group.id}
                            className="w-28 shrink-0"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t pt-2">
              <p className="text-xs text-muted-foreground">
                Figures you enter override what we research and appear as
                client-provided in your report.
              </p>
            </div>
          </FieldSet>
        </div>
      </div>

      {error && (
        <FieldError role="alert" className="flex items-center gap-2 px-2">
          <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
          {error}
        </FieldError>
      )}
    </form>
  );
}
