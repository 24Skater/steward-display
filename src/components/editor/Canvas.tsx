import { useEffect, useMemo, useRef, useState } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { Screen, WidgetInstance, WidgetType } from "@/types";
import { getScreenDimensions } from "@/types";
import { WidgetRenderer } from "./WidgetRenderer";
import { useEditorStore } from "@/store/editorStore";
import { useScreenStore } from "@/store/screenStore";

const GRID_COLS = 24;
const GRID_ROWS = 16;

function WidgetTile({
  widget,
  cellW,
  cellH,
  selected,
  onSelect,
}: {
  widget: WidgetInstance;
  cellW: number;
  cellH: number;
  selected: boolean;
  onSelect: (id: string, additive: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: widget.id,
    data: { source: "canvas", widgetId: widget.id },
  });

  const style: React.CSSProperties = {
    position: "absolute",
    left: widget.x * cellW,
    top: widget.y * cellH,
    width: widget.w * cellW,
    height: widget.h * cellH,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: selected ? 10 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect(widget.id, e.shiftKey);
      }}
      className={`cursor-move outline-none ${selected ? "ring-2 ring-blue ring-offset-2" : "ring-1 ring-white/15 hover:ring-blue/60"}`}
      {...listeners}
      {...attributes}
    >
      <WidgetRenderer widget={widget} />
    </div>
  );
}

function CanvasStage({
  screen,
  cellW,
  cellH,
  stageW,
  stageH,
}: {
  screen: Screen;
  cellW: number;
  cellH: number;
  stageW: number;
  stageH: number;
}) {
  const { setNodeRef } = useDroppable({ id: "canvas-stage" });
  const showGrid = useEditorStore((s) => s.showGrid);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const toggleSelect = useEditorStore((s) => s.toggleSelect);
  const select = useEditorStore((s) => s.select);

  return (
    <div
      ref={setNodeRef}
      onPointerDown={() => select([])}
      className="relative shrink-0 overflow-hidden shadow-steward-lg"
      style={{
        width: stageW,
        height: stageH,
        backgroundColor: screen.backgroundColor,
        backgroundImage: screen.backgroundImage ? `url(${screen.backgroundImage})` : undefined,
        backgroundSize: "cover",
      }}
    >
      {showGrid && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)`,
            backgroundSize: `${cellW}px ${cellH}px`,
          }}
        />
      )}
      <div className="absolute inset-0 text-white">
        {screen.widgets.map((w) => (
          <WidgetTile
            key={w.id}
            widget={w}
            cellW={cellW}
            cellH={cellH}
            selected={selectedIds.includes(w.id)}
            onSelect={(id, additive) => toggleSelect(id, additive)}
          />
        ))}
      </div>
    </div>
  );
}

export function Canvas({ screen, onAddAt }: { screen: Screen; onAddAt: (type: WidgetType, x: number, y: number) => void }) {
  const dims = getScreenDimensions(screen);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [autoZoom, setAutoZoom] = useState(0.5);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const updateWidget = useScreenStore((s) => s.updateWidget);
  const removeWidget = useScreenStore((s) => s.removeWidget);

  // Fit to container on mount / resize
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const fit = () => {
      const padding = 64;
      const w = (el.clientWidth - padding) / dims.w;
      const h = (el.clientHeight - padding) / dims.h;
      const z = Math.max(0.1, Math.min(1, Math.min(w, h)));
      setAutoZoom(z);
      setZoom(z);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims.w, dims.h]);

  const effective = zoom || autoZoom;
  const stageW = dims.w * effective;
  const stageH = dims.h * effective;
  const cellW = dims.w / GRID_COLS;
  const cellH = dims.h / GRID_ROWS;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, [contenteditable]")) return;
      if (selectedIds.length === 0) return;
      const step = e.shiftKey ? 4 : 1;
      if (e.key === "Delete" || e.key === "Backspace") {
        selectedIds.forEach((id) => removeWidget(screen.id, id));
        select([]);
        e.preventDefault();
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        selectedIds.forEach((id) => {
          const w = screen.widgets.find((x) => x.id === id);
          if (!w) return;
          let { x, y } = w;
          if (e.key === "ArrowLeft") x = Math.max(0, x - step);
          if (e.key === "ArrowRight") x = Math.min(GRID_COLS - w.w, x + step);
          if (e.key === "ArrowUp") y = Math.max(0, y - step);
          if (e.key === "ArrowDown") y = Math.min(GRID_ROWS - w.h, y + step);
          updateWidget(screen.id, id, { x, y });
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, screen.id, screen.widgets, removeWidget, updateWidget, select]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (e: DragEndEvent) => {
    const data = e.active.data.current as { source: string; widgetId?: string; widgetType?: WidgetType } | undefined;
    if (!data) return;

    if (data.source === "palette" && data.widgetType) {
      // compute drop position from stage center
      const stage = stageRef.current;
      if (!stage) return onAddAt(data.widgetType, 6, 4);
      const rect = stage.getBoundingClientRect();
      const e2 = (e.activatorEvent as PointerEvent | undefined);
      const dx = (e.delta?.x ?? 0);
      const dy = (e.delta?.y ?? 0);
      const px = ((e2?.clientX ?? rect.left + rect.width / 2) + dx - rect.left) / effective;
      const py = ((e2?.clientY ?? rect.top + rect.height / 2) + dy - rect.top) / effective;
      const gx = Math.max(0, Math.round(px / cellW));
      const gy = Math.max(0, Math.round(py / cellH));
      onAddAt(data.widgetType, Math.min(GRID_COLS - 2, gx), Math.min(GRID_ROWS - 2, gy));
    } else if (data.source === "canvas" && data.widgetId) {
      const w = screen.widgets.find((x) => x.id === data.widgetId);
      if (!w) return;
      const dx = Math.round(e.delta.x / effective / cellW);
      const dy = Math.round(e.delta.y / effective / cellH);
      const nx = Math.max(0, Math.min(GRID_COLS - w.w, w.x + dx));
      const ny = Math.max(0, Math.min(GRID_ROWS - w.h, w.y + dy));
      updateWidget(screen.id, data.widgetId, { x: nx, y: ny });
    }
  };

  const zoomOptions = useMemo(() => [0.25, 0.5, 0.75, 1], []);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {/* Palette droppable area is implicit — we drop on stage; palette drag computes via delta from pointer */}
      <div ref={containerRef} className="relative flex flex-1 flex-col items-center justify-center overflow-auto bg-subtle p-8">
        <div ref={stageRef} style={{ transformOrigin: "top left" }}>
          <CanvasStage screen={screen} cellW={cellW} cellH={cellH} stageW={stageW} stageH={stageH} />
        </div>

        <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-steward-md">
          <span className="font-medium text-muted-foreground">{dims.w}×{dims.h}</span>
          <span className="text-border">|</span>
          {zoomOptions.map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`rounded-full px-2 py-0.5 ${Math.abs(zoom - z) < 0.01 ? "bg-blue text-white" : "text-muted-foreground hover:bg-muted"}`}
            >
              {Math.round(z * 100)}%
            </button>
          ))}
        </div>
      </div>
    </DndContext>
  );
}