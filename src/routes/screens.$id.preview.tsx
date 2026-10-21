import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useScreenStore } from "@/store/screenStore";
import { getScreenDimensions, type Screen } from "@/types";
import { GRID_COLS, GRID_ROWS } from "@/lib/gridConstants";
import { WidgetRenderer } from "@/components/editor/WidgetRenderer";
import { DisplayModeContext } from "@/lib/displayMode";

export const Route = createFileRoute("/screens/$id/preview")({
  head: () => ({ meta: [{ title: "Display — Steward Display" }] }),
  component: DisplayPage,
});

function useFitScale(screen: Screen) {
  const dims = getScreenDimensions(screen);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      const sx = window.innerWidth / dims.w;
      const sy = window.innerHeight / dims.h;
      setScale(Math.min(sx, sy));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [dims.w, dims.h]);
  return { scale, dims };
}

function DisplayPage() {
  const { id } = Route.useParams();
  const hydrate = useScreenStore((s) => s.hydrate);
  const hydrated = useScreenStore((s) => s.hydrated);
  const screen = useScreenStore((s) => s.screens.find((x) => x.id === id));

  useEffect(() => hydrate(), [hydrate]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = "dark";
    document.body.style.overflow = "hidden";
    return () => {
      if (prev) document.documentElement.dataset.theme = prev;
      else delete document.documentElement.dataset.theme;
      document.body.style.overflow = "";
    };
  }, []);

  // A TV has nobody to click a link or read an error, so both states are a quiet branded slate.
  if (!hydrated) return <IdleSlate />;
  if (!screen) return <IdleSlate message="This screen isn't available on this device." />;

  return (
    <DisplayModeContext.Provider value={true}>
      <DisplayStage screen={screen} />
    </DisplayModeContext.Provider>
  );
}

function IdleSlate({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-navy text-white">
      <img src="/brand/steward-mark-light.svg" alt="" className="h-16 w-16 opacity-80" />
      {message && <p className="max-w-xl px-6 text-center text-2xl text-white/80">{message}</p>}
    </div>
  );
}

function DisplayStage({ screen }: { screen: Screen }) {
  const { scale, dims } = useFitScale(screen);
  const cellW = dims.w / GRID_COLS;
  const cellH = dims.h / GRID_ROWS;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center overflow-hidden"
      style={{
        backgroundColor: screen.backgroundColor,
        backgroundImage: screen.backgroundImage ? `url(${screen.backgroundImage})` : undefined,
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
          <img src="/brand/steward-mark-light.svg" alt="" className="h-4 w-4" />
          <span className="text-xs font-medium">Steward · Display</span>
        </div>
      )}
    </div>
  );
}
