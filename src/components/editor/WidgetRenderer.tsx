import type { WidgetInstance } from "@/types";
import { getWidgetDefinition } from "@/lib/widgetRegistry";

export function WidgetRenderer({ widget }: { widget: WidgetInstance }) {
  const def = getWidgetDefinition(widget.widgetType);
  if (!def) return null;
  const Comp = def.Component;
  const style = widget.style ?? {};
  return (
    <div
      className="h-full w-full overflow-hidden"
      style={{
        backgroundColor: style.backgroundColor,
        color: style.textColor,
        borderRadius: style.borderRadius,
        opacity: style.opacity ?? 1,
        containerType: "size",
      }}
    >
      <Comp config={widget.config as any} />
    </div>
  );
}
