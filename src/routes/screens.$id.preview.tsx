import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

import { DisplayStage, IdleSlate, useDisplayChrome } from "@/components/display/DisplayStage";
import { requireSignedIn } from "@/lib/viewer";
import { useScreenStore } from "@/store/screenStore";

/** The editor's full-screen preview. A paired TV uses /tv instead. */
export const Route = createFileRoute("/screens/$id/preview")({
  beforeLoad: ({ location }) => requireSignedIn(location.href),
  head: () => ({ meta: [{ title: "Preview — Steward Display" }] }),
  component: PreviewPage,
});

function PreviewPage() {
  const { id } = Route.useParams();
  const hydrate = useScreenStore((s) => s.hydrate);
  const hydrated = useScreenStore((s) => s.hydrated);
  const screen = useScreenStore((s) => s.screens.find((x) => x.id === id));

  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useDisplayChrome();

  if (!hydrated) return <IdleSlate />;
  if (!screen)
    return <IdleSlate message="This screen was deleted, or belongs to another church." />;
  return <DisplayStage screen={screen} />;
}
