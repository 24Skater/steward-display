import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Eye, Keyboard } from "lucide-react";
import { useEffect, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Canvas, GRID_COLS, GRID_ROWS } from "@/components/editor/Canvas";
import { WidgetPanel } from "@/components/editor/WidgetPanel";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { LayoutTemplatePicker } from "@/components/editor/LayoutTemplates";
import { instantiateTemplate, type LayoutTemplate } from "@/lib/layoutTemplates";
import { useScreenStore } from "@/store/screenStore";
import { useEditorStore } from "@/store/editorStore";
import { getScreenDimensions, type WidgetType } from "@/types";
import { getWidgetDefinition } from "@/lib/widgetRegistry";
import { EmptyState } from "@/components/layout/EmptyState";
import { MonitorOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/_admin/screens/$id/edit")({
  head: () => ({ meta: [{ title: "Editor — Steward Display" }] }),
  component: EditorPage,
});

function EditorPage() {
  const { id } = Route.useParams();
  const screen = useScreenStore((s) => s.screens.find((x) => x.id === id));
  const hydrated = useScreenStore((s) => s.hydrated);
  const updateScreen = useScreenStore((s) => s.updateScreen);
  const addWidget = useScreenStore((s) => s.addWidget);
  const updateWidget = useScreenStore((s) => s.updateWidget);
  const setWidgets = useScreenStore((s) => s.setWidgets);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const zoom = useEditorStore((s) => s.zoom);
  const reset = useEditorStore((s) => s.reset);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [activeDrag, setActiveDrag] = useState<{ source: string; widgetType?: WidgetType } | null>(null);
  const [skipTemplates, setSkipTemplates] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shortcutQuery, setShortcutQuery] = useState("");
  const [shortcutTab, setShortcutTab] = useState("all");

  useEffect(() => () => reset(), [reset]);

  useEffect(() => {
    if (!shortcutsOpen) {
      setShortcutQuery("");
      setShortcutTab("all");
    }
  }, [shortcutsOpen]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  if (!hydrated) {
    return <div className="p-10 text-muted-foreground">Loading…</div>;
  }

  if (!screen) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <EmptyState
          icon={MonitorOff}
          title="Screen not found"
          body="It may have been deleted or never existed on this device."
          action={<Button asChild><Link to="/">Back to screens</Link></Button>}
        />
      </main>
    );
  }

  const dims = getScreenDimensions(screen);
  const cellW = dims.w / GRID_COLS;
  const cellH = dims.h / GRID_ROWS;
  const effective = zoom || 0.5;
  const selected = screen.widgets.find((w) => selectedIds.includes(w.id));

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as any;
    if (data?.source === "palette") setActiveDrag({ source: "palette", widgetType: data.widgetType });
    else setActiveDrag({ source: data?.source ?? "canvas" });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const data = e.active.data.current as { source: string; widgetId?: string; widgetType?: WidgetType } | undefined;
    if (!data) return;

    if (data.source === "palette" && data.widgetType) {
      const stageEl = document.querySelector<HTMLElement>("[data-stage-root]");
      const e2 = e.activatorEvent as PointerEvent | undefined;
      let gx = 6;
      let gy = 4;
      if (stageEl && e2) {
        const rect = stageEl.getBoundingClientRect();
        const px = (e2.clientX + (e.delta?.x ?? 0) - rect.left) / effective;
        const py = (e2.clientY + (e.delta?.y ?? 0) - rect.top) / effective;
        if (px >= 0 && py >= 0 && px <= dims.w && py <= dims.h) {
          gx = Math.max(0, Math.min(GRID_COLS - 2, Math.round(px / cellW)));
          gy = Math.max(0, Math.min(GRID_ROWS - 2, Math.round(py / cellH)));
        }
      }
      const w = addWidget(screen.id, data.widgetType, { x: gx, y: gy });
      if (w) select([w.id]);
    } else if (data.source === "canvas" && data.widgetId) {
      const w = screen.widgets.find((x) => x.id === data.widgetId);
      if (!w) return;
      const dx = Math.round(e.delta.x / effective / cellW);
      const dy = Math.round(e.delta.y / effective / cellH);
      const nx = Math.max(0, Math.min(GRID_COLS - w.w, w.x + dx));
      const ny = Math.max(0, Math.min(GRID_ROWS - w.h, w.y + dy));
      if (nx !== w.x || ny !== w.y) {
        pushHistory(screen.widgets);
        updateWidget(screen.id, data.widgetId, { x: nx, y: ny });
      }
    }
  };

  const handleAdd = (type: WidgetType) => {
    const w = addWidget(screen.id, type, { x: 6, y: 4 });
    if (w) select([w.id]);
  };

  const handleTemplate = (template: LayoutTemplate) => {
    pushHistory(screen.widgets);
    setWidgets(screen.id, instantiateTemplate(template));
    setSkipTemplates(true);
  };

  const showTemplates = !skipTemplates && screen.widgets.length === 0;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
          {editingName ? (
            <Input
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={() => {
                if (draftName.trim()) updateScreen(screen.id, { name: draftName.trim() });
                setEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="h-8 w-64"
            />
          ) : (
            <button
              className="rounded-md px-2 py-1 text-sm font-semibold hover:bg-muted"
              onClick={() => {
                setDraftName(screen.name);
                setEditingName(true);
              }}
            >
              {screen.name}
            </button>
          )}
          <span className="text-xs text-muted-foreground">Auto-saved</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShortcutsOpen(true)}>
            <Keyboard className="h-4 w-4" /> Shortcuts
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open(`/screens/${screen.id}/preview`, "_blank")}>
            <Eye className="h-4 w-4" /> Preview
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 overflow-hidden">
          <WidgetPanel onAdd={handleAdd} />
          <div className="flex flex-1 flex-col overflow-hidden">
            {showTemplates ? (
              <div className="flex-1 overflow-y-auto bg-subtle">
                <LayoutTemplatePicker onChoose={handleTemplate} onBlank={() => setSkipTemplates(true)} />
              </div>
            ) : (
              <Canvas screen={screen} />
            )}
          </div>
          {selected && (
            <PropertiesPanel screen={screen} widget={selected} onClose={() => select([])} />
          )}
        </div>

        <DragOverlay>
          {activeDrag?.source === "palette" && activeDrag.widgetType && (
            <div className="rounded-md border border-blue bg-card px-3 py-2 text-sm font-medium shadow-steward-md">
              {getWidgetDefinition(activeDrag.widgetType)?.label}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search shortcuts…"
            value={shortcutQuery}
            onChange={(e) => setShortcutQuery(e.target.value)}
            className="mb-2"
          />
          <Tabs value={shortcutTab} onValueChange={setShortcutTab}>
            <TabsList className="mb-3 grid w-full grid-cols-6">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="canvas">Canvas</TabsTrigger>
              <TabsTrigger value="widgets">Widgets</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="presets">Presets</TabsTrigger>
            </TabsList>
            <div className="grid gap-3 py-2">
              {SHORTCUTS.filter((s) => {
                const matchesTab = shortcutTab === "all" || s.category === shortcutTab;
                const q = shortcutQuery.toLowerCase();
                const matchesQuery = s.action.toLowerCase().includes(q) || s.keys.toLowerCase().includes(q);
                return matchesTab && matchesQuery;
              }).map((s) => (
                <ShortcutRow key={s.keys} keys={s.keys} action={s.action} />
              ))}
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SHORTCUTS = [
  { keys: "↑ ↓ ← →", action: "Nudge 1 cell", category: "edit" },
  { keys: "⇧ + arrows", action: "Nudge 4 cells", category: "edit" },
  { keys: "Esc", action: "Deselect widgets", category: "edit" },
  { keys: "⌘/Ctrl + Z", action: "Undo", category: "edit" },
  { keys: "⌘/Ctrl + Y", action: "Redo", category: "edit" },
  { keys: "⇧ + ⌘/Ctrl + Z", action: "Redo", category: "edit" },
  { keys: "Click", action: "Select widget", category: "canvas" },
  { keys: "⇧ + Click", action: "Add to selection", category: "canvas" },
  { keys: "Drag", action: "Move widget", category: "canvas" },
  { keys: "Drag handle", action: "Resize widget", category: "canvas" },
  { keys: "Scroll", action: "Pan canvas", category: "canvas" },
  { keys: "⌘/Ctrl + D", action: "Duplicate selected widgets", category: "widgets" },
  { keys: "Delete / Backspace", action: "Remove selected widgets", category: "widgets" },
  { keys: "?", action: "Open this help", category: "presets" },
] as const;

function ShortcutRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground">{action}</span>
      <kbd className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-mono text-foreground">{keys}</kbd>
    </div>
  );
}