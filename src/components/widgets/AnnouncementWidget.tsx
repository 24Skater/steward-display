export interface AnnouncementConfig {
  title?: string;
  body?: string;
  align?: "left" | "center" | "right";
  titleColor?: string;
  titleSize?: number; // cqw units, default 5
}

export function AnnouncementWidget({ config }: { config: AnnouncementConfig }) {
  const align = config.align ?? "center";
  const titleCqw = config.titleSize ?? 5;
  return (
    <div className={`flex h-full w-full flex-col justify-center p-6 text-${align}`}>
      {config.title && (
        <h3
          className="font-bold leading-tight"
          style={{
            fontSize: `clamp(1rem, ${titleCqw}cqw, ${Math.max(2, titleCqw * 0.6)}rem)`,
            color: config.titleColor || undefined,
          }}
        >
          {config.title}
        </h3>
      )}
      {config.body && (
        <p className="mt-3 leading-snug opacity-90" style={{ fontSize: "clamp(0.9rem, 3cqw, 1.75rem)" }}>{config.body}</p>
      )}
    </div>
  );
}