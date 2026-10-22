import { useId, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { WidgetInstance, WidgetType } from "@/types";
import { WeatherPlacePicker } from "./WeatherPlacePicker";

/**
 * The words on a widget, and nothing else, for editing from a phone.
 *
 * The full editor's settings forms mix content with styling: sliders,
 * swatches, alignment. On a phone those are mis-tapped while scrolling, and a
 * nudged slider goes live on every TV. Here each widget offers only what it
 * says, in big, labelled fields with 16px text so phones do not zoom in.
 */

/** Widget types with something to say; the rest are set on a tablet or computer. */
export const CONTENT_WIDGETS: ReadonlySet<WidgetType> = new Set([
  "announcement",
  "text",
  "scripture",
  "countdown",
  "giving-progress",
  "event-list",
  "image",
  "weather",
]);

const FIELD = "h-11 text-base";

interface FieldProps {
  label: string;
  hint?: string;
  children: (id: string, describedBy?: string) => ReactNode;
}

function Field({ label, hint, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">
        {label}
      </Label>
      {children(id, hintId)}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

interface WidgetContentFormProps {
  widget: WidgetInstance;
  onChange: (patch: Record<string, unknown>) => void;
}

export function WidgetContentForm({ widget, onChange }: WidgetContentFormProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- per-widget config is untyped until the widget schema lands
  const cfg = widget.config as Record<string, any>;
  const text = (key: string, label: string, opts: { multiline?: boolean; hint?: string } = {}) => (
    <Field label={label} hint={opts.hint}>
      {(id, describedBy) =>
        opts.multiline ? (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            className="min-h-28 text-base"
            value={cfg[key] ?? ""}
            onChange={(e) => onChange({ [key]: e.target.value })}
          />
        ) : (
          <Input
            id={id}
            aria-describedby={describedBy}
            className={FIELD}
            value={cfg[key] ?? ""}
            onChange={(e) => onChange({ [key]: e.target.value })}
          />
        )
      }
    </Field>
  );
  const amount = (key: string, label: string) => (
    <Field label={label}>
      {(id) => (
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          className={FIELD}
          value={cfg[key] ?? 0}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= 0) onChange({ [key]: n });
          }}
        />
      )}
    </Field>
  );

  const fields: Partial<Record<WidgetType, ReactNode>> = {
    announcement: (
      <>
        {text("title", "Title")}
        {text("body", "Message", { multiline: true })}
      </>
    ),
    text: text("text", "Text", { multiline: true }),
    scripture: (
      <>
        {text("text", "Verse", { multiline: true })}
        {text("reference", "Reference", { hint: "For example John 3:16" })}
        {text("version", "Translation", { hint: "For example NIV" })}
      </>
    ),
    countdown: (
      <>
        {text("label", "Label")}
        <Field label="Counts down to" hint="In the church's time zone">
          {(id, describedBy) => (
            <Input
              id={id}
              type="datetime-local"
              aria-describedby={describedBy}
              className={FIELD}
              value={cfg.target ?? ""}
              onChange={(e) => onChange({ target: e.target.value })}
            />
          )}
        </Field>
      </>
    ),
    "giving-progress": (
      <>
        {text("label", "Label")}
        {amount("current", "Given so far")}
        {amount("goal", "Goal")}
      </>
    ),
    "event-list": text("title", "Title"),
    image: (
      <>
        {text("src", "Image address", { hint: "Starts with https://" })}
        {text("alt", "What the image shows", { hint: "Read aloud to people who can't see it" })}
      </>
    ),
    weather: (
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Place</p>
        <WeatherPlacePicker value={cfg.place} onChange={(place) => onChange({ place })} />
      </div>
    ),
  };

  return <div className="space-y-4">{fields[widget.widgetType] ?? null}</div>;
}

/** A heading that tells two widgets of the same kind apart: "Announcement: Welcome". */
export function contentSummary(widget: WidgetInstance): string | null {
  const cfg = widget.config as Record<string, unknown>;
  const first = [cfg.title, cfg.label, cfg.reference, cfg.text].find(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
  return first ? (first.length > 32 ? `${first.slice(0, 31)}…` : first) : null;
}
