import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { WIDGET_CATEGORIES, WIDGET_DEFINITIONS } from "@/lib/widgetRegistry";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_admin/widgets")({
  head: () => ({ meta: [{ title: "Widget library — Steward Display" }] }),
  component: WidgetLibraryPage,
});

function WidgetLibraryPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <PageHeader title="Widget library" subtitle="Everything you can drop onto a screen." />
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          {WIDGET_CATEGORIES.map((c) => (
            <TabsTrigger key={c} value={c}>{c}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="all" className="mt-6">
          <Grid items={WIDGET_DEFINITIONS} />
        </TabsContent>
        {WIDGET_CATEGORIES.map((c) => (
          <TabsContent key={c} value={c} className="mt-6">
            <Grid items={WIDGET_DEFINITIONS.filter((d) => d.category === c)} />
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}

function Grid({ items }: { items: typeof WIDGET_DEFINITIONS }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((d) => {
        const Icon = d.icon;
        return (
          <div key={d.type} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-steward-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-blue">
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{d.label}</p>
                <Badge variant="secondary" className="mt-0.5 font-normal">{d.category}</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{d.description}</p>
            <p className="mt-auto text-xs text-muted-foreground">
              Open a screen editor to drop this widget on a canvas.
            </p>
          </div>
        );
      })}
    </div>
  );
}