import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
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
import { useScreenStore } from "@/store/screenStore";
import { useSettingsStore } from "@/store/settingsStore";
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import type { ScreenResolution } from "@/types";

export const Route = createFileRoute("/_admin/screens/new")({
  head: () => ({ meta: [{ title: "New screen — Steward Display" }] }),
  component: NewScreenPage,
});

function NewScreenPage() {
  const navigate = useNavigate();
  const create = useScreenStore((s) => s.createScreen);
  const defaultGridSize = useSettingsStore((s) => s.defaultGridSize);
  const defaultSnapStep = useSettingsStore((s) => s.defaultSnapStep);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [resolution, setResolution] = useState<ScreenResolution>("1920x1080");
  const [customWidth, setCustomWidth] = useState(1920);
  const [customHeight, setCustomHeight] = useState(1080);
  const [backgroundColor, setBackgroundColor] = useState("#0B1220");

  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Add a screen name to continue.");
      return;
    }
    setBusy(true);
    try {
      const s = await create({
        name: name.trim(),
        description: description.trim() || undefined,
        orientation,
        resolution,
        customWidth: resolution === "custom" ? customWidth : undefined,
        customHeight: resolution === "custom" ? customHeight : undefined,
        backgroundColor,
        gridSize: defaultGridSize,
        snapStep: defaultSnapStep,
      });
      toast.success("Screen created.");
      await navigate({ to: "/screens/$id/edit", params: { id: s.id } });
    } catch (error) {
      toast.error(`Couldn't create the screen: ${errorMessage(error)}`);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Button variant="ghost" size="sm" asChild className="mb-6 -ml-2">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" /> Back to screens
        </Link>
      </Button>

      <div className="rounded-xl border border-border bg-card p-8 shadow-steward-sm">
        <h1 className="text-h2 font-semibold">New screen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Give your screen a name and choose a display size.
        </p>

        <div className="mt-8 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Lobby screen"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="desc">Description (optional)</Label>
            <Textarea
              id="desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Orientation</Label>
              <Select
                value={orientation}
                onValueChange={(v) => setOrientation(v as "landscape" | "portrait")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">Landscape</SelectItem>
                  <SelectItem value="portrait">Portrait</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Resolution</Label>
              <Select
                value={resolution}
                onValueChange={(v) => setResolution(v as ScreenResolution)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1920x1080">1920 × 1080 (Full HD)</SelectItem>
                  <SelectItem value="1280x720">1280 × 720 (HD)</SelectItem>
                  <SelectItem value="3840x2160">3840 × 2160 (4K)</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {resolution === "custom" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Width</Label>
                <Input
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Height</Label>
                <Input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(Number(e.target.value))}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Background color</Label>
            <div className="flex gap-2">
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="h-9 w-12 cursor-pointer rounded-md border border-border bg-background"
                aria-label="Background color"
              />
              <Input
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-2">
          <Button variant="outline" asChild>
            <Link to="/">Cancel</Link>
          </Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Creating…" : "Create screen"}
          </Button>
        </div>
      </div>
    </main>
  );
}
