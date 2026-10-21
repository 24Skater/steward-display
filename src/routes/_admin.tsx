import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

import { NavBar } from "@/components/layout/NavBar";
import { BrowserImportBanner } from "@/components/screens/BrowserImportBanner";
import { requireSignedIn } from "@/lib/viewer";
import { hasUnsavedScreens, useScreenStore } from "@/store/screenStore";
import { usePresetStore } from "@/store/presetStore";

export const Route = createFileRoute("/_admin")({
  beforeLoad: ({ location }) => requireSignedIn(location.href),
  component: AdminLayout,
});

function AdminLayout() {
  const hydrate = useScreenStore((s) => s.hydrate);
  const hydratePresets = usePresetStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
    void hydratePresets();
  }, [hydrate, hydratePresets]);

  // A save waits a moment after the last change; don't let a closed tab eat it.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (hasUnsavedScreens()) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <NavBar />
      <BrowserImportBanner />
      <Outlet />
    </div>
  );
}
