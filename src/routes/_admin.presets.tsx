import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Trash2, Sparkles, Search, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { EmptyState } from "@/components/layout/EmptyState";
import { usePresetStore, type CustomPreset } from "@/store/presetStore";
import { getWidgetDefinition, WIDGET_DEFINITIONS } from "@/lib/widgetRegistry";
import type { WidgetType } from "@/types";
import { toast } from "sonner";

export const Route = createFileRoute("/_admin/presets")({
  head: () => ({ meta: [{ title: "Presets — Steward Display" }] }),
  component: PresetsPage,
});

function PresetsPage() {
  const presets = usePresetStore((s) => s.presets);
  const updatePreset = usePresetStore((s) => s.update);
  const removePreset = usePresetStore((s) => s.remove);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | "all">("all");
  const [editing, setEditing] = useState<CustomPreset | null>(null);
  const [deleting, setDeleting] = useState<CustomPreset | null>(null);

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    for (const p of presets) types.add(p.widgetType);
    return [...types].sort((a, b) => a.localeCompare(b));
  }, [presets]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = presets;
    if (typeFilter !== "all") {
      filtered = filtered.filter((p) => p.widgetType === typeFilter);
    }
    if (q) {
      filtered = filtered.filter(
        (p) =>
          p.label.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          p.widgetType.toLowerCase().includes(q),
      );
    }
    const map = new Map<string, CustomPreset[]>();
    for (const p of filtered) {
      const list = map.get(p.widgetType) ?? [];
      list.push(p);
      map.set(p.widgetType, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [presets, query, typeFilter]);

  const activeFilters = query.trim() || typeFilter !== "all";


  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-10">
      <PageHeader
        title="Widget presets"
        subtitle="Manage saved configurations. Presets stay scoped to the widget type they were saved from — edit and delete them all here."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search presets…"
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as string | "all")}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue placeholder="All widget types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All widget types</SelectItem>
            {availableTypes.map((type) => {
              const def = getWidgetDefinition(type as WidgetType);
              return (
                <SelectItem key={type} value={type}>
                  {def?.label ?? type}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {activeFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setTypeFilter("all");
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear filters
          </Button>
        )}
      </div>

      {presets.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No saved presets yet"
          body="Open a screen, select a widget, then click ‘Save current’ in its settings panel to capture a preset."
        />
      ) : grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">No presets match your filters.</p>
      ) : (

        <div className="space-y-6">
          {grouped.map(([type, list]) => {
            const def = getWidgetDefinition(type as WidgetType);
            const Icon = def?.icon ?? Sparkles;
            return (
              <section
                key={type}
                className="rounded-xl border border-border bg-card shadow-steward-sm"
              >
                <header className="flex items-center gap-3 border-b border-border px-5 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-blue">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{def?.label ?? type}</p>
                    <p className="text-xs text-muted-foreground">
                      {list.length} preset{list.length === 1 ? "" : "s"}
                    </p>
                  </div>
                </header>
                <ul className="divide-y divide-border">
                  {list.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.label}</p>
                        {p.description && (
                          <p className="truncate text-xs text-muted-foreground">{p.description}</p>
                        )}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Saved {new Date(p.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditing(p)}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleting(p)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <EditDialog
        preset={editing}
        onClose={() => setEditing(null)}
        onSave={(label, description) => {
          if (!editing) return;
          updatePreset(editing.id, { label, description: description || undefined });
          setEditing(null);
          toast.success("Preset updated.");
        }}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this preset?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleting?.label}” will be removed from your saved presets. Widgets already using its
              settings keep them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleting) {
                  removePreset(deleting.id);
                  toast.success("Preset deleted.");
                }
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function EditDialog({
  preset,
  onClose,
  onSave,
}: {
  preset: CustomPreset | null;
  onClose: () => void;
  onSave: (label: string, description: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");

  return (
    <Dialog
      open={preset !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
        else if (preset) {
          setLabel(preset.label);
          setDescription(preset.description ?? "");
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit preset</DialogTitle>
          <DialogDescription>Rename this preset or update its description.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-label" className="text-xs font-medium">Name</Label>
            <Input
              id="edit-label"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc" className="text-xs font-medium">Description</Label>
            <Textarea
              id="edit-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!label.trim()} onClick={() => onSave(label.trim(), description.trim())}>
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}