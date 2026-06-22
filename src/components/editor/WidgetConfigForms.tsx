import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { WidgetInstance } from "@/types";
import { AnnouncementWidget } from "@/components/widgets/AnnouncementWidget";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (!Number.isNaN(n)) onChange(n);
      }}
    />
  );
}

function SwatchRow({
  value,
  onChange,
  swatches,
}: {
  value: string;
  onChange: (v: string) => void;
  swatches: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {swatches.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={
            "h-6 w-6 rounded-md border transition-transform hover:scale-110 " +
            (value === s ? "border-blue ring-2 ring-blue/40" : "border-border")
          }
          style={{ background: s }}
          aria-label={`Use ${s}`}
          title={s}
        />
      ))}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  swatches,
  allowClear,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  swatches?: string[];
  allowClear?: boolean;
}) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-border bg-background"
          aria-label={`${label} color picker`}
        />
        <Input
          value={value}
          placeholder={allowClear ? "transparent" : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-xs"
        />
        {allowClear && value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-md border border-border bg-background px-2 text-xs text-muted-foreground hover:bg-muted"
          >
            Clear
          </button>
        )}
      </div>
      {swatches && <div className="mt-2"><SwatchRow value={value} onChange={onChange} swatches={swatches} /></div>}
    </Field>
  );
}

const ALIGN_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const DATE_FORMATS = [
  { value: "full", label: "Full (Monday, June 22, 2026)" },
  { value: "long", label: "Long (June 22, 2026)" },
  { value: "medium", label: "Medium (Jun 22, 2026)" },
  { value: "short", label: "Short (6/22/26)" },
];

const IMAGE_FIT = [
  { value: "cover", label: "Cover (crop to fill)" },
  { value: "contain", label: "Contain (fit inside)" },
  { value: "fill", label: "Fill (stretch)" },
];

export function WidgetConfigForm({
  widget,
  onChange,
}: {
  widget: WidgetInstance;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const cfg = widget.config as Record<string, any>;
  const set = (k: string, v: unknown) => onChange({ [k]: v });

  switch (widget.widgetType) {
    case "clock":
      return (
        <div className="space-y-4">
          <Field label="24-hour format">
            <Switch checked={!!cfg.format24h} onCheckedChange={(v) => set("format24h", v)} />
          </Field>
          <Field label="Show seconds">
            <Switch checked={!!cfg.showSeconds} onCheckedChange={(v) => set("showSeconds", v)} />
          </Field>
        </div>
      );
    case "date":
      return (
        <Field label="Format">
          <Select value={cfg.format ?? "full"} onValueChange={(v) => set("format", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      );
    case "announcement":
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Live preview</Label>
            <div
              className="overflow-hidden rounded-md border border-border"
              style={{
                backgroundColor: (widget.style?.backgroundColor as string) || "#0B1220",
                color: (widget.style?.textColor as string) || "#FFFFFF",
                height: 140,
                containerType: "size",
              }}
            >
              <AnnouncementWidget config={cfg as any} />
            </div>
          </div>
          <Field label="Title">
            <Input value={cfg.title ?? ""} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Body">
            <Textarea rows={4} value={cfg.body ?? ""} onChange={(e) => set("body", e.target.value)} />
          </Field>
          <Field label="Alignment">
            <Select value={cfg.align ?? "center"} onValueChange={(v) => set("align", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALIGN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <ColorField
            label="Title color"
            value={cfg.titleColor ?? ""}
            onChange={(v) => set("titleColor", v)}
            swatches={["#FFFFFF", "#0B1220", "#2563EB", "#DC2626", "#16A34A", "#D97706"]}
            allowClear
          />
          <Field label={`Title size (${cfg.titleSize ?? 5})`} hint="Scales with widget width">
            <Slider
              value={[cfg.titleSize ?? 5]}
              min={2}
              max={15}
              step={0.5}
              onValueChange={(v) => set("titleSize", v[0])}
            />
          </Field>
          <Field label="Title weight">
            <Select
              value={String(cfg.titleWeight ?? 700)}
              onValueChange={(v) => set("titleWeight", Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="300">Light (300)</SelectItem>
                <SelectItem value="400">Regular (400)</SelectItem>
                <SelectItem value="500">Medium (500)</SelectItem>
                <SelectItem value="600">Semibold (600)</SelectItem>
                <SelectItem value="700">Bold (700)</SelectItem>
                <SelectItem value="800">Extrabold (800)</SelectItem>
                <SelectItem value="900">Black (900)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <ColorField
            label="Body color"
            value={cfg.bodyColor ?? ""}
            onChange={(v) => set("bodyColor", v)}
            swatches={["#FFFFFF", "#0B1220", "#2563EB", "#DC2626", "#16A34A", "#D97706"]}
            allowClear
          />
          <Field label={`Body size (${cfg.bodySize ?? 3})`} hint="Scales with widget width">
            <Slider
              value={[cfg.bodySize ?? 3]}
              min={1}
              max={10}
              step={0.5}
              onValueChange={(v) => set("bodySize", v[0])}
            />
          </Field>
        </div>
      );
    case "countdown":
      return (
        <div className="space-y-4">
          <Field label="Label">
            <Input value={cfg.label ?? ""} onChange={(e) => set("label", e.target.value)} />
          </Field>
          <Field label="Target date & time" hint="Local time">
            <Input
              type="datetime-local"
              value={cfg.target ?? ""}
              onChange={(e) => set("target", e.target.value)}
            />
          </Field>
        </div>
      );
    case "scripture":
      return (
        <div className="space-y-4">
          <Field label="Verse text">
            <Textarea rows={4} value={cfg.text ?? ""} onChange={(e) => set("text", e.target.value)} />
          </Field>
          <Field label="Reference" hint="e.g. John 3:16">
            <Input value={cfg.reference ?? ""} onChange={(e) => set("reference", e.target.value)} />
          </Field>
          <Field label="Translation">
            <Input value={cfg.version ?? ""} onChange={(e) => set("version", e.target.value)} placeholder="ESV, NIV, KJV…" />
          </Field>
        </div>
      );
    case "text":
      return (
        <div className="space-y-4">
          <Field label="Text">
            <Textarea rows={5} value={cfg.text ?? ""} onChange={(e) => set("text", e.target.value)} />
          </Field>
          <Field label="Alignment">
            <Select value={cfg.align ?? "left"} onValueChange={(v) => set("align", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALIGN_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
      );
    case "image":
      return (
        <div className="space-y-4">
          <Field label="Image URL">
            <Input value={cfg.src ?? ""} onChange={(e) => set("src", e.target.value)} placeholder="https://…" />
          </Field>
          {cfg.src && (
            <div className="overflow-hidden rounded-md border border-border bg-muted">
              <img src={cfg.src} alt="" className="h-32 w-full object-cover" />
            </div>
          )}
          <Field label="Fit">
            <Select value={cfg.fit ?? "cover"} onValueChange={(v) => set("fit", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {IMAGE_FIT.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Alt text" hint="For screen readers">
            <Input value={cfg.alt ?? ""} onChange={(e) => set("alt", e.target.value)} />
          </Field>
        </div>
      );
    case "video":
      return (
        <div className="space-y-4">
          <Field label="Video URL" hint="MP4 / WebM direct link">
            <Input value={cfg.src ?? ""} onChange={(e) => set("src", e.target.value)} />
          </Field>
          <Field label="Muted">
            <Switch checked={cfg.muted ?? true} onCheckedChange={(v) => set("muted", v)} />
          </Field>
          <Field label="Loop">
            <Switch checked={cfg.loop ?? true} onCheckedChange={(v) => set("loop", v)} />
          </Field>
        </div>
      );
    case "giving-progress":
      return (
        <div className="space-y-4">
          <Field label="Campaign label">
            <Input value={cfg.label ?? ""} onChange={(e) => set("label", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Goal ($)">
              <NumberInput value={cfg.goal ?? 0} min={0} onChange={(v) => set("goal", v)} />
            </Field>
            <Field label="Current ($)">
              <NumberInput value={cfg.current ?? 0} min={0} onChange={(v) => set("current", v)} />
            </Field>
          </div>
          <ColorField
            label="Accent color"
            value={cfg.accent ?? "#16A34A"}
            onChange={(v) => set("accent", v)}
            swatches={["#16A34A", "#2563EB", "#D97706", "#DC2626", "#7C3AED", "#0891B2"]}
          />
        </div>
      );
    case "divider":
      return (
        <div className="space-y-4">
          <Field label="Orientation">
            <Select value={cfg.orientation ?? "horizontal"} onValueChange={(v) => set("orientation", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="horizontal">Horizontal</SelectItem>
                <SelectItem value="vertical">Vertical</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Thickness (${cfg.thickness ?? 2}px)`}>
            <Slider
              value={[cfg.thickness ?? 2]}
              min={1}
              max={20}
              step={1}
              onValueChange={(v) => set("thickness", v[0])}
            />
          </Field>
          <Field label={`Opacity (${Math.round((cfg.opacity ?? 0.5) * 100)}%)`}>
            <Slider
              value={[Math.round((cfg.opacity ?? 0.5) * 100)]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) => set("opacity", v[0] / 100)}
            />
          </Field>
        </div>
      );
    case "weather":
      return (
        <Field label="City" hint="Requires OpenWeatherMap API key in Settings">
          <Input value={cfg.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="Nashville, TN" />
        </Field>
      );
    case "event-list":
      return (
        <Field label="Title">
          <Input value={cfg.title ?? ""} onChange={(e) => set("title", e.target.value)} />
        </Field>
      );
    default:
      return <p className="text-xs text-muted-foreground">No settings for this widget.</p>;
  }
}