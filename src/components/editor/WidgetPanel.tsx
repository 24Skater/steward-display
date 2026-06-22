import { useState } from "react";
import { Search } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { Input } from "@/components/ui/input";
import { WIDGET_CATEGORIES, WIDGET_DEFINITIONS, type WidgetDefinition } from "@/lib/widgetRegistry";
import type { WidgetType } from "@/types";

function PaletteItem({ def, onAdd }: { def: WidgetDefinition; onAdd: (t: WidgetType) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${def.type}`,
    data: { source: "palette", widgetType: def.type },
  });
  const Icon = def.icon;
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onDoubleClick={() => onAdd(def.type)}
      className={`group flex w-full items-center gap-3 rounded-md border border-border bg-card p-2 text-left transition-colors hover:border-blue hover:bg-accent ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground group-hover:bg-blue group-hover:text-white">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{def.label}</span>
        <span className="block truncate text-xs text-muted-foreground">{def.description}</span>
      </span>
    </button>
  );
}

export function WidgetPanel({ onAdd }: { onAdd: (t: WidgetType) => void }) {
  const [q, setQ] = useState("");
  const filtered = WIDGET_DEFINITIONS.filter(
    (d) => !q || d.label.toLowerCase().includes(q.toLowerCase()) || d.description.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search widgets"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {WIDGET_CATEGORIES.map((cat) => {
          const items = filtered.filter((d) => d.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-5">
              <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {cat}
              </p>
              <div className="flex flex-col gap-1.5">
                {items.map((def) => (
                  <PaletteItem key={def.type} def={def} onAdd={onAdd} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}