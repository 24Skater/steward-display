import { Trash2, Copy, ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, X, Sparkles, Plus, MoreHorizontal, Pencil, User, Eye } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import type { Screen, WidgetInstance } from "@/types";
import { useScreenStore } from "@/store/screenStore";
import { useEditorStore } from "@/store/editorStore";
import { getWidgetDefinition } from "@/lib/widgetRegistry";
import { GRID_COLS, GRID_ROWS } from "@/lib/gridConstants";
import { WidgetConfigForm } from "./WidgetConfigForms";
import { getPresetsForWidget, type WidgetPreset } from "@/lib/widgetPresets";
import { usePresetStore, type CustomPreset } from "@/store/presetStore";
import { WidgetRenderer } from "./WidgetRenderer";



const BG_SWATCHES = ["", "#0B1220", "#111827", "#FFFFFF", "#FEF3C7", "#DBEAFE", "#FCE7F3"];
const TEXT_SWATCHES = ["#FFFFFF", "#0B1220", "#F59E0B", "#DC2626", "#2563EB", "#16A34A"];

export function PropertiesPanel({
  screen,
  widget,
  onClose,
}: {
  screen: Screen;
  widget: WidgetInstance;
  onClose: () => void;
}) {
  const updateWidget = useScreenStore((s) => s.updateWidget);
  const removeWidget = useScreenStore((s) => s.removeWidget);
  const duplicateWidget = useScreenStore((s) => s.duplicateWidget);
  const reorderWidget = useScreenStore((s) => s.reorderWidget);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const def = getWidgetDefinition(widget.widgetType);
  const Icon = def?.icon;

  const patch = (p: Partial<WidgetInstance>) => updateWidget(screen.id, widget.id, p);
  const patchConfig = (c: Record<string, unknown>) =>
    updateWidget(screen.id, widget.id, { config: { ...widget.config, ...c } });
  const patchStyle = (s: Partial<NonNullable<WidgetInstance["style"]>>) =>
    updateWidget(screen.id, widget.id, { style: { ...widget.style, ...s } });
  const builtInPresets = getPresetsForWidget(widget.widgetType);
  const allPresets = usePresetStore((s) => s.presets);
  const customPresets = useMemo(
    () => allPresets.filter((p) => p.widgetType === widget.widgetType),
    [allPresets, widget.widgetType],
  );
  const createPreset = usePresetStore((s) => s.create);
  const updatePreset = usePresetStore((s) => s.update);
  const removePreset = usePresetStore((s) => s.remove);

  const [editorPreset, setEditorPreset] = useState<
    | { mode: "create" }
    | { mode: "edit"; preset: CustomPreset }
    | null
  >(null);
  const [previewPreset, setPreviewPreset] = useState<WidgetPreset | null>(null);

  const applyPreset = (preset: WidgetPreset) => {
    if (preset.config) patchConfig(preset.config);
    if (preset.style) patchStyle(preset.style);
  };

  const applyPresetWithUndo = (preset: WidgetPreset) => {
    pushHistory(screen.widgets);
    const before = {
      config: { ...widget.config },
      style: widget.style ? { ...widget.style } : undefined,
    };
    const after = {
      config: { ...widget.config, ...(preset.config ?? {}) },
      style: preset.style
        ? { ...(widget.style ?? {}), ...preset.style }
        : widget.style
          ? { ...widget.style }
          : undefined,
    };

    applyPreset(preset);

    const showUndoToast = () => {
      toast.success(`Applied preset "${preset.label}"`, {
        action: {
          label: "Undo",
          onClick: () => {
            updateWidget(screen.id, widget.id, {
              config: before.config,
              style: before.style,
            });
            showRedoToast();
          },
        },
      });
    };

    const showRedoToast = () => {
      toast.success(`Reverted "${preset.label}"`, {
        action: {
          label: "Redo",
          onClick: () => {
            updateWidget(screen.id, widget.id, {
              config: after.config,
              style: after.style,
            });
            showUndoToast();
          },
        },
      });
    };

    showUndoToast();
  };

  const previewWidget = useMemo<WidgetInstance>(() => {
    const base = {
      id: "preset-preview",
      widgetType: widget.widgetType,
      x: 0,
      y: 0,
      w: 12,
      h: 6,
      config: widget.config,
      style: widget.style,
    };
    if (!previewPreset) return base;
    return {
      ...base,
      config: { ...widget.config, ...(previewPreset.config ?? {}) },
      style: { ...widget.style, ...(previewPreset.style ?? {}) },
    };
  }, [previewPreset, widget]);

  const hasAnyPresets = builtInPresets.length > 0 || customPresets.length > 0;



  return (
    <TooltipProvider delayDuration={200}>
      <aside className="flex h-full w-[22rem] shrink-0 flex-col border-l border-border bg-card">
      <div className="p-3">DEBUG panel</div>
      {false && (<>
      <div className="flex items-start justify-between gap-3 border-b border-border p-3">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-foreground">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{def?.label}</p>
            <p className="text-[11px] text-muted-foreground">{def?.category} widget</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
        <ToolbarButton tooltip="Duplicate" shortcut="⌘/Ctrl + D" onClick={() => duplicateWidget(screen.id, widget.id)}>
          <Copy className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton tooltip="Bring to front" onClick={() => reorderWidget(screen.id, widget.id, "front")}>
          <ChevronsUp className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton tooltip="Bring forward" onClick={() => reorderWidget(screen.id, widget.id, "forward")}>
          <ChevronUp className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton tooltip="Send backward" onClick={() => reorderWidget(screen.id, widget.id, "backward")}>
          <ChevronDown className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton tooltip="Send to back" onClick={() => reorderWidget(screen.id, widget.id, "back")}>
          <ChevronsDown className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      <Tabs defaultValue="content" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-3 mt-3 grid grid-cols-3">
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-0 flex-1 overflow-y-auto p-4">
          <div className="mb-5 rounded-md border border-border bg-muted/40 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Presets
              </div>
              <button
                type="button"
                onClick={() => setEditorPreset({ mode: "create" })}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground hover:border-blue hover:text-blue"
              >
                <Plus className="h-3 w-3" /> Save current
              </button>
            </div>

            {builtInPresets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {builtInPresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    onMouseEnter={() => setPreviewPreset(p)}
                    onMouseLeave={() => setPreviewPreset(null)}
                    title={p.description}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-blue hover:bg-blue/10 hover:text-blue"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}

            {customPresets.length > 0 && (
              <div className="mt-2">
                <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <User className="h-2.5 w-2.5" /> My presets
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {customPresets.map((p) => (
                    <div
                      key={p.id}
                      className="group inline-flex items-stretch overflow-hidden rounded-full border border-border bg-background text-[11px] font-medium text-foreground transition-colors hover:border-blue"
                      onMouseEnter={() => setPreviewPreset(p)}
                      onMouseLeave={() => setPreviewPreset(null)}
                    >
                      <button
                        type="button"
                        onClick={() => applyPreset(p)}
                        title={p.description}
                        className="px-2.5 py-1 hover:text-blue"
                      >
                        {p.label}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Preset options"
                            className="border-l border-border px-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditorPreset({ mode: "edit", preset: p })}>
                            <Pencil className="h-3.5 w-3.5" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              updatePreset(p.id, {
                                config: { ...widget.config },
                                style: widget.style ? { ...widget.style } : undefined,
                              });
                            }}
                          >
                            <Sparkles className="h-3.5 w-3.5" /> Update from current
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => removePreset(p.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasAnyPresets && (
              <div className="mt-3 rounded-md border border-border bg-background p-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <Eye className="h-3 w-3" /> Preview
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[10px] text-muted-foreground">
                      {previewPreset ? previewPreset.label : "Current widget"}
                    </span>
                    {previewPreset && (
                      <button
                        type="button"
                        onClick={() => {
                          applyPresetWithUndo(previewPreset);
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-blue px-1.5 py-0.5 text-[10px] font-medium text-white hover:bg-blue/90"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                </div>
                <div className="aspect-[16/9] w-full overflow-hidden rounded-md border border-border">
                  <WidgetRenderer widget={previewWidget} />
                </div>
              </div>
            )}

            <p className="mt-2 text-[10px] text-muted-foreground">
              {hasAnyPresets
                ? "Apply a preset, then keep tweaking — or save your current setup."
                : "No presets yet. Save your current setup to reuse it later."}
            </p>
          </div>

          <WidgetConfigForm widget={widget} onChange={patchConfig} />
        </TabsContent>

        <TabsContent value="style" className="mt-0 flex-1 space-y-5 overflow-y-auto p-4">
          <ColorBlock
            label="Background"
            value={widget.style?.backgroundColor ?? ""}
            onChange={(v) => patchStyle({ backgroundColor: v })}
            swatches={BG_SWATCHES}
            allowClear
          />
          <ColorBlock
            label="Text color"
            value={widget.style?.textColor ?? ""}
            onChange={(v) => patchStyle({ textColor: v })}
            swatches={TEXT_SWATCHES}
            allowClear
          />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Corner radius</Label>
            <Input
              value={widget.style?.borderRadius ?? ""}
              placeholder="e.g. 12px"
              onChange={(e) => patchStyle({ borderRadius: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Opacity ({Math.round((widget.style?.opacity ?? 1) * 100)}%)
            </Label>
            <Slider
              value={[Math.round((widget.style?.opacity ?? 1) * 100)]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => patchStyle({ opacity: v[0] / 100 })}
            />
          </div>
        </TabsContent>

        <TabsContent value="layout" className="mt-0 flex-1 space-y-5 overflow-y-auto p-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Position</p>
            <div className="grid grid-cols-2 gap-3">
              <Stepper label="X" value={widget.x} min={0} max={GRID_COLS - widget.w} onChange={(v) => patch({ x: v })} />
              <Stepper label="Y" value={widget.y} min={0} max={GRID_ROWS - widget.h} onChange={(v) => patch({ y: v })} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Size</p>
            <div className="grid grid-cols-2 gap-3">
              <Stepper label="Width" value={widget.w} min={1} max={GRID_COLS - widget.x} onChange={(v) => patch({ w: v })} />
              <Stepper label="Height" value={widget.h} min={1} max={GRID_ROWS - widget.y} onChange={(v) => patch({ h: v })} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick align</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => patch({ x: Math.floor((GRID_COLS - widget.w) / 2) })}>
                Center horizontally
              </Button>
              <Button variant="outline" size="sm" onClick={() => patch({ y: Math.floor((GRID_ROWS - widget.h) / 2) })}>
                Center vertically
              </Button>
              <Button variant="outline" size="sm" onClick={() => patch({ x: 0, w: GRID_COLS })}>
                Fill row
              </Button>
              <Button variant="outline" size="sm" onClick={() => patch({ y: 0, h: GRID_ROWS })}>
                Fill column
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="border-t border-border p-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                removeWidget(screen.id, widget.id);
                onClose();
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete widget
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="flex items-center gap-2 text-xs">
            <span>Remove selected widget</span>
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">Delete / Backspace</kbd>
          </TooltipContent>
        </Tooltip>
      </div>

      <PresetEditorDialog
        state={editorPreset}
        onClose={() => setEditorPreset(null)}
        onSave={(label, description) => {
          if (!editorPreset) return;
          if (editorPreset.mode === "create") {
            createPreset(
              widget.widgetType,
              label,
              widget.config ?? {},
              widget.style,
              description || undefined,
            );
          } else {
            updatePreset(editorPreset.preset.id, { label, description: description || undefined });
          }
          setEditorPreset(null);
        }}
      />
    </aside>
  </TooltipProvider>
  );
}

function PresetEditorDialog({
  state,
  onClose,
  onSave,
}: {
  state: { mode: "create" } | { mode: "edit"; preset: CustomPreset } | null;
  onClose: () => void;
  onSave: (label: string, description: string) => void;
}) {
  const isEdit = state?.mode === "edit";
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (state?.mode === "edit") {
      setLabel(state.preset.label);
      setDescription(state.preset.description ?? "");
    } else if (state?.mode === "create") {
      setLabel("");
      setDescription("");
    }
  }, [state]);

  return (
    <Dialog
      open={state !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit preset" : "Save as preset"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Rename this preset or update its description."
              : "Save the current widget settings so you can reapply them later."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="preset-label" className="text-xs font-medium">Name</Label>
            <Input
              id="preset-label"
              autoFocus
              value={label}
              placeholder="e.g. Sunday service"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preset-desc" className="text-xs font-medium">Description (optional)</Label>
            <Textarea
              id="preset-desc"
              value={description}
              rows={2}
              placeholder="Shown as a tooltip"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(label.trim(), description.trim())} disabled={!label.trim()}>
            {isEdit ? "Save changes" : "Save preset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToolbarButton({
  tooltip,
  shortcut,
  onClick,
  children,
}: {
  tooltip: string;
  shortcut?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2 text-xs">
        <span>{tooltip}</span>
        {shortcut && <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono">{shortcut}</kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

function ColorBlock({
  label,
  value,
  onChange,
  swatches,
  allowClear,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  swatches: string[];
  allowClear?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-border bg-background"
          aria-label={`${label} picker`}
        />
        <Input value={value} placeholder="transparent" onChange={(e) => onChange(e.target.value)} className="flex-1 font-mono text-xs" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {swatches.map((s) => (
          <button
            key={s || "none"}
            type="button"
            onClick={() => onChange(s)}
            className={
              "h-6 w-6 rounded-md border transition-transform hover:scale-110 " +
              (value === s ? "border-blue ring-2 ring-blue/40" : "border-border")
            }
            style={s ? { background: s } : { backgroundImage: "repeating-linear-gradient(45deg, hsl(var(--muted)) 0 4px, transparent 4px 8px)" }}
            aria-label={s ? `Use ${s}` : "Transparent"}
            title={s || "Transparent"}
          />
        ))}
        {allowClear && value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="ml-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
      />
    </div>
  );
}