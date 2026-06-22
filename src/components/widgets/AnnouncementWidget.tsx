export interface AnnouncementConfig {
  title?: string;
  body?: string;
  align?: "left" | "center" | "right";
}

export function AnnouncementWidget({ config }: { config: AnnouncementConfig }) {
  const align = config.align ?? "center";
  return (
    <div className={`flex h-full w-full flex-col justify-center p-6 text-${align}`}>
      {config.title && (
        <h3 className="font-bold leading-tight" style={{ fontSize: "clamp(1.25rem, 5cqw, 3rem)" }}>{config.title}</h3>
      )}
      {config.body && (
        <p className="mt-3 leading-snug opacity-90" style={{ fontSize: "clamp(0.9rem, 3cqw, 1.75rem)" }}>{config.body}</p>
      )}
    </div>
  );
}