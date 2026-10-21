import { SetupHint } from "./SetupHint";

export interface AnnouncementConfig {
  title?: string;
  body?: string;
  align?: "left" | "center" | "right";
  titleColor?: string;
  titleSize?: number; // cqw units, default 5
  titleWeight?: number; // 100-900, default 700
  bodyColor?: string;
  bodySize?: number; // cqw units, default 3
  spacing?: number; // px gap between title and body, default 12
  titleLineHeight?: number; // unitless, default 1.1
  bodyLineHeight?: number; // unitless, default 1.4
  titleMaxLines?: number; // 0 = unlimited
  bodyMaxLines?: number; // 0 = unlimited
  titleTruncationMode?: "ellipsis" | "clip"; // default ellipsis
  bodyTruncationMode?: "ellipsis" | "clip"; // default ellipsis
}

export function AnnouncementWidget({ config }: { config: AnnouncementConfig }) {
  if (!config.title && !config.body) return <SetupHint>Add an announcement</SetupHint>;
  const align = config.align ?? "center";
  const titleCqw = config.titleSize ?? 5;
  const bodyCqw = config.bodySize ?? 3;
  const gap = config.spacing ?? 12;
  return (
    <div className={`flex h-full w-full flex-col justify-center p-6 text-${align}`}>
      {config.title && (
        <h3
          className=""
          style={{
            fontSize: `clamp(1rem, ${titleCqw}cqw, ${Math.max(2, titleCqw * 0.6)}rem)`,
            color: config.titleColor || undefined,
            fontWeight: config.titleWeight ?? 700,
            lineHeight: config.titleLineHeight ?? 1.1,
            ...(config.titleMaxLines && config.titleMaxLines > 0
              ? {
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical" as const,
                  WebkitLineClamp: config.titleMaxLines,
                  overflow: "hidden",
                  textOverflow:
                    (config.titleTruncationMode ?? "ellipsis") === "clip" ? "clip" : "ellipsis",
                }
              : {}),
          }}
        >
          {config.title}
        </h3>
      )}
      {config.body && (
        <p
          className=""
          style={{
            fontSize: `clamp(0.8rem, ${bodyCqw}cqw, ${Math.max(1.25, bodyCqw * 0.6)}rem)`,
            color: config.bodyColor || undefined,
            opacity: config.bodyColor ? 1 : 0.9,
            lineHeight: config.bodyLineHeight ?? 1.4,
            marginTop: config.title ? gap : 0,
            ...(config.bodyMaxLines && config.bodyMaxLines > 0
              ? {
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical" as const,
                  WebkitLineClamp: config.bodyMaxLines,
                  overflow: "hidden",
                  textOverflow:
                    (config.bodyTruncationMode ?? "ellipsis") === "clip" ? "clip" : "ellipsis",
                }
              : {}),
          }}
        >
          {config.body}
        </p>
      )}
    </div>
  );
}
