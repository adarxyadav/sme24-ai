import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { getUser } from "@/lib/auth/get-user";

export async function AuthNav() {
  const current = await getUser();
  const email = current?.user.email ?? null;

  if (!current) {
    return (
      <Link href="/login" className={buttonVariants({ size: "sm" })}>
        Log in
      </Link>
    );
  }

  // The expert surface for experts; the application page for everyone else.
  const expertHref = current.profile.role === "expert" ? "/expert" : "/expert/apply";

  return (
    <>
      <Link href={expertHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
        {current.profile.role === "expert" ? "Expert area" : "For experts"}
      </Link>
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
