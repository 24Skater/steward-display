import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}

/** The frame for the signed-out pages: navy ground, the mark, one card. */
export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3 text-white">
          <img src="/brand/steward-mark.svg" alt="" className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-tight">
            Steward <span className="opacity-60">·</span> Display
          </span>
        </div>
        <section className="rounded-xl bg-card p-6 shadow-steward-lg sm:p-8">
          <h1 className="text-h2 font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}

interface FieldErrorProps {
  id: string;
  message: string | null;
}

/** An inline error under a form, announced to screen readers when it appears. */
export function FormError({ id, message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}
