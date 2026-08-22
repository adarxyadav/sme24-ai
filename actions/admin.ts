"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth/get-user";
import { createServiceClient } from "@/lib/supabase/service";

// The one admin write: approval or rejection of an expert application.
// auth.md, Data boundary: the service role is reachable from admin-only
// Server Actions that must change profiles.role — after getUser() proves the
// caller is an admin, never before.

export type AdminActionState = { error?: string; done?: boolean } | undefined;

const inputSchema = z.object({
  userId: z.uuid(),
  decision: z.enum(["approve", "reject"]),
});

export async function setExpertStatus(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const current = await getUser();
  if (!current || current.profile.role !== "admin") {
    return { error: "Not allowed." };
  }

  const parsed = inputSchema.safeParse({
    userId: formData.get("userId"),
    decision: formData.get("decision"),
  });
  if (!parsed.success) return { error: "Please check the request and try again." };

  const { userId, decision } = parsed.data;
  const service = createServiceClient();
  const { error } = await service
    .from("profiles")
    .update(
      decision === "approve"
        ? { role: "expert", expert_status: "approved" }
        : { expert_status: "rejected" },
    )
    .eq("id", userId)
    .neq("role", "admin");

  if (error) {
    console.error("setExpertStatus failed", userId, error.message);
    return { error: "We could not update this application. Please try again." };
  }

  revalidatePath("/admin", "layout");
  return { done: true };
}
