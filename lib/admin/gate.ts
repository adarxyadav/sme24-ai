import "server-only";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/get-user";

// Every admin page starts here: no session -> login, any other role -> the
// role dispatcher. The proxy already requires a session under /admin; this
// is the role check it deliberately does not make (auth.md, Every request).
export async function requireAdmin() {
  const current = await getUser();
  if (!current) redirect("/login?next=/admin");
  if (current.profile.role !== "admin") redirect("/auth/redirect");
  return current;
}
