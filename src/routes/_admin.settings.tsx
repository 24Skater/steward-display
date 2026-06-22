import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
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
import { useSettingsStore } from "@/store/settingsStore";
import { useScreenStore } from "@/store/screenStore";
import {
  downloadJSON,
  exportScreensToJSON,
  parseImportedScreens,
  exportSettingsToJSON,
  parseImportedSettings,
} from "@/lib/export";
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

function SettingsPage() {
  const {
    orgName,
    timezone,
    defaultOrientation,
    defaultBackground,
    weatherApiKey,
    defaultGridSize,
    defaultSnapStep,
    update,
    resetGridDefaults,
  } = useSettingsStore();
  const screens = useScreenStore((s) => s.screens);
  const importScreens = useScreenStore((s) => s.importScreens);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const settingsFileRef = useRef<HTMLInputElement | null>(null);
  const [settingsWarnings, setSettingsWarnings] = useState<string[]>([]);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

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
    };
    downloadJSON(
      `steward-settings-${new Date().toISOString().slice(0, 10)}.json`,
      exportSettingsToJSON(current),
    );
    toast.success("Settings exported.");
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
    resetGridDefaults();
    toast.success("Grid defaults reset to safe values.");
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
        </div>
        <div className="pt-2">
          <Button variant="outline" size="sm" onClick={handleResetGridDefaults}>
            <RotateCcw className="h-4 w-4" /> Reset grid defaults
          </Button>
        </div>
      </Section>

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