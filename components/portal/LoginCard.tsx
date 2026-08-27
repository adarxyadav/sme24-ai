"use client";

import { useActionState, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { MailCheck } from "lucide-react";
import {
  requestMagicLink,
  signInWithGoogle,
  type MagicLinkState,
} from "@/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type LoginCardProps = {
  next: string;
  error?: string;
};

export function LoginCard({ next, error }: LoginCardProps) {
  const [state, formAction, pending] = useActionState<MagicLinkState, FormData>(
    requestMagicLink,
    undefined,
  );
  // Turnstile's token rides the form as a hidden field; Supabase verifies it
  // server-side (auth.md, Dashboard configuration). The site key is public.
  const [captchaToken, setCaptchaToken] = useState("");

  if (state?.sent) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <MailCheck aria-hidden="true" className="size-6 text-primary" />
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent you a sign-in link. Open it on any device and press
            Continue — it expires in one hour.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          No password. We email you a link, or use Google.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {error && <FieldError role="alert">{error}</FieldError>}
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="outline" className="w-full">
            Continue with Google
          </Button>
        </form>
        <FieldSeparator>or</FieldSeparator>
        <form action={formAction} className="flex flex-col gap-6">
          <input type="hidden" name="next" value={next} />
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </Field>
            {state?.error && (
              <FieldError role="alert">{state.error}</FieldError>
            )}
          </FieldGroup>
          <input type="hidden" name="captchaToken" value={captchaToken} />
          <Turnstile
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
            options={{ size: "flexible" }}
            onSuccess={setCaptchaToken}
            onExpire={() => setCaptchaToken("")}
            onError={() => setCaptchaToken("")}
          />
          <Button type="submit" disabled={pending || captchaToken === ""}>
            {pending ? "Sending link…" : "Email me a sign-in link"}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          New here? The link creates your account.
        </p>
      </CardFooter>
    </Card>
  );
}
