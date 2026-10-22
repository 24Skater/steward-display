import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Check, Loader2, MonitorOff, TriangleAlert } from "lucide-react";

import {
  CONTENT_WIDGETS,
  WidgetContentForm,
  contentSummary,
} from "@/components/editor/WidgetContentForm";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { getWidgetDefinition } from "@/lib/widgetRegistry";
import { useScreenStore, type SaveStatus } from "@/store/screenStore";
import type { WidgetInstance } from "@/types";

/**
 * Quick edit: change what a screen says, from a phone.
 *
 * Owners decided phones edit content and tablets and computers the layout.
 * This page shows only the words on each widget (WidgetContentForm), never
 * sliders or colours, saving as people type.
 */
export const Route = createFileRoute("/_admin/screens/$id/quick")({
  head: () => ({ meta: [{ title: "Quick edit — Steward Display" }] }),
  component: QuickEditPage,
});

/** Top to bottom, then left to right: the order people read the screen in. */
function readingOrder(a: WidgetInstance, b: WidgetInstance): number {
  return a.y - b.y || a.x - b.x;
}

function SaveIndicator({ status }: { status: SaveStatus | undefined }) {
  const [icon, text, tone] =
    status === "error"
      ? [<TriangleAlert key="i" className="h-4 w-4" />, "Not saved", "text-destructive"]
      : status === "pending" || status === "saving"
        ? [<Loader2 key="i" className="h-4 w-4 animate-spin" />, "Saving…", "text-muted-foreground"]
        : status === "conflict"
          ? [<TriangleAlert key="i" className="h-4 w-4" />, "Changed elsewhere", "text-destructive"]
          : [<Check key="i" className="h-4 w-4 text-emerald" />, "Saved", "text-muted-foreground"];
  return (
    <span role="status" aria-live="polite" className={`flex items-center gap-1 text-sm ${tone}`}>
      {icon} {text}
    </span>
  );
}

function QuickEditPage() {
  const { id } = Route.useParams();
  const screen = useScreenStore((s) => s.screens.find((x) => x.id === id));
  const hydrated = useScreenStore((s) => s.hydrated);
  const loadError = useScreenStore((s) => s.loadError);
  const retry = useScreenStore((s) => s.hydrate);
  const status = useScreenStore((s) => s.saveStatus[id]);
  const updateWidget = useScreenStore((s) => s.updateWidget);

  if (!hydrated) {
    return loadError ? (
      <main className="mx-auto max-w-xl px-4 py-10">
        <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
          Couldn't load your screens: {loadError}
        </p>
        <Button className="mt-4 h-11" onClick={() => void retry()}>
          Try again
        </Button>
      </main>
    ) : (
      <div className="p-6 text-muted-foreground">Loading…</div>
    );
  }
  if (!screen) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <EmptyState
          icon={MonitorOff}
          title="Screen not found"
          body="It may have been deleted. Your church's screens are on the Screens page."
          action={
            <Button asChild>
              <Link to="/">Back to screens</Link>
            </Button>
          }
        />
      </main>
    );
  }

  const widgets = screen.widgets
    .filter((w) => CONTENT_WIDGETS.has(w.widgetType))
    .sort(readingOrder);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0">
          <Link to="/" aria-label="Back to screens">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{screen.name}</h1>
        <SaveIndicator status={status} />
      </div>

      {status === "conflict" && (
        <p role="alert" className="mb-4 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">
          Someone else changed this screen while you were editing, so your last changes were not
          saved. What you see now is their version; make your change again.
        </p>
      )}

      <p className="mb-6 text-sm text-muted-foreground">
        Change what this screen says. TVs showing it update within a minute. Colours, sizes and
        layout are changed on a tablet or computer.
      </p>

      {widgets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          This screen has no words to edit yet. Add widgets from a tablet or computer.
        </p>
      ) : (
        <ol className="space-y-4">
          {widgets.map((widget) => {
            const label = getWidgetDefinition(widget.widgetType)?.label ?? widget.widgetType;
            const summary = contentSummary(widget);
            return (
              <li
                key={widget.id}
                className="rounded-xl border border-border bg-card p-4 shadow-steward-sm"
              >
                <h2 className="mb-4 font-semibold text-foreground">
                  {label}
                  {summary && (
                    <span className="font-normal text-muted-foreground">: {summary}</span>
                  )}
                </h2>
                <WidgetContentForm
                  widget={widget}
                  onChange={(patch) =>
                    updateWidget(screen.id, widget.id, { config: { ...widget.config, ...patch } })
                  }
                />
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-8 text-center text-sm">
        <Link
          to="/screens/$id/edit"
          params={{ id: screen.id }}
          className="text-blue underline-offset-4 hover:underline"
        >
          Open the full editor
        </Link>
      </p>
    </main>
  );
}
