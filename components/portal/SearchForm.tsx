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
  const [figuresFilled, setFiguresFilled] = useState(false);
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
      requestAnimationFrame(() =>
        document
          .getElementById(section === "website" ? "companyDomain" : "reportingPeriod")
          ?.focus(),
      );
    }
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
            filled={figuresFilled}
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
          className="absolute inset-x-0 top-full z-20 mt-2 max-h-[min(26rem,60vh)] overflow-y-auto rounded-xl border bg-popover p-5 text-popover-foreground"
          onInput={(event) =>
            setFiguresFilled(
              Array.from(event.currentTarget.querySelectorAll("input")).some(
                (input) => input.value.trim() !== "",
              ),
            )
          }
        >
          {/* One shared basis line instead of a hint per field keeps the
              panel short enough to fit without scrolling (per-metric bases
              still render in the ledger, lib/portal/ledger.ts). */}
          <FieldSet className="gap-4">
            <div className="flex flex-col gap-1">
              <FieldLegend>Your figures</FieldLegend>
              <FieldDescription>
                All optional — we research anything left blank, and your figures
                override what we find. Rates per 1&#39;000&#39;000 hours worked;
                counts and hours for the past year.
              </FieldDescription>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Field className="gap-1.5">
                <FieldLabel htmlFor="reportingPeriod">
                  Reporting period
                </FieldLabel>
                <Input
                  id="reportingPeriod"
                  name="reportingPeriod"
                  maxLength={100}
                  placeholder="2025"
                />
              </Field>
              {CANONICAL_METRICS.map((metric) => (
                <Field key={metric} className="gap-1.5">
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
                </Field>
              ))}
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
