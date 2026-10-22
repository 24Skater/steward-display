import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { AuthCard, FormError } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAppState, signInFn } from "@/lib/api/auth.functions";
import { errorMessage } from "@/lib/errors";
import { safeNext } from "@/lib/viewer";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({ next: safeNext(search.next) }),
  beforeLoad: async ({ search }) => {
    const state = await getAppState();
    if (!state.church) throw redirect({ to: "/setup" });
    if (state.viewer) throw redirect({ href: search.next });
    return { churchName: state.church.name, canEmail: state.canEmail };
  },
  head: () => ({ meta: [{ title: "Sign in — Steward Display" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { next } = Route.useSearch();
  const { churchName, canEmail } = Route.useRouteContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInFn({ data: { email, password } });
      await navigate({ href: next, replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Sign in" subtitle={churchName}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={error ? "login-error" : undefined}
          />
        </div>
        <FormError id="login-error" message={error} />
        <Button type="submit" className="w-full" disabled={busy || !email || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="text-blue underline-offset-4 hover:underline">
            Forgot your password?
          </Link>
          {!canEmail && (
            <span className="block text-xs text-muted-foreground">
              Whoever runs Display for your church can reset it.
            </span>
          )}
        </p>
      </form>
    </AuthCard>
  );
}
