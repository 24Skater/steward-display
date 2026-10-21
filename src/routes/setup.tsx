import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { AuthCard, FormError } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAppState, setUpFn } from "@/lib/api/auth.functions";
import { errorMessage } from "@/lib/errors";

export const Route = createFileRoute("/setup")({
  beforeLoad: async () => {
    const state = await getAppState();
    if (state.church) throw redirect({ to: state.viewer ? "/" : "/login" });
  },
  head: () => ({ meta: [{ title: "Set up — Steward Display" }] }),
  component: SetupPage,
});

const MIN_PASSWORD = 10;

function SetupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    setupCode: "",
    churchName: "",
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const field = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: event.target.value });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.password.length < MIN_PASSWORD) {
      setError(`Use a password of at least ${MIN_PASSWORD} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await setUpFn({ data: form });
      await navigate({ to: "/", replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const describedBy = error ? "setup-error" : undefined;
  return (
    <AuthCard
      title="Set up Display"
      subtitle="Name your church and create the owner's account. This page only appears once."
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="setupCode">Setup code</Label>
          <Input
            id="setupCode"
            required
            autoComplete="off"
            spellCheck={false}
            className="font-mono tracking-widest"
            value={form.setupCode}
            onChange={field("setupCode")}
            aria-describedby="setup-code-hint"
          />
          <p id="setup-code-hint" className="text-xs text-muted-foreground">
            In the server's log, on the line starting <span className="font-mono">[setup]</span>{" "}
            (for Docker: <span className="font-mono">docker compose logs app</span>). It proves you
            run this server.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="churchName">Church name</Label>
          <Input
            id="churchName"
            required
            maxLength={120}
            autoComplete="organization"
            value={form.churchName}
            onChange={field("churchName")}
            aria-describedby={describedBy}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            required
            maxLength={120}
            autoComplete="name"
            value={form.name}
            onChange={field("name")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Your email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={form.email}
            onChange={field("email")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            value={form.password}
            onChange={field("password")}
            aria-describedby="password-hint"
          />
          <p id="password-hint" className="text-xs text-muted-foreground">
            At least {MIN_PASSWORD} characters. A short sentence works well.
          </p>
        </div>
        <FormError id="setup-error" message={error} />
        <Button
          type="submit"
          className="w-full"
          disabled={
            busy ||
            !form.setupCode ||
            !form.churchName ||
            !form.name ||
            !form.email ||
            !form.password
          }
        >
          {busy ? "Setting up…" : "Create church and sign in"}
        </Button>
      </form>
    </AuthCard>
  );
}
