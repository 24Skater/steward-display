import type { Screen } from "@/types";
import { getScreenDimensions } from "@/types";

export function ScreenThumbnail({ screen }: { screen: Screen }) {
  const dims = getScreenDimensions(screen);
  return (
    <div
      className="relative overflow-hidden rounded-md"
      style={{
        aspectRatio: `${dims.w} / ${dims.h}`,
        backgroundColor: screen.backgroundColor,
        backgroundImage: screen.backgroundImage ? `url(${screen.backgroundImage})` : undefined,
        backgroundSize: "cover",
      }}
    >
      <div className="absolute inset-0">
        {screen.widgets.map((w) => (
          <div
            key={w.id}
            className="absolute rounded-sm bg-white/15 ring-1 ring-white/10"
            style={{
              left: `${(w.x / 24) * 100}%`,
              top: `${(w.y / 16) * 100}%`,
              width: `${(w.w / 24) * 100}%`,
              height: `${(w.h / 16) * 100}%`,
            }}
          />
        ))}
        {screen.widgets.length === 0 && (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/40">
            Empty
          </div>
        )}
      </div>
    </div>
  );
}