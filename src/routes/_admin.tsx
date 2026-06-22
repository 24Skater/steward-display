import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { NavBar } from "@/components/layout/NavBar";
import { useScreenStore } from "@/store/screenStore";
import { usePresetStore } from "@/store/presetStore";

export const Route = createFileRoute("/_admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const hydrate = useScreenStore((s) => s.hydrate);
  const hydratePresets = usePresetStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
    hydratePresets();
  }, [hydrate, hydratePresets]);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <NavBar />
      <Outlet />
    </div>
  );
}