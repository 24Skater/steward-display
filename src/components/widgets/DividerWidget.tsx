export interface DividerConfig {
  orientation?: "horizontal" | "vertical";
  thickness?: number;
  opacity?: number;
}

export function DividerWidget({ config }: { config: DividerConfig }) {
  const horizontal = (config.orientation ?? "horizontal") === "horizontal";
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div
        style={{
          backgroundColor: "currentColor",
          opacity: config.opacity ?? 0.5,
          width: horizontal ? "100%" : `${config.thickness ?? 2}px`,
          height: horizontal ? `${config.thickness ?? 2}px` : "100%",
        }}
      />
    </div>
  );
}