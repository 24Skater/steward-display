import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { AuthCard, FormError } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvitationFn, describeInvitationFn } from "@/lib/api/team.functions";
import { errorMessage } from "@/lib/errors";

export const Route = createFileRoute("/invite/$token")({
  loader: ({ params }) => describeInvitationFn({ data: { token: params.token } }),
  head: () => ({ meta: [{ title: "Join your church — Steward Display" }] }),
  component: InvitePage,
});

function InvitePage() {
  const invitation = Route.useLoaderData();
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!invitation) {
    return (
      <AuthCard title="This invitation has expired">
        <p className="text-sm text-muted-foreground">
          Invitations work once, for seven days. Ask whoever invited you to send a new one.
        </p>
      </AuthCard>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await acceptInvitationFn({
        data: { token, password, name: invitation!.hasAccount ? undefined : name },
      });
      await navigate({ to: "/", replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const role = invitation.role === "OWNER" ? "an owner" : "an editor";
  return (
    <AuthCard
      title={`Join ${invitation.churchName}`}
      subtitle={`You've been invited as ${role}, as ${invitation.email}.`}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {invitation.hasAccount ? (
          <p className="text-sm text-muted-foreground">
            You already have a Steward Display account. Enter its password to join.
          </p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              autoComplete="name"
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="password">
            {invitation.hasAccount ? "Password" : "Choose a password"}
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete={invitation.hasAccount ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={invitation.hasAccount ? undefined : "password-hint"}
          />
          {!invitation.hasAccount && (
            <p id="password-hint" className="text-xs text-muted-foreground">
              At least 10 characters. A short sentence works well.
            </p>
          )}
        </div>
        <FormError id="invite-error" message={error} />
        <Button
          type="submit"
          className="w-full"
          disabled={busy || !password || (!invitation.hasAccount && !name.trim())}
        >
          {busy ? "Joining…" : `Join ${invitation.churchName}`}
        </Button>
      </form>
    </AuthCard>
  );
}
