import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, Upload, X, AlertTriangle, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/store/settingsStore";
import { useScreenStore } from "@/store/screenStore";
import {
  downloadJSON,
  exportScreensToJSON,
  parseImportedScreens,
  exportSettingsToJSON,
  parseImportedSettings,
  exportGridDefaultsToJSON,
  parseImportedGridDefaults,
} from "@/lib/export";
import { STORAGE_KEYS, readJSON, writeJSON } from "@/lib/storage";
import { toast } from "sonner";
import { ContrastAudit } from "@/components/settings/ContrastAudit";

export const Route = createFileRoute("/_admin/settings")({
  head: () => ({ meta: [{ title: "Settings — Steward Display" }] }),
  component: SettingsPage,
});

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-steward-sm">
      <h2 className="text-h3 font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

interface GridImportPreviewProps {
  filename: string;
  current: { defaultGridSize: number; defaultSnapStep: number; maxGridHistorySize: number };
  currentHistory: { defaultGridSize: number; defaultSnapStep: number; timestamp: number }[];
  imported: { defaultGridSize: number; defaultSnapStep: number; maxGridHistorySize: number };
  importedHistory: { defaultGridSize: number; defaultSnapStep: number; timestamp: number }[];
  warnings: string[];
}

function DiffValue({
  value,
  baseline,
  format,
}: {
  value: number;
  baseline: number;
  format: (n: number) => string;
}) {
  const changed = value !== baseline;
  return (
    <span className={changed ? "inline-flex items-center gap-1.5 font-medium text-foreground" : "inline-flex items-center gap-1.5 text-muted-foreground"}>
      {format(value)}
      {changed && (
        <span className="inline-flex items-center rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
          changed
        </span>
      )}
    </span>
  );
}

function SnapshotList({
  entries,
  empty,
}: {
  entries: { defaultGridSize: number; defaultSnapStep: number; timestamp: number }[];
  empty: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="max-h-32 overflow-y-auto rounded-md border border-border bg-background p-2 space-y-1 text-xs">
      {entries.map((entry, index) => (
        <li key={`${entry.timestamp}-${index}`} className="flex justify-between gap-3">
          <span>Grid {entry.defaultGridSize}, snap {entry.defaultSnapStep}</span>
          <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

function GridImportPreview({
  filename,
  current,
  currentHistory,
  imported,
  importedHistory,
  warnings,
}: GridImportPreviewProps) {
  const currentHistoryLength = currentHistory.length;
  const importedHistoryLength = importedHistory.length;
  const replaceHistoryCount = importedHistoryLength;
  const mergeHistoryCount = Math.min(1 + currentHistoryLength + importedHistoryLength, imported.maxGridHistorySize);

  const formatCell = (n: number) => `${n} cell${n === 1 ? "" : "s"}`;
  const formatCount = (n: number) => String(n);

  return (
    <div className="space-y-5">
      <p>
        <strong>{filename}</strong> contains {importedHistoryLength} snapshot
        {importedHistoryLength === 1 ? "" : "s"}.
      </p>

      {warnings.length > 0 && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <p className="font-medium">Import warnings</p>
          <ul className="list-disc pl-4">
            {warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <p className="text-sm font-medium mb-2">Field-by-field diff</p>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Field</th>
                <th className="px-3 py-2 text-left font-medium">Current</th>
                <th className="px-3 py-2 text-left font-medium">After replace</th>
                <th className="px-3 py-2 text-left font-medium">After merge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr>
                <td className="px-3 py-2">Default grid size</td>
                <td className="px-3 py-2 text-muted-foreground">{formatCell(current.defaultGridSize)}</td>
                <td className="px-3 py-2">
                  <DiffValue value={imported.defaultGridSize} baseline={current.defaultGridSize} format={formatCell} />
                </td>
                <td className="px-3 py-2">
                  <DiffValue value={current.defaultGridSize} baseline={current.defaultGridSize} format={formatCell} />
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">Default snap step</td>
                <td className="px-3 py-2 text-muted-foreground">{formatCell(current.defaultSnapStep)}</td>
                <td className="px-3 py-2">
                  <DiffValue value={imported.defaultSnapStep} baseline={current.defaultSnapStep} format={formatCell} />
                </td>
                <td className="px-3 py-2">
                  <DiffValue value={current.defaultSnapStep} baseline={current.defaultSnapStep} format={formatCell} />
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">Max undo snapshots</td>
                <td className="px-3 py-2 text-muted-foreground">{formatCount(current.maxGridHistorySize)}</td>
                <td className="px-3 py-2">
                  <DiffValue value={imported.maxGridHistorySize} baseline={current.maxGridHistorySize} format={formatCount} />
                </td>
                <td className="px-3 py-2">
                  <DiffValue value={imported.maxGridHistorySize} baseline={current.maxGridHistorySize} format={formatCount} />
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">Saved snapshots</td>
                <td className="px-3 py-2 text-muted-foreground">{formatCount(currentHistoryLength)}</td>
                <td className="px-3 py-2">
                  <DiffValue value={replaceHistoryCount} baseline={currentHistoryLength} format={formatCount} />
                </td>
                <td className="px-3 py-2">
                  <DiffValue value={mergeHistoryCount} baseline={currentHistoryLength} format={formatCount} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Undo history diff</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Current ({currentHistoryLength})</p>
            <SnapshotList entries={currentHistory} empty="No current snapshots" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Imported ({importedHistoryLength})</p>
            <SnapshotList entries={importedHistory} empty="No imported snapshots" />
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Choose <strong>Replace</strong> to overwrite your current grid defaults and history with the imported values, or <strong>Merge</strong> to keep your current defaults active and combine the imported snapshots into your history.
      </p>
    </div>
  );
}

function SettingsPage() {
  const {
    orgName,
    timezone,
    defaultOrientation,
    defaultBackground,
    weatherApiKey,
    defaultGridSize,
    defaultSnapStep,
    maxGridHistorySize,
    update,
    resetGridDefaults,
  } = useSettingsStore();
  const screens = useScreenStore((s) => s.screens);
  const importScreens = useScreenStore((s) => s.importScreens);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const settingsFileRef = useRef<HTMLInputElement | null>(null);
  const gridDefaultsFileRef = useRef<HTMLInputElement | null>(null);
  const [settingsWarnings, setSettingsWarnings] = useState<string[]>([]);
  const [gridDefaultsWarnings, setGridDefaultsWarnings] = useState<string[]>([]);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [clearHistoryDialogOpen, setClearHistoryDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingGridImport, setPendingGridImport] = useState<{
    gridDefaults: { defaultGridSize: number; defaultSnapStep: number; maxGridHistorySize: number };
    history: { defaultGridSize: number; defaultSnapStep: number; timestamp: number }[];
    warnings: string[];
    filename: string;
  } | null>(null);
  
  const [gridDefaultsHistory, setGridDefaultsHistory] = useState<
    { defaultGridSize: number; defaultSnapStep: number; timestamp: number }[]
  >(() => {
    const loaded = readJSON<unknown>(STORAGE_KEYS.gridDefaultsHistory, []);
    if (!Array.isArray(loaded)) return [];
    return loaded
      .filter((entry): entry is { defaultGridSize: number; defaultSnapStep: number; timestamp: number } => {
        if (!entry || typeof entry !== "object") return false;
        const e = entry as Record<string, unknown>;
        return (
          typeof e.defaultGridSize === "number" &&
          typeof e.defaultSnapStep === "number" &&
          typeof e.timestamp === "number"
        );
      })
      .slice(0, maxGridHistorySize);
  });

  useEffect(() => {
    writeJSON(STORAGE_KEYS.gridDefaultsHistory, gridDefaultsHistory);
  }, [gridDefaultsHistory]);

  useEffect(() => {
    setGridDefaultsHistory((history) => history.slice(0, maxGridHistorySize));
  }, [maxGridHistorySize]);

  const handleExport = () => {
    downloadJSON(`steward-display-${new Date().toISOString().slice(0, 10)}.json`, exportScreensToJSON(screens));
    toast.success("Backup downloaded.");
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const incoming = parseImportedScreens(text);
      importScreens(incoming);
      toast.success(`Imported ${incoming.length} screen${incoming.length === 1 ? "" : "s"}.`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't read that file.");
    }
  };

  const handleExportSettings = () => {
    const current = {
      orgName,
      timezone,
      theme: "light" as const,
      defaultOrientation,
      defaultBackground,
      weatherApiKey,
      defaultGridSize,
      defaultSnapStep,
      maxGridHistorySize,
    };
    downloadJSON(
      `steward-settings-${new Date().toISOString().slice(0, 10)}.json`,
      exportSettingsToJSON(current),
    );
    toast.success("Settings exported.");
  };

  const handleExportGridDefaults = () => {
    downloadJSON(
      `steward-grid-defaults-${new Date().toISOString().slice(0, 10)}.json`,
      exportGridDefaultsToJSON(
        { defaultGridSize, defaultSnapStep, maxGridHistorySize },
        gridDefaultsHistory,
      ),
    );
    toast.success("Grid defaults and history exported.");
  };

  const handleImportGridDefaults = async (file: File) => {
    try {
      setGridDefaultsWarnings([]);
      const text = await file.text();
      const { gridDefaults, history, warnings } = parseImportedGridDefaults(text);
      setPendingGridImport({ gridDefaults, history, warnings, filename: file.name });
      setImportDialogOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't read that file.");
    }
  };

  const confirmReplaceGridImport = () => {
    if (!pendingGridImport) return;
    const { gridDefaults, history, warnings } = pendingGridImport;
    update(gridDefaults);
    setGridDefaultsHistory(history.slice(0, gridDefaults.maxGridHistorySize));
    finishGridImport(warnings);
  };

  const confirmMergeGridImport = () => {
    if (!pendingGridImport) return;
    const { gridDefaults, history, warnings } = pendingGridImport;
    const mergedHistory = [
      { defaultGridSize: gridDefaults.defaultGridSize, defaultSnapStep: gridDefaults.defaultSnapStep, timestamp: Date.now() },
      ...gridDefaultsHistory,
      ...history,
    ].sort((a, b) => b.timestamp - a.timestamp);
    update({ maxGridHistorySize: gridDefaults.maxGridHistorySize });
    setGridDefaultsHistory(mergedHistory.slice(0, gridDefaults.maxGridHistorySize));
    finishGridImport(warnings);
  };

  const finishGridImport = (warnings: string[]) => {
    setImportDialogOpen(false);
    setPendingGridImport(null);
    if (warnings.length > 0) {
      setGridDefaultsWarnings(warnings);
    } else {
      toast.success("Grid defaults and history imported.");
    }
  };
  const handleImportSettings = async (file: File) => {
    try {
      setSettingsWarnings([]);
      const text = await file.text();
      const { settings: incoming, warnings } = parseImportedSettings(text);
      update(incoming);
      if (warnings.length > 0) {
        setSettingsWarnings(warnings);
      } else {
        toast.success("Settings imported.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't read that file.");
    }
  };

  const handleResetGridDefaults = () => {
    setResetDialogOpen(true);
  };

  const confirmResetGridDefaults = () => {
    const previous = { defaultGridSize, defaultSnapStep, timestamp: Date.now() };
    setGridDefaultsHistory((history) => [previous, ...history].slice(0, maxGridHistorySize));
    resetGridDefaults();
    setResetDialogOpen(false);
    toast.success("Grid defaults reset to safe values.", {
      action: {
        label: "Undo",
        onClick: () => {
          update({ defaultGridSize: previous.defaultGridSize, defaultSnapStep: previous.defaultSnapStep });
          toast.success("Previous grid defaults restored.");
        },
      },
    });
  };

  const handleClearHistory = () => {
    setClearHistoryDialogOpen(true);
  };

  const confirmClearHistory = () => {
    setGridDefaultsHistory([]);
    setClearHistoryDialogOpen(false);
    toast.success("Grid defaults history cleared.");
  };

  const revertGridDefaults = (entry: { defaultGridSize: number; defaultSnapStep: number }) => {
    const current = { defaultGridSize, defaultSnapStep, timestamp: Date.now() };
    setGridDefaultsHistory((history) => [current, ...history].slice(0, maxGridHistorySize));
    update({ defaultGridSize: entry.defaultGridSize, defaultSnapStep: entry.defaultSnapStep });
    toast.success("Grid defaults reverted to selected snapshot.");
  };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-6 py-10">
      <PageHeader title="Settings" subtitle="Configure your organization and defaults." />

      {settingsWarnings.length > 0 && (
        <Alert variant="destructive" className="relative">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Settings import warnings</AlertTitle>
          <AlertDescription>
            {settingsWarnings.map((warning, i) => (
              <p key={i}>{warning}</p>
            ))}
          </AlertDescription>
          <button
            onClick={() => setSettingsWarnings([])}
            className="absolute right-3 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </Alert>
      )}

      {gridDefaultsWarnings.length > 0 && (
        <Alert variant="destructive" className="relative">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Grid defaults import warnings</AlertTitle>
          <AlertDescription>
            {gridDefaultsWarnings.map((warning, i) => (
              <p key={i}>{warning}</p>
            ))}
          </AlertDescription>
          <button
            onClick={() => setGridDefaultsWarnings([])}
            className="absolute right-3 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </Alert>
      )}


      <Section title="Organization">
        <div className="space-y-1.5">
          <Label htmlFor="org">Name</Label>
          <Input id="org" value={orgName} onChange={(e) => update({ orgName: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tz">Timezone</Label>
          <Input id="tz" value={timezone} onChange={(e) => update({ timezone: e.target.value })} />
        </div>
      </Section>

      <Section title="Display defaults">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Default orientation</Label>
            <Select value={defaultOrientation} onValueChange={(v) => update({ defaultOrientation: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="landscape">Landscape</SelectItem>
                <SelectItem value="portrait">Portrait</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Default background</Label>
            <Input value={defaultBackground} onChange={(e) => update({ defaultBackground: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Default grid size (cells)</Label>
            <Select value={String(defaultGridSize)} onValueChange={(v) => update({ defaultGridSize: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 4, 6, 8, 12, 16].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} cells</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Default snap step (cells)</Label>
            <Select value={String(defaultSnapStep)} onValueChange={(v) => update({ defaultSnapStep: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 4, 6, 8, 12, 16].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} cells</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxGridHistorySize">Max undo snapshots</Label>
            <Input
              id="maxGridHistorySize"
              type="number"
              min={1}
              max={100}
              value={maxGridHistorySize}
              onChange={(e) => {
                const value = Math.max(1, Math.min(100, Number(e.target.value) || 1));
                update({ maxGridHistorySize: value });
              }}
            />
          </div>
        </div>
        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={handleResetGridDefaults}>
            <RotateCcw className="h-4 w-4" /> Reset grid defaults
          </Button>
        </div>

        <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset grid defaults?</AlertDialogTitle>
              <AlertDialogDescription>
                This will restore <strong>Default grid size</strong> to 1 cell and <strong>Default snap step</strong> to 4 cells, and overwrite your saved settings. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmResetGridDefaults}>Reset</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Section>

      {gridDefaultsHistory.length > 0 && (
        <Section title="Grid defaults history" description="Revert to previous grid default snapshots from this session.">
          <div className="space-y-3">
            {gridDefaultsHistory.map((entry, index) => (
              <div
                key={`${entry.timestamp}-${index}`}
                className="flex items-center justify-between rounded-lg border border-border bg-background p-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    Grid size {entry.defaultGridSize}, snap step {entry.defaultSnapStep}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => revertGridDefaults(entry)}
                >
                  Revert
                </Button>
              </div>
            ))}
          </div>
          <div className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleClearHistory}
            >
              Clear history
            </Button>
          </div>

          <AlertDialog open={clearHistoryDialogOpen} onOpenChange={setClearHistoryDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear grid defaults history?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove all saved grid default snapshots from the history panel and localStorage. You won't be able to revert to them afterward.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmClearHistory}>Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Section>
      )}

      <Section title="Data sources" description="Connect external services. Wiring lands in a future release.">
        <div className="space-y-1.5">
          <Label htmlFor="weather">OpenWeatherMap API key</Label>
          <Input id="weather" value={weatherApiKey ?? ""} onChange={(e) => update({ weatherApiKey: e.target.value })} placeholder="Optional" />
        </div>
      </Section>

      <Section title="Export & import" description="Back up screens as JSON, or restore from a previous export.">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleExport}><Download className="h-4 w-4" /> Export screens</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> Import screens</Button>
          <Button variant="outline" onClick={handleExportSettings}><Download className="h-4 w-4" /> Export settings</Button>
          <Button variant="outline" onClick={handleExportGridDefaults}><Download className="h-4 w-4" /> Export grid defaults</Button>
          <Button variant="outline" onClick={() => gridDefaultsFileRef.current?.click()}><Upload className="h-4 w-4" /> Import grid defaults</Button>
          <Button variant="outline" onClick={() => settingsFileRef.current?.click()}><Upload className="h-4 w-4" /> Import settings</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = "";
            }}
          />
          <input
            ref={settingsFileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportSettings(f);
              e.target.value = "";
            }}
          />
          <input
            ref={gridDefaultsFileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportGridDefaults(f);
              e.target.value = "";
            }}
          />

          <AlertDialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) setPendingGridImport(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Import grid defaults</AlertDialogTitle>
                <AlertDialogDescription>
                  Review the changes below before choosing how to apply the import.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {pendingGridImport ? (
                <GridImportPreview
                  filename={pendingGridImport.filename}
                  current={{ defaultGridSize, defaultSnapStep, maxGridHistorySize }}
                  currentHistory={gridDefaultsHistory}
                  imported={pendingGridImport.gridDefaults}
                  importedHistory={pendingGridImport.history}
                  warnings={pendingGridImport.warnings}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No import is currently pending.</p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmMergeGridImport}>Merge</AlertDialogAction>
                <AlertDialogAction onClick={confirmReplaceGridImport}>Replace</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Section>

      <Section title="About">
        <p className="text-sm text-muted-foreground">
          Steward Display · MIT licensed open source · part of the Steward ecosystem.
        </p>
        <a
          href="https://github.com/24Skater/steward-brand"
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-sm font-medium text-blue hover:underline"
        >
          View brand guide on GitHub →
        </a>
      </Section>

      <Section
        title="Accessibility · Brand contrast audit"
        description="Live WCAG 2.1 contrast check for every brand token pairing. Run on every build; failures also log to the dev console."
      >
        <ContrastAudit />
      </Section>
    </main>
  );
}
