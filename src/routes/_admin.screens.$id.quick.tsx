import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Check, Loader2, MonitorOff, TriangleAlert } from "lucide-react";

import { WidgetConfigForm } from "@/components/editor/WidgetConfigForms";
import { EmptyState } from "@/components/layout/EmptyState";
import { Button } from "@/components/ui/button";
import { getWidgetDefinition } from "@/lib/widgetRegistry";
import { useScreenStore, type SaveStatus } from "@/store/screenStore";
import type { WidgetInstance } from "@/types";

/**
 * Quick edit: change what a screen says, from a phone.
 *
 * Layout needs room and a pointer, so it stays on tablets and computers. On a
 * phone a volunteer changes the words: this Sunday's announcement, the
 * countdown's time, the giving total. Same forms as the full editor, one under
 * another, saving as they type.
 */
export const Route = createFileRoute("/_admin/screens/$id/quick")({
  head: () => ({ meta: [{ title: "Quick edit — Steward Display" }] }),
  component: QuickEditPage,
});

/** Widgets with nothing to say: nothing to edit from a phone. */
const LAYOUT_ONLY = new Set(["divider"]);

/** Top to bottom, then left to right: the order people read the screen in. */
function readingOrder(a: WidgetInstance, b: WidgetInstance): number {
  return a.y - b.y || a.x - b.x;
}

function SaveIndicator({ status }: { status: SaveStatus | undefined }) {
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 text-sm text-destructive">
        <TriangleAlert className="h-4 w-4" /> Not saved
      </span>
    );
  }
  if (status === "pending" || status === "saving") {
    return (
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Saving…
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-sm text-muted-foreground">
      <Check className="h-4 w-4 text-emerald" /> Saved
    </span>
  );
}

function QuickEditPage() {
  const { id } = Route.useParams();
  const screen = useScreenStore((s) => s.screens.find((x) => x.id === id));
  const hydrated = useScreenStore((s) => s.hydrated);
  const status = useScreenStore((s) => s.saveStatus[id]);
  const updateWidget = useScreenStore((s) => s.updateWidget);

  if (!hydrated) return <div className="p-6 text-muted-foreground">Loading…</div>;
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

  const widgets = screen.widgets.filter((w) => !LAYOUT_ONLY.has(w.widgetType)).sort(readingOrder);

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-4">
      <div className="sticky top-14 z-10 -mx-4 mb-4 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0">
          <Link to="/" aria-label="Back to screens">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{screen.name}</h1>
        <SaveIndicator status={status} />
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        Change what this screen says. TVs showing it update within a minute. To move or resize
        things, use a tablet or computer.
      </p>

      {widgets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          This screen has nothing to edit from a phone yet. Add widgets from a tablet or computer.
        </p>
      ) : (
        <ol className="space-y-4">
          {widgets.map((widget) => (
            <li
              key={widget.id}
              className="rounded-xl border border-border bg-card p-4 shadow-steward-sm"
            >
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {getWidgetDefinition(widget.widgetType)?.label ?? widget.widgetType}
              </h2>
              <WidgetConfigForm
                widget={widget}
                onChange={(patch) =>
                  updateWidget(screen.id, widget.id, { config: { ...widget.config, ...patch } })
                }
              />
            </li>
          ))}
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
