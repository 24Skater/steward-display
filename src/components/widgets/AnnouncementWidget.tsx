export interface AnnouncementConfig {
  title?: string;
  body?: string;
  align?: "left" | "center" | "right";
  titleColor?: string;
  titleSize?: number; // cqw units, default 5
  titleWeight?: number; // 100-900, default 700
  bodyColor?: string;
  bodySize?: number; // cqw units, default 3
}

export function AnnouncementWidget({ config }: { config: AnnouncementConfig }) {
  const align = config.align ?? "center";
  const titleCqw = config.titleSize ?? 5;
  const bodyCqw = config.bodySize ?? 3;
  return (
    <div className={`flex h-full w-full flex-col justify-center p-6 text-${align}`}>
      {config.title && (
        <h3
          className="leading-tight"
          style={{
            fontSize: `clamp(1rem, ${titleCqw}cqw, ${Math.max(2, titleCqw * 0.6)}rem)`,
            color: config.titleColor || undefined,
            fontWeight: config.titleWeight ?? 700,
          }}
        >
          {config.title}
        </h3>
      )}
      {config.body && (
        <p
          className="mt-3 leading-snug"
          style={{
            fontSize: `clamp(0.8rem, ${bodyCqw}cqw, ${Math.max(1.25, bodyCqw * 0.6)}rem)`,
            color: config.bodyColor || undefined,
            opacity: config.bodyColor ? 1 : 0.9,
          }}
        >
          {config.body}
        </p>
      )}
    </div>
  );
}