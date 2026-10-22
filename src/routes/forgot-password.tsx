import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { AuthCard, FormError } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordFn, getAppState } from "@/lib/api/auth.functions";
import { errorMessage } from "@/lib/errors";

export const Route = createFileRoute("/forgot-password")({
  beforeLoad: async () => {
    const state = await getAppState();
    if (!state.church) throw redirect({ to: "/setup" });
    return { churchName: state.church.name, canEmail: state.canEmail };
  },
  head: () => ({ meta: [{ title: "Forgot password — Steward Display" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { churchName, canEmail } = Route.useRouteContext();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await forgotPasswordFn({ data: { email } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <p className="mt-6 text-center text-sm">
      <Link
        to="/login"
        search={{ next: "/" }}
        className="text-blue underline-offset-4 hover:underline"
      >
        Back to sign in
      </Link>
    </p>
  );

  if (!canEmail) {
    return (
      <AuthCard title="Forgot your password?" subtitle={churchName}>
        <p className="text-sm text-muted-foreground">
          This server isn't set up to send email. Ask whoever runs Steward Display for your church
          to reset it: it takes them one command.
        </p>
        {back}
      </AuthCard>
    );
  }

  if (sent) {
    return (
      <AuthCard title="Check your email" subtitle={churchName}>
        <p className="text-sm text-muted-foreground">
          If {email} has an account here, a link to choose a new password is on its way. It works
          once, for one hour. Nothing arriving? Check spam, or ask whoever runs Display for your
          church.
        </p>
        {back}
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Forgot your password?" subtitle={churchName}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Your email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={error ? "forgot-error" : undefined}
          />
        </div>
        <FormError id="forgot-error" message={error} />
        <Button type="submit" className="w-full" disabled={busy || !email.trim()}>
          {busy ? "Sending…" : "Email me a reset link"}
        </Button>
      </form>
      {back}
    </AuthCard>
  );
}
