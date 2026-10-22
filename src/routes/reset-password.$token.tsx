import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AuthCard, FormError } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordFn } from "@/lib/api/auth.functions";
import { errorMessage } from "@/lib/errors";

export const Route = createFileRoute("/reset-password/$token")({
  head: () => ({ meta: [{ title: "Choose a new password — Steward Display" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await resetPasswordFn({ data: { token, newPassword: password } });
      toast.success("Password changed. Sign in with your new one.");
      await navigate({ to: "/login", search: { next: "/" }, replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Choose a new password"
      subtitle="You'll be signed out everywhere else, in case someone else knew the old one."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least 10 characters.
          </p>
        </div>
        <FormError id="reset-error" message={error} />
        <Button type="submit" className="w-full" disabled={busy || password.length < 10}>
          {busy ? "Saving…" : "Save new password"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link to="/forgot-password" className="text-blue underline-offset-4 hover:underline">
          Need a new link?
        </Link>
      </p>
    </AuthCard>
  );
}
