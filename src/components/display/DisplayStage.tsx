import { useEffect, useState, type ReactNode } from "react";

import { WidgetRenderer } from "@/components/editor/WidgetRenderer";
import { DisplayModeContext } from "@/lib/displayMode";
import { GRID_COLS, GRID_ROWS } from "@/lib/gridConstants";
import { getScreenDimensions, type Screen } from "@/types";

/**
 * What a TV draws: a screen scaled to fit, or a quiet branded slate. Shared by
 * the editor's preview and the paired TV at /tv, so the two cannot drift.
 */

function useFitScale(screen: Screen) {
  const dims = getScreenDimensions(screen);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / dims.w, window.innerHeight / dims.h));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [dims.w, dims.h]);
  return { scale, dims };
}

/** Dark theme and no scrollbars while a display page is mounted. */
export function useDisplayChrome(): void {
  useEffect(() => {
    const prev = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = "dark";
    document.body.style.overflow = "hidden";
    return () => {
      if (prev) document.documentElement.dataset.theme = prev;
      else delete document.documentElement.dataset.theme;
      document.body.style.overflow = "";
    };
  }, []);
}

interface IdleSlateProps {
  message?: ReactNode;
  children?: ReactNode;
}

/** A TV has nobody to click a link or read an error, so every non-screen state is this slate. */
export function IdleSlate({ message, children }: IdleSlateProps) {
  return (
    <div className="fixed inset-0 flex cursor-none flex-col items-center justify-center gap-6 bg-navy text-white">
      <img src="/brand/steward-mark.svg" alt="" className="h-16 w-16 opacity-80" />
      {message && <p className="max-w-xl px-6 text-center text-2xl text-white/80">{message}</p>}
      {children}
    </div>
  );
}

export function DisplayStage({ screen, overlay }: { screen: Screen; overlay?: ReactNode }) {
  const { scale, dims } = useFitScale(screen);
  const cellW = dims.w / GRID_COLS;
  const cellH = dims.h / GRID_ROWS;

  return (
    <DisplayModeContext.Provider value={true}>
      <div
        className="fixed inset-0 flex cursor-none items-center justify-center overflow-hidden"
        style={{
          backgroundColor: screen.backgroundColor,
          // Quoted, so an address can only ever be an address.
          backgroundImage: screen.backgroundImage
            ? `url(${JSON.stringify(screen.backgroundImage)})`
            : undefined,
          backgroundSize: "cover",
        }}
      >
        <div
          className="relative text-white"
          style={{
            width: dims.w,
            height: dims.h,
            transform: `scale(${scale})`,
            transformOrigin: "center center",
          }}
        >
          {screen.widgets.map((w, i) => (
            <div
              key={w.id}
              className="absolute animate-steward-in"
              style={{
                left: w.x * cellW,
                top: w.y * cellH,
                width: w.w * cellW,
                height: w.h * cellH,
                animationDelay: `${i * 100}ms`,
              }}
            >
              <WidgetRenderer widget={w} />
            </div>
          ))}
        </div>

        {screen.showWatermark !== false && (
          <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-2 text-white/30">
            <img src="/brand/steward-mark.svg" alt="" className="h-4 w-4" />
            <span className="text-xs font-medium">Steward · Display</span>
          </div>
        )}
        {overlay}
      </div>
    </DisplayModeContext.Provider>
  );
}
