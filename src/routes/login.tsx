import { Link, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { AuthCard, FormError } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAppState, signInFn } from "@/lib/api/auth.functions";
import { errorMessage } from "@/lib/errors";
import { safeNext } from "@/lib/viewer";

/** What a failed Steward ID sign-in comes back with, in words a volunteer can act on. */
const SSO_ERRORS: Record<string, string> = {
  sso_no_account:
    "That Steward ID isn't on this church's team. Ask an owner to invite the address you signed in with.",
  sso_unverified:
    "Steward ID hasn't confirmed that email address yet. Confirm it there, then try again.",
  sso_expired: "That sign-in took too long. Try again.",
  sso_failed: "Steward ID sign-in didn't complete. Try again.",
  sso_unavailable: "Steward ID can't be reached right now. Try again, or use your password.",
  sso_busy: "Too many sign-in attempts. Wait a few minutes and try again.",
  sso_mismatch:
    "This account is linked to a different Steward ID. Sign in with that one, or with your password.",
};

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { next: string; error?: string } => ({
    next: safeNext(search.next),
    ...(typeof search.error === "string" ? { error: search.error } : {}),
  }),
  beforeLoad: async ({ search }) => {
    const state = await getAppState();
    if (!state.church) throw redirect({ to: "/setup" });
    if (state.viewer) throw redirect({ href: search.next });
    return {
      churchName: state.church.name,
      canEmail: state.canEmail,
      sso: state.sso,
      passwordLogin: state.passwordLogin,
    };
  },
  head: () => ({ meta: [{ title: "Sign in — Steward Display" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { next, error: ssoError } = Route.useSearch();
  const { churchName, canEmail, sso, passwordLogin } = Route.useRouteContext();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    ssoError ? (SSO_ERRORS[ssoError] ?? SSO_ERRORS.sso_failed) : null,
  );
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
      {sso && (
        <>
          <Button asChild className="w-full">
            {/* A full page load, not a router navigation: it leaves for the identity provider. */}
            <a href={`/api/auth/sso/start?next=${encodeURIComponent(next)}`}>{sso.label}</a>
          </Button>
          {passwordLogin && (
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or with email and password
              <span className="h-px flex-1 bg-border" />
            </div>
          )}
        </>
      )}

      {!passwordLogin && <FormError id="login-error" message={error} />}

      {passwordLogin && (
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
          <Button
            type="submit"
            variant={sso ? "outline" : "default"}
            className="w-full"
            disabled={busy || !email || !password}
          >
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
      )}
    </AuthCard>
  );
}
