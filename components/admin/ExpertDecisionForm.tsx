"use client";

import { useActionState } from "react";
import { setExpertStatus, type AdminActionState } from "@/actions/admin";
import { Button } from "@/components/ui/button";

// Approve / Reject for one application. Two submit buttons on one form, the
// decision carried by the button's value.
export function ExpertDecisionForm({ userId, status }: { userId: string; status: string }) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(setExpertStatus, undefined);

  if (status === "approved") return <span className="text-sm text-success">Approved</span>;
  if (status === "rejected") return <span className="text-sm text-muted-foreground">Rejected</span>;

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" name="decision" value="approve" size="sm" disabled={pending}>
        Approve
      </Button>
      <Button type="submit" name="decision" value="reject" size="sm" variant="outline" disabled={pending}>
        Reject
      </Button>
      {state?.error && <span role="alert" className="text-xs text-destructive">{state.error}</span>}
    </form>
  );
}
