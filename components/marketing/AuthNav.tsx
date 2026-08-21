import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export async function AuthNav() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims.email === "string" ? data.claims.email : null;

  if (!email) {
    return (
      <Link href="/login" className={buttonVariants({ size: "sm" })}>
        Sign in
      </Link>
    );
  }

  return (
    <>
      <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>
      <form action={logout}>
        <Button type="submit" variant="ghost" size="sm">
          <LogOut aria-hidden="true" />
          Log out
        </Button>
      </form>
    </>
  );
}
