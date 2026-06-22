import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import type { Screen, WidgetInstance } from "@/types";
import { useScreenStore } from "@/store/screenStore";
import { getWidgetDefinition } from "@/lib/widgetRegistry";

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
  const def = getWidgetDefinition(widget.widgetType);

  const patch = (p: Partial<WidgetInstance>) => updateWidget(screen.id, widget.id, p);
  const patchConfig = (c: Record<string, unknown>) =>
    updateWidget(screen.id, widget.id, { config: { ...widget.config, ...c } });
  const patchStyle = (s: Partial<NonNullable<WidgetInstance["style"]>>) =>
    updateWidget(screen.id, widget.id, { style: { ...widget.style, ...s } });

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Selected</p>
          <p className="text-sm font-semibold text-foreground">{def?.label}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Position</h4>
          <div className="grid grid-cols-2 gap-3">
            <Field label="X"><NumberInput value={widget.x} onChange={(v) => patch({ x: v })} /></Field>
            <Field label="Y"><NumberInput value={widget.y} onChange={(v) => patch({ y: v })} /></Field>
            <Field label="W"><NumberInput value={widget.w} min={1} onChange={(v) => patch({ w: v })} /></Field>
            <Field label="H"><NumberInput value={widget.h} min={1} onChange={(v) => patch({ h: v })} /></Field>
          </div>
        </section>

        <section className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Appearance</h4>
          <Field label="Background">
            <ColorInput value={widget.style?.backgroundColor ?? ""} onChange={(v) => patchStyle({ backgroundColor: v })} />
          </Field>
          <Field label="Text color">
            <ColorInput value={widget.style?.textColor ?? ""} onChange={(v) => patchStyle({ textColor: v })} />
          </Field>
          <Field label="Corner radius">
            <Input value={widget.style?.borderRadius ?? ""} placeholder="e.g. 12px" onChange={(e) => patchStyle({ borderRadius: e.target.value })} />
          </Field>
          <Field label={`Opacity (${Math.round((widget.style?.opacity ?? 1) * 100)}%)`}>
            <Slider value={[Math.round((widget.style?.opacity ?? 1) * 100)]} min={0} max={100} step={1} onValueChange={(v) => patchStyle({ opacity: v[0] / 100 })} />
          </Field>
        </section>

        <section className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Widget settings</h4>
          <WidgetConfigFields widget={widget} onChange={patchConfig} />
        </section>
      </div>

      <div className="border-t border-border p-3">
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
      </div>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function NumberInput({ value, onChange, min }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <Input
      type="number"
      min={min}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isNaN(n)) onChange(n);
      }}
    />
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      <input
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 cursor-pointer rounded-md border border-border bg-background"
        aria-label="Color picker"
      />
      <Input value={value} placeholder="transparent" onChange={(e) => onChange(e.target.value)} className="flex-1" />
    </div>
  );
}

function WidgetConfigFields({ widget, onChange }: { widget: WidgetInstance; onChange: (c: Record<string, unknown>) => void }) {
  const cfg = widget.config as Record<string, any>;
  const set = (k: string, v: unknown) => onChange({ [k]: v });

  switch (widget.widgetType) {
    case "clock":
      return (
        <>
          <Field label="24-hour format">
            <Switch checked={!!cfg.format24h} onCheckedChange={(v) => set("format24h", v)} />
          </Field>
          <Field label="Show seconds">
            <Switch checked={!!cfg.showSeconds} onCheckedChange={(v) => set("showSeconds", v)} />
          </Field>
        </>
      );
    case "date":
      return (
        <Field label="Format (full / long / medium / short)">
          <Input value={cfg.format ?? "full"} onChange={(e) => set("format", e.target.value)} />
        </Field>
      );
    case "announcement":
      return (
        <>
          <Field label="Title"><Input value={cfg.title ?? ""} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Body"><Textarea rows={4} value={cfg.body ?? ""} onChange={(e) => set("body", e.target.value)} /></Field>
          <Field label="Alignment (left / center / right)">
            <Input value={cfg.align ?? "center"} onChange={(e) => set("align", e.target.value)} />
          </Field>
        </>
      );
    case "countdown":
      return (
        <>
          <Field label="Label"><Input value={cfg.label ?? ""} onChange={(e) => set("label", e.target.value)} /></Field>
          <Field label="Target (ISO datetime, e.g. 2026-07-04T10:00)">
            <Input value={cfg.target ?? ""} onChange={(e) => set("target", e.target.value)} placeholder="2026-12-25T00:00" />
          </Field>
        </>
      );
    case "scripture":
      return (
        <>
          <Field label="Verse text"><Textarea rows={4} value={cfg.text ?? ""} onChange={(e) => set("text", e.target.value)} /></Field>
          <Field label="Reference"><Input value={cfg.reference ?? ""} onChange={(e) => set("reference", e.target.value)} /></Field>
          <Field label="Version"><Input value={cfg.version ?? ""} onChange={(e) => set("version", e.target.value)} /></Field>
        </>
      );
    case "text":
      return (
        <>
          <Field label="Text"><Textarea rows={5} value={cfg.text ?? ""} onChange={(e) => set("text", e.target.value)} /></Field>
          <Field label="Alignment"><Input value={cfg.align ?? "left"} onChange={(e) => set("align", e.target.value)} /></Field>
        </>
      );
    case "image":
      return (
        <>
          <Field label="Image URL"><Input value={cfg.src ?? ""} onChange={(e) => set("src", e.target.value)} /></Field>
          <Field label="Fit (cover / contain / fill)"><Input value={cfg.fit ?? "cover"} onChange={(e) => set("fit", e.target.value)} /></Field>
          <Field label="Alt text"><Input value={cfg.alt ?? ""} onChange={(e) => set("alt", e.target.value)} /></Field>
        </>
      );
    case "video":
      return (
        <>
          <Field label="Video URL"><Input value={cfg.src ?? ""} onChange={(e) => set("src", e.target.value)} /></Field>
          <Field label="Muted"><Switch checked={cfg.muted ?? true} onCheckedChange={(v) => set("muted", v)} /></Field>
          <Field label="Loop"><Switch checked={cfg.loop ?? true} onCheckedChange={(v) => set("loop", v)} /></Field>
        </>
      );
    case "giving-progress":
      return (
        <>
          <Field label="Label"><Input value={cfg.label ?? ""} onChange={(e) => set("label", e.target.value)} /></Field>
          <Field label="Goal"><Input type="number" value={cfg.goal ?? 0} onChange={(e) => set("goal", Number(e.target.value))} /></Field>
          <Field label="Current"><Input type="number" value={cfg.current ?? 0} onChange={(e) => set("current", Number(e.target.value))} /></Field>
          <Field label="Accent color"><ColorInput value={cfg.accent ?? "#16A34A"} onChange={(v) => set("accent", v)} /></Field>
        </>
      );
    case "divider":
      return (
        <>
          <Field label="Orientation (horizontal / vertical)"><Input value={cfg.orientation ?? "horizontal"} onChange={(e) => set("orientation", e.target.value)} /></Field>
          <Field label="Thickness (px)"><Input type="number" value={cfg.thickness ?? 2} onChange={(e) => set("thickness", Number(e.target.value))} /></Field>
        </>
      );
    case "weather":
      return <Field label="City"><Input value={cfg.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>;
    case "event-list":
      return (
        <Field label="Title"><Input value={cfg.title ?? ""} onChange={(e) => set("title", e.target.value)} /></Field>
      );
    default:
      return <p className="text-xs text-muted-foreground">No settings.</p>;
  }
}