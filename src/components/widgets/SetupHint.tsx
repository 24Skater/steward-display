import type { ReactNode } from "react";
import { useIsDisplay } from "@/lib/displayMode";

/** Setup copy for an unconfigured widget. Shown in the editor; renders nothing on the TV. */
export function SetupHint({ children }: { children: ReactNode }) {
  if (useIsDisplay()) return null;
  return (
    <div className="flex h-full w-full items-center justify-center p-2 text-center opacity-60">
      {children}
    </div>
  );
}
