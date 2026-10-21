import { useEffect, useState } from "react";
import { HardDriveUpload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { downloadJSON, exportScreensToJSON } from "@/lib/export";
import { STORAGE_KEYS, readJSON, writeJSON } from "@/lib/storage";
import { usePresetStore, type CustomPreset } from "@/store/presetStore";
import { useScreenStore } from "@/store/screenStore";
import type { Screen } from "@/types";

/**
 * Before there was a server, Display kept screens in each browser's local
 * storage. This offers to move them to the church's account, once.
 *
 * The local copy is kept under a backup key rather than deleted: an import
 * that half-worked should never be the only copy of somebody's Sunday screens.
 */
const IMPORTED_KEY = "steward.screens.importedAt";
const DISMISSED_KEY = "steward.screens.importDismissed";
const BACKUP_KEY = "steward.screens.backup";

const PRESETS_BACKUP_KEY = "steward.customPresets.backup";

function legacyPresets(): CustomPreset[] {
  const stored = readJSON<unknown>(STORAGE_KEYS.customPresets, []);
  return Array.isArray(stored) ? (stored as CustomPreset[]) : [];
}

function legacyScreens(): Screen[] {
  if (readJSON<string | null>(IMPORTED_KEY, null) || readJSON<boolean>(DISMISSED_KEY, false)) {
    return [];
  }
  const stored = readJSON<unknown>(STORAGE_KEYS.screens, []);
  return Array.isArray(stored) ? (stored as Screen[]) : [];
}

export function BrowserImportBanner() {
  const importScreens = useScreenStore((s) => s.importScreens);
  const createPreset = usePresetStore((s) => s.create);
  const [pending, setPending] = useState<Screen[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => setPending(legacyScreens()), []);

  if (pending.length === 0) return null;

  async function runImport() {
    setBusy(true);
    try {
      const { imported, failed } = await importScreens(pending);
      // Recorded the moment the server has them, so nothing can import them twice.
      writeJSON(BACKUP_KEY, pending);
      writeJSON(IMPORTED_KEY, new Date().toISOString());
      window.localStorage.removeItem(STORAGE_KEYS.screens);
      setPending([]);

      // Presets came from the same browser storage; bring them along.
      const presets = legacyPresets();
      for (const p of presets) {
        await createPreset(p.widgetType, p.label, p.config ?? {}, p.style, p.description, {
          quiet: true,
        });
      }
      if (presets.length > 0) {
        writeJSON(PRESETS_BACKUP_KEY, presets);
        window.localStorage.removeItem(STORAGE_KEYS.customPresets);
      }

      const summary = `Moved ${imported} screen${imported === 1 ? "" : "s"} to your church's account.`;
      if (failed.length > 0) {
        const left = pending.filter((s) => failed.includes(s.name));
        toast.warning(`${summary} Couldn't move: ${failed.join(", ")}.`, {
          duration: 20_000,
          action: {
            label: "Download them",
            onClick: () =>
              downloadJSON("steward-display-not-moved.json", exportScreensToJSON(left)),
          },
        });
      } else {
        toast.success(summary);
      }
    } catch (error) {
      toast.error(`Couldn't move the screens: ${errorMessage(error)}`);
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    writeJSON(DISMISSED_KEY, true);
    setPending([]);
  }

  const count = pending.length;
  return (
    <div
      role="region"
      aria-label="Screens saved in this browser"
      className="border-b border-gold/40 bg-warm-surface"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <HardDriveUpload className="h-5 w-5 shrink-0 text-navy" aria-hidden />
        <p className="min-w-0 flex-1 text-sm text-foreground">
          This browser has {count} screen{count === 1 ? "" : "s"} saved from before Display had
          accounts. Move {count === 1 ? "it" : "them"} to your church so every TV and teammate can
          use {count === 1 ? "it" : "them"}.
        </p>
        <Button size="sm" onClick={runImport} disabled={busy}>
          {busy ? "Moving…" : `Move ${count} screen${count === 1 ? "" : "s"}`}
        </Button>
        <button
          onClick={dismiss}
          aria-label="Don't ask again in this browser"
          className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
