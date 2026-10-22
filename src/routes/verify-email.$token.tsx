import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { AuthCard } from "@/components/auth/AuthCard";
import { verifyEmailFn } from "@/lib/api/auth.functions";
import { errorMessage } from "@/lib/errors";

export const Route = createFileRoute("/verify-email/$token")({
  head: () => ({ meta: [{ title: "Confirm email — Steward Display" }] }),
  component: VerifyEmailPage,
});

/**
 * Confirms on a deliberate page load, from the browser, rather than in a loader:
 * mail scanners that prefetch links run no JavaScript, so they cannot use the
 * link up before the person clicks it.
 */
function VerifyEmailPage() {
  const { token } = Route.useParams();
  const [state, setState] = useState<"working" | "done" | { error: string }>("working");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    verifyEmailFn({ data: { token } })
      .then(() => setState("done"))
      .catch((error: unknown) => setState({ error: errorMessage(error) }));
  }, [token]);

  const home = (
    <p className="mt-6 text-center text-sm">
      <Link to="/" className="text-blue underline-offset-4 hover:underline">
        Go to Steward Display
      </Link>
    </p>
  );

  if (state === "working") {
    return (
      <AuthCard title="Confirming your email…">
        <p className="text-sm text-muted-foreground">One moment.</p>
      </AuthCard>
    );
  }
  if (state === "done") {
    return (
      <AuthCard title="Email confirmed">
        <p className="text-sm text-muted-foreground">
          Thanks. If you ever forget your password, you can now reset it by email.
        </p>
        {home}
      </AuthCard>
    );
  }
  return (
    <AuthCard title="That link didn't work">
      <p className="text-sm text-muted-foreground">
        {state.error} You can send a new one from your account page.
      </p>
      {home}
    </AuthCard>
  );
}
