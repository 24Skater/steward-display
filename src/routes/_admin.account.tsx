import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/auth/AuthCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordFn,
  deleteAccountFn,
  resendVerificationFn,
  signOutEverywhereFn,
  signOutFn,
} from "@/lib/api/auth.functions";
import { errorMessage } from "@/lib/errors";
import { useCanEmail, useChurch, useViewer } from "@/lib/viewer";

export const Route = createFileRoute("/_admin/account")({
  head: () => ({ meta: [{ title: "Your account — Steward Display" }] }),
  component: AccountPage,
});

function AccountPage() {
  const viewer = useViewer();
  const church = useChurch();
  const canEmail = useCanEmail();
  const navigate = useNavigate();

  async function signOut() {
    let ssoSignOutUrl: string | null = null;
    try {
      ({ ssoSignOutUrl } = await signOutFn());
    } finally {
      // Signed in with Steward ID: end that session too, then come back to sign-in.
      if (ssoSignOutUrl) window.location.assign(ssoSignOutUrl);
      else await navigate({ to: "/login", search: { next: "/" }, replace: true });
    }
  }

  async function resend() {
    try {
      const { sent } = await resendVerificationFn();
      if (sent) toast.success(`Sent a confirmation link to ${viewer.email}.`);
      else toast.error("Couldn't send the email just now. Try again in a few minutes.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function signOutElsewhere() {
    try {
      const { signedOut } = await signOutEverywhereFn();
      toast.success(
        signedOut === 0
          ? "You weren't signed in anywhere else."
          : `Signed out of ${signedOut} other browser${signedOut === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader title="Your account" subtitle={church.name} />

      <section className="rounded-xl border border-border bg-card p-6 shadow-steward-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="text-foreground">{viewer.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="break-all text-foreground">
            {viewer.email}{" "}
            {viewer.emailVerified ? (
              <span className="text-xs text-emerald">Confirmed</span>
            ) : canEmail ? (
              <button
                onClick={() => void resend()}
                className="text-xs text-blue underline-offset-4 hover:underline"
              >
                Not confirmed yet: send a link
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">Not confirmed</span>
            )}
          </dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd className="text-foreground">{viewer.role === "OWNER" ? "Owner" : "Editor"}</dd>
        </dl>
      </section>

      <ChangePassword />

      <section className="mt-6 rounded-xl border border-border bg-card p-6 shadow-steward-sm">
        <h2 className="text-h3 font-semibold">Signing out</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Lost a phone or used a shared computer? Sign out everywhere else and stay signed in here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={signOutElsewhere}>
            Sign out everywhere else
          </Button>
          <Button variant="ghost" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </section>

      <DeleteAccount />
    </main>
  );
}

function DeleteAccount() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await deleteAccountFn({ data: { password } });
      toast.success("Your account is deleted.");
      await navigate({ to: "/login", search: { next: "/" }, replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-destructive/30 bg-card p-6 shadow-steward-sm">
      <h2 className="text-h3 font-semibold">Delete your account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Removes you from every church you help at. Screens and TVs stay with the church. This can't
        be undone.
      </p>
      {open ? (
        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="delete-password">Enter your password to confirm</Label>
            <Input
              id="delete-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <FormError id="delete-error" message={error} />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="destructive" disabled={busy || !password}>
              {busy ? "Deleting…" : "Delete my account"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep it
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" className="mt-4 text-destructive" onClick={() => setOpen(true)}>
          Delete my account…
        </Button>
      )}
    </section>
  );
}

function ChangePassword() {
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { signedOut } = await changePasswordFn({ data: { currentPassword, newPassword } });
      setCurrent("");
      setNew("");
      toast.success(
        signedOut > 0
          ? `Password changed. Signed out of ${signedOut} other browser${signedOut === 1 ? "" : "s"}.`
          : "Password changed.",
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-6 shadow-steward-sm">
      <h2 className="text-h3 font-semibold">Change password</h2>
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            minLength={10}
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
            aria-describedby="new-password-hint"
          />
          <p id="new-password-hint" className="text-xs text-muted-foreground">
            At least 10 characters. Changing it signs you out everywhere else.
          </p>
        </div>
        <FormError id="password-error" message={error} />
        <Button type="submit" variant="outline" disabled={busy || !currentPassword || !newPassword}>
          {busy ? "Changing…" : "Change password"}
        </Button>
      </form>
    </section>
  );
}
