import { Component, type ReactNode } from "react";

import { SetupHint } from "@/components/widgets/SetupHint";
import { getWidgetDefinition } from "@/lib/widgetRegistry";
import type { WidgetInstance } from "@/types";

/**
 * One widget that throws (bad saved settings, an unexpected value) must not
 * take the whole screen with it: on an unattended TV that would replace the
 * page and stop it polling for fixes. It renders nothing on the TV and a hint
 * in the editor instead, and recovers when its settings change.
 */
class WidgetBoundary extends Component<
  { children: ReactNode; resetKey: string },
  { failedKey: string | null }
> {
  state = { failedKey: null as string | null };

  static getDerivedStateFromError() {
    return { failedKey: "pending" };
  }

  componentDidCatch(error: unknown) {
    console.error("[widget] failed to render:", error);
    this.setState({ failedKey: this.props.resetKey });
  }

  render() {
    const { failedKey } = this.state;
    if (failedKey !== null && (failedKey === "pending" || failedKey === this.props.resetKey)) {
      return <SetupHint>This widget's settings couldn't be shown. Open them to fix it.</SetupHint>;
    }
    return this.props.children;
  }
}

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
      <WidgetBoundary resetKey={JSON.stringify(widget.config)}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- per-widget config is untyped until the P1 widget schema lands */}
        <Comp config={widget.config as any} />
      </WidgetBoundary>
    </div>
  );
}
