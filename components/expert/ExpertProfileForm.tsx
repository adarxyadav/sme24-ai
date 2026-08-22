"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveExpertProfile, type ExpertFormState } from "@/actions/expert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  AVAILABILITY,
  COMPETENCIES,
  LANGUAGES,
  NACE_SECTIONS,
  REGIONS,
} from "@/lib/experts/catalogue";
import type { ExpertRow } from "@/lib/experts/read";

type Props = {
  // Null on a first application; the stored row when editing.
  expert: ExpertRow | null;
  submitLabel: string;
};

function CheckboxGroup({
  name,
  legend,
  description,
  options,
  selected,
  error,
}: {
  name: string;
  legend: string;
  description?: string;
  options: Record<string, string>;
  selected: readonly string[];
  error?: string;
}) {
  return (
    <FieldSet>
      <FieldLegend>{legend}</FieldLegend>
      {description && <FieldDescription>{description}</FieldDescription>}
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(options).map(([key, label]) => (
          <Field key={key} orientation="horizontal">
            <Checkbox id={`${name}-${key}`} name={name} value={key} defaultChecked={selected.includes(key)} />
            <FieldLabel htmlFor={`${name}-${key}`} className="font-normal">
              {label}
            </FieldLabel>
          </Field>
        ))}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </FieldSet>
  );
}

// One form for applying and for editing: the Server Action is the same upsert.
export function ExpertProfileForm({ expert, submitLabel }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ExpertFormState, FormData>(
    saveExpertProfile,
    undefined,
  );
  const errors = state?.errors ?? {};

  // The page decides what to show from the profile's status, so a successful
  // save re-reads it.
  useEffect(() => {
    if (state?.saved) router.refresh();
  }, [state?.saved, router]);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="full_name">Name</FieldLabel>
          <Input id="full_name" name="full_name" defaultValue={expert?.full_name ?? ""} required maxLength={120} aria-invalid={!!errors.full_name} />
          {errors.full_name && <FieldError>{errors.full_name}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="headline">Headline</FieldLabel>
          <Input id="headline" name="headline" defaultValue={expert?.headline ?? ""} required maxLength={160} placeholder="e.g. Machine safety and ISO 45001 for manufacturing SMEs" aria-invalid={!!errors.headline} />
          <FieldDescription>One line a client reads first.</FieldDescription>
          {errors.headline && <FieldError>{errors.headline}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="bio">About you</FieldLabel>
          <Textarea id="bio" name="bio" defaultValue={expert?.bio ?? ""} maxLength={2000} rows={5} aria-invalid={!!errors.bio} />
          <FieldDescription>Background, typical engagements, certifications. Optional.</FieldDescription>
          {errors.bio && <FieldError>{errors.bio}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="years_experience">Years of EHS experience</FieldLabel>
          <Input id="years_experience" name="years_experience" type="number" inputMode="numeric" min={0} max={60} defaultValue={expert?.years_experience ?? ""} className="max-w-32" aria-invalid={!!errors.years_experience} />
          {errors.years_experience && <FieldError>{errors.years_experience}</FieldError>}
        </Field>
      </FieldGroup>

      <CheckboxGroup name="competencies" legend="Competencies" description="What you are matched on. Pick everything you deliver yourself." options={COMPETENCIES} selected={expert?.competencies ?? []} error={errors.competencies} />
      <CheckboxGroup name="sectors" legend="Sectors" description="Industries you know from the inside. Optional." options={NACE_SECTIONS} selected={expert?.sectors ?? []} error={errors.sectors} />
      <CheckboxGroup name="languages" legend="Working languages" options={LANGUAGES} selected={expert?.languages ?? []} error={errors.languages} />
      <CheckboxGroup name="regions" legend="Regions" description="Where you work on site. Optional." options={REGIONS} selected={expert?.regions ?? []} error={errors.regions} />

      <FieldSet>
        <FieldLegend>Availability</FieldLegend>
        <RadioGroup name="availability" defaultValue={expert?.availability ?? "available"}>
          {Object.entries(AVAILABILITY).map(([key, label]) => (
            <Field key={key} orientation="horizontal">
              <RadioGroupItem id={`availability-${key}`} value={key} />
              <FieldLabel htmlFor={`availability-${key}`} className="font-normal">{label}</FieldLabel>
            </Field>
          ))}
        </RadioGroup>
      </FieldSet>

      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.saved && <p role="status" className="text-sm text-success">Saved.</p>}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
