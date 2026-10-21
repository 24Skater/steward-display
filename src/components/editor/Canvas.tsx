import { useEffect, useMemo, useRef, useState } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import {
  Maximize2,
  Minimize2,
  Undo2,
  Redo2,
  Grid3x3,
  Magnet,
  AlignCenterVertical,
  Ruler,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Screen, WidgetInstance } from "@/types";
import { getScreenDimensions } from "@/types";
import { GRID_COLS, GRID_ROWS } from "@/lib/gridConstants";
import { WidgetRenderer } from "./WidgetRenderer";
import { useEditorStore } from "@/store/editorStore";
import { useScreenStore } from "@/store/screenStore";
import { useSettingsStore } from "@/store/settingsStore";
import { INTERACTIVE_GUARD_SELECTOR } from "@/lib/keyboardGuard";

export { GRID_COLS, GRID_ROWS } from "@/lib/gridConstants";

type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function WidgetTile({
  widget,
  cellW,
  cellH,
  effective,
  selected,
  screenId,
  onSelect,
}: {
  widget: WidgetInstance;
  cellW: number;
  cellH: number;
  effective: number;
  selected: boolean;
  screenId: string;
  onSelect: (id: string, additive: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: widget.id,
    data: { source: "canvas", widgetId: widget.id },
  });
  const updateWidget = useScreenStore((s) => s.updateWidget);
  const [resizing, setResizing] = useState<ResizeDir | null>(null);

  const style: React.CSSProperties = {
    position: "absolute",
    left: widget.x * cellW,
    top: widget.y * cellH,
    width: widget.w * cellW,
    height: widget.h * cellH,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 20 : selected ? 10 : 1,
    opacity: isDragging ? 0.92 : 1,
    transition: isDragging ? "none" : "box-shadow 120ms ease, opacity 120ms ease",
    willChange: isDragging ? "transform" : undefined,
    cursor: isDragging ? "grabbing" : undefined,
  };

  const startResize = (dir: ResizeDir) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing(dir);
    const startX = e.clientX;
    const startY = e.clientY;
    const start = { x: widget.x, y: widget.y, w: widget.w, h: widget.h };
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / effective / cellW;
      const dy = (ev.clientY - startY) / effective / cellH;
      let { x, y, w, h } = start;
      if (dir.includes("e")) w = clamp(Math.round(start.w + dx), 1, GRID_COLS - start.x);
      if (dir.includes("s")) h = clamp(Math.round(start.h + dy), 1, GRID_ROWS - start.y);
      if (dir.includes("w")) {
        const nx = clamp(Math.round(start.x + dx), 0, start.x + start.w - 1);
        w = start.w + (start.x - nx);
        x = nx;
      }
      if (dir.includes("n")) {
        const ny = clamp(Math.round(start.y + dy), 0, start.y + start.h - 1);
        h = start.h + (start.y - ny);
        y = ny;
      }
      updateWidget(screenId, widget.id, { x, y, w, h });
    };
    const onUp = () => {
      setResizing(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleCursors: Record<ResizeDir, string> = {
    n: "cursor-ns-resize",
    s: "cursor-ns-resize",
    e: "cursor-ew-resize",
    w: "cursor-ew-resize",
    ne: "cursor-nesw-resize",
    sw: "cursor-nesw-resize",
    nw: "cursor-nwse-resize",
    se: "cursor-nwse-resize",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onPointerDown={(e) => {
        if (resizing) return;
        e.stopPropagation();
        onSelect(widget.id, e.shiftKey);
      }}
      className={
        "outline-none " +
        (isDragging
          ? "ring-2 ring-blue shadow-steward-lg"
          : selected
            ? "ring-2 ring-blue ring-offset-2 ring-offset-transparent shadow-steward-md"
            : "ring-1 ring-white/15 hover:ring-blue/60")
      }
    >
      <div
        className={"h-full w-full " + (isDragging ? "cursor-grabbing" : "cursor-grab")}
        {...listeners}
        {...attributes}
      >
        <div
          className={isDragging ? "pointer-events-none select-none h-full w-full" : "h-full w-full"}
        >
          <WidgetRenderer widget={widget} />
        </div>
      </div>
      {selected && (
        <>
          {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as ResizeDir[]).map((dir) => {
            const pos: Record<ResizeDir, React.CSSProperties> = {
              nw: { left: -5, top: -5 },
              n: { left: "50%", top: -5, transform: "translateX(-50%)" },
              ne: { right: -5, top: -5 },
              e: { right: -5, top: "50%", transform: "translateY(-50%)" },
              se: { right: -5, bottom: -5 },
              s: { left: "50%", bottom: -5, transform: "translateX(-50%)" },
              sw: { left: -5, bottom: -5 },
              w: { left: -5, top: "50%", transform: "translateY(-50%)" },
            };
            return (
              <span
                key={dir}
                onPointerDown={startResize(dir)}
                className={
                  "absolute z-20 h-2.5 w-2.5 rounded-sm border border-blue bg-card " +
                  handleCursors[dir]
                }
                style={pos[dir]}
                aria-label={`Resize ${dir}`}
              />
            );
          })}
        </>
      )}
    </div>
  );
}

function CanvasStage({
  screen,
  cellW,
  cellH,
  effective,
  gridSize,
}: {
  screen: Screen;
  cellW: number;
  cellH: number;
  effective: number;
  gridSize: number;
}) {
  const { setNodeRef } = useDroppable({ id: "canvas-stage" });
  const showGrid = useEditorStore((s) => s.showGrid);
  const showAlignment = useEditorStore((s) => s.showAlignment);
  const showRulers = useEditorStore((s) => s.showRulers);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const toggleSelect = useEditorStore((s) => s.toggleSelect);
  const select = useEditorStore((s) => s.select);
  const dragPreview = useEditorStore((s) => s.dragPreview);
  const dims = getScreenDimensions(screen);

  // Compute snap-alignment guides: when the dragged widget's edges/centers match
  // another widget's edges/centers (or the canvas edges/center) within the snap grid,
  // surface a guide line.
  const guides = (() => {
    if (!dragPreview) return { v: [] as number[], h: [] as number[] };
    const a = dragPreview;
    const aEdgesX = [a.x, a.x + a.w / 2, a.x + a.w];
    const aEdgesY = [a.y, a.y + a.h / 2, a.y + a.h];
    const targetsX = new Set<number>([0, GRID_COLS / 2, GRID_COLS]);
    const targetsY = new Set<number>([0, GRID_ROWS / 2, GRID_ROWS]);
    for (const w of screen.widgets) {
      if (w.id === a.id) continue;
      targetsX.add(w.x);
      targetsX.add(w.x + w.w / 2);
      targetsX.add(w.x + w.w);
      targetsY.add(w.y);
      targetsY.add(w.y + w.h / 2);
      targetsY.add(w.y + w.h);
    }
    const v: number[] = [];
    const h: number[] = [];
    aEdgesX.forEach((e) =>
      targetsX.forEach((t) => {
        if (Math.abs(e - t) < 0.001) v.push(t);
      }),
    );
    aEdgesY.forEach((e) =>
      targetsY.forEach((t) => {
        if (Math.abs(e - t) < 0.001) h.push(t);
      }),
    );
    return { v: Array.from(new Set(v)), h: Array.from(new Set(h)) };
  })();

  return (
    <div
      ref={setNodeRef}
      data-stage-root
      onPointerDown={() => select([])}
      className="relative shrink-0 overflow-hidden shadow-steward-lg"
      style={{
        width: dims.w,
        height: dims.h,
        backgroundColor: screen.backgroundColor,
        backgroundImage: screen.backgroundImage ? `url(${screen.backgroundImage})` : undefined,
        backgroundSize: "cover",
      }}
    >
      {showGrid && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)`,
            backgroundSize: `${gridSize * cellW}px ${gridSize * cellH}px`,
          }}
        />
      )}
      {showAlignment && (
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-blue/60" />
          <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-blue/60" />
          <div className="absolute left-1/3 top-0 h-full w-px bg-blue/25" />
          <div className="absolute left-2/3 top-0 h-full w-px bg-blue/25" />
          <div className="absolute left-0 top-1/3 h-px w-full bg-blue/25" />
          <div className="absolute left-0 top-2/3 h-px w-full bg-blue/25" />
        </div>
      )}
      {/* Rulers along the top and left edge of the stage */}
      {showRulers && (
        <>
          <div
            className="pointer-events-none absolute left-0 top-0 flex w-full items-end overflow-hidden border-b border-white/15 bg-black/40 text-[10px] font-mono text-white/70"
            style={{ height: 16 / effective }}
          >
            {Array.from({ length: Math.floor(GRID_COLS / gridSize) + 1 }).map((_, i) => {
              const col = i * gridSize;
              return (
                <div
                  key={`rx-${i}`}
                  className="absolute bottom-0 border-l border-white/25"
                  style={{ left: col * cellW, height: 6 / effective }}
                >
                  <span
                    className="absolute left-1 bottom-0 leading-none"
                    style={{
                      fontSize: 9 / effective,
                      transform: `translateY(${-2 / effective}px)`,
                    }}
                  >
                    {col}
                  </span>
                </div>
              );
            })}
          </div>
          <div
            className="pointer-events-none absolute left-0 top-0 flex h-full flex-col overflow-hidden border-r border-white/15 bg-black/40 text-[10px] font-mono text-white/70"
            style={{ width: 16 / effective }}
          >
            {Array.from({ length: Math.floor(GRID_ROWS / gridSize) + 1 }).map((_, i) => {
              const row = i * gridSize;
              return (
                <div
                  key={`ry-${i}`}
                  className="absolute right-0 border-t border-white/25"
                  style={{ top: row * cellH, width: 6 / effective }}
                >
                  <span
                    className="absolute right-1 top-0 leading-none"
                    style={{
                      fontSize: 9 / effective,
                      transform: `translateX(${-2 / effective}px)`,
                    }}
                  >
                    {row}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
      {/* Live snap-alignment guides while dragging */}
      {dragPreview && showRulers && (
        <div className="pointer-events-none absolute inset-0 z-30">
          {guides.v.map((c) => (
            <div
              key={`gv-${c}`}
              className="absolute top-0 h-full bg-[#FF3B82]"
              style={{ left: c * cellW, width: Math.max(1, 1 / effective) }}
            />
          ))}
          {guides.h.map((r) => (
            <div
              key={`gh-${r}`}
              className="absolute left-0 w-full bg-[#FF3B82]"
              style={{ top: r * cellH, height: Math.max(1, 1 / effective) }}
            />
          ))}
          <div
            className="absolute border border-blue/70 bg-blue/10"
            style={{
              left: dragPreview.x * cellW,
              top: dragPreview.y * cellH,
              width: dragPreview.w * cellW,
              height: dragPreview.h * cellH,
            }}
          />
        </div>
      )}
      <div className="absolute inset-0 text-white">
        {screen.widgets.map((w) => (
          <WidgetTile
            key={w.id}
            widget={w}
            cellW={cellW}
            cellH={cellH}
            effective={effective}
            selected={selectedIds.includes(w.id)}
            screenId={screen.id}
            onSelect={(id, additive) => toggleSelect(id, additive)}
          />
        ))}
      </div>
    </div>
  );
}

export function Canvas({ screen }: { screen: Screen }) {
  const dims = getScreenDimensions(screen);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [autoZoom, setAutoZoom] = useState(0.5);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const showGrid = useEditorStore((s) => s.showGrid);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const snapToGrid = useEditorStore((s) => s.snapToGrid);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const snapStep = useEditorStore((s) => s.snapStep);
  const setSnapStep = useEditorStore((s) => s.setSnapStep);
  const gridSize = useEditorStore((s) => s.gridSize);
  const setGridSize = useEditorStore((s) => s.setGridSize);
  const showAlignment = useEditorStore((s) => s.showAlignment);
  const toggleAlignment = useEditorStore((s) => s.toggleAlignment);
  const showRulers = useEditorStore((s) => s.showRulers);
  const toggleRulers = useEditorStore((s) => s.toggleRulers);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const select = useEditorStore((s) => s.select);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const updateWidget = useScreenStore((s) => s.updateWidget);
  const removeWidget = useScreenStore((s) => s.removeWidget);
  const duplicateWidget = useScreenStore((s) => s.duplicateWidget);
  const setWidgets = useScreenStore((s) => s.setWidgets);
  const updateScreen = useScreenStore((s) => s.updateScreen);
  const defaultGridSize = useSettingsStore((s) => s.defaultGridSize);
  const defaultSnapStep = useSettingsStore((s) => s.defaultSnapStep);
  const gridStep = snapToGrid ? snapStep : gridSize;

  useEffect(() => {
    setGridSize(typeof screen.gridSize === "number" ? screen.gridSize : defaultGridSize);
    setSnapStep(typeof screen.snapStep === "number" ? screen.snapStep : defaultSnapStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen.id]);

  const handleGridSizeChange = (n: number) => {
    setGridSize(n);
    updateScreen(screen.id, { gridSize: n });
  };
  const handleSnapStepChange = (n: number) => {
    setSnapStep(n);
    updateScreen(screen.id, { snapStep: n });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const fit = () => {
      const padding = 80;
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
  const cellW = dims.w / GRID_COLS;
  const cellH = dims.h / GRID_ROWS;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest(INTERACTIVE_GUARD_SELECTOR)) return;
      const meta = e.metaKey || e.ctrlKey;

      if (meta && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) {
          const next = redo();
          if (next) setWidgets(screen.id, next);
        } else {
          const prev = undo();
          if (prev) setWidgets(screen.id, prev);
        }
        return;
      }
      if (meta && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        const next = redo();
        if (next) setWidgets(screen.id, next);
        return;
      }
      if (meta && (e.key === "0" || e.key === ")")) {
        e.preventDefault();
        setZoom(autoZoom);
        return;
      }
      if (meta && (e.key === "1" || e.key === "!")) {
        e.preventDefault();
        setZoom(1);
        return;
      }
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        toggleGrid();
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        toggleSnap();
        return;
      }
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        toggleAlignment();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        toggleRulers();
        return;
      }

      if (selectedIds.length === 0) return;
      const step = e.shiftKey ? 4 : 1;
      if (e.key === "Delete" || e.key === "Backspace") {
        pushHistory(screen.widgets);
        selectedIds.forEach((id) => removeWidget(screen.id, id));
        select([]);
        e.preventDefault();
      } else if ((e.key === "d" || e.key === "D") && meta) {
        e.preventDefault();
        pushHistory(screen.widgets);
        const newIds: string[] = [];
        selectedIds.forEach((id) => {
          const c = duplicateWidget(screen.id, id);
          if (c) newIds.push(c.id);
        });
        if (newIds.length) select(newIds);
      } else if (e.key === "Escape") {
        select([]);
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        pushHistory(screen.widgets);
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
  }, [
    selectedIds,
    screen.id,
    screen.widgets,
    removeWidget,
    updateWidget,
    select,
    duplicateWidget,
    setWidgets,
    pushHistory,
    undo,
    redo,
  ]);

  const zoomOptions = useMemo(() => [0.25, 0.5, 0.75, 1], []);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-1 flex-col items-center justify-center overflow-auto bg-subtle p-8"
    >
      <div
        style={{
          width: dims.w * effective,
          height: dims.h * effective,
        }}
      >
        <div
          style={{
            transform: `scale(${effective})`,
            transformOrigin: "top left",
          }}
        >
          <CanvasStage
            screen={screen}
            cellW={cellW}
            cellH={cellH}
            effective={effective}
            gridSize={gridStep}
          />
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-steward-md">
        <span className="font-medium text-muted-foreground">
          {dims.w}×{dims.h}
        </span>
        <span className="text-border">|</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleGrid}
              className={
                "inline-flex h-6 w-6 items-center justify-center rounded-full " +
                (showGrid ? "bg-blue text-white" : "text-muted-foreground hover:bg-muted")
              }
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex items-center gap-2 text-xs">
            <span>Toggle grid</span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">G</kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <select
              aria-label="Grid size (cells)"
              value={gridStep}
              onChange={(e) => handleGridSizeChange(Number(e.target.value))}
              disabled={snapToGrid}
              className="h-6 rounded-full border border-border bg-card px-1.5 text-xs text-foreground focus:outline-none disabled:opacity-50"
            >
              {[1, 2, 4, 6, 8, 12, 16].map((n) => (
                <option key={n} value={n}>
                  {n} cells
                </option>
              ))}
            </select>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {snapToGrid ? "Grid size matches snap step while Snap is enabled" : "Grid size"}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleSnap}
              className={
                "inline-flex h-6 w-6 items-center justify-center rounded-full " +
                (snapToGrid ? "bg-blue text-white" : "text-muted-foreground hover:bg-muted")
              }
            >
              <Magnet className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex items-center gap-2 text-xs">
            <span>Snap to grid</span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">S</kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <select
              aria-label="Snap step size (cells)"
              value={snapStep}
              onChange={(e) => handleSnapStepChange(Number(e.target.value))}
              disabled={!snapToGrid}
              className="h-6 rounded-full border border-border bg-card px-1.5 text-xs text-foreground focus:outline-none disabled:opacity-50"
            >
              {[1, 2, 4, 6, 8, 12, 16].map((n) => (
                <option key={n} value={n}>
                  {n} cells
                </option>
              ))}
            </select>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Snap step (drag drops round to this many cells)
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleAlignment}
              className={
                "inline-flex h-6 w-6 items-center justify-center rounded-full " +
                (showAlignment ? "bg-blue text-white" : "text-muted-foreground hover:bg-muted")
              }
            >
              <AlignCenterVertical className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex items-center gap-2 text-xs">
            <span>Alignment guides</span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">A</kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={toggleRulers}
              className={
                "inline-flex h-6 w-6 items-center justify-center rounded-full " +
                (showRulers ? "bg-blue text-white" : "text-muted-foreground hover:bg-muted")
              }
            >
              <Ruler className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex items-center gap-2 text-xs">
            <span>Rulers &amp; snap guides</span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">R</kbd>
          </TooltipContent>
        </Tooltip>
        <span className="text-border">|</span>
        {zoomOptions.map((z) => (
          <Tooltip key={z}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setZoom(z)}
                className={`rounded-full px-2 py-0.5 ${Math.abs(zoom - z) < 0.01 ? "bg-blue text-white" : "text-muted-foreground hover:bg-muted"}`}
              >
                {Math.round(z * 100)}%
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Zoom to {Math.round(z * 100)}%
            </TooltipContent>
          </Tooltip>
        ))}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setZoom(autoZoom)}
              className="rounded-full px-2 py-0.5 text-muted-foreground hover:bg-muted"
            >
              <Maximize2 className="inline h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex items-center gap-2 text-xs">
            <span>Fit to screen</span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">
              ⌘/Ctrl + 0
            </kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setZoom(1)}
              className="rounded-full px-2 py-0.5 text-muted-foreground hover:bg-muted"
            >
              <Minimize2 className="inline h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex items-center gap-2 text-xs">
            <span>Actual size</span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">
              ⌘/Ctrl + 1
            </kbd>
          </TooltipContent>
        </Tooltip>
        <span className="text-border">|</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                const prev = undo();
                if (prev) setWidgets(screen.id, prev);
              }}
              className="rounded-full px-2 py-0.5 text-muted-foreground hover:bg-muted"
            >
              <Undo2 className="inline h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex items-center gap-2 text-xs">
            <span>Undo</span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">
              ⌘/Ctrl + Z
            </kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                const next = redo();
                if (next) setWidgets(screen.id, next);
              }}
              className="rounded-full px-2 py-0.5 text-muted-foreground hover:bg-muted"
            >
              <Redo2 className="inline h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="flex items-center gap-2 text-xs">
            <span>Redo</span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">
              ⌘/Ctrl + Y
            </kbd>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
