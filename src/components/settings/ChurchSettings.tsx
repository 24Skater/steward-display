import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getOrgSettingsFn, updateOrgSettingsFn } from "@/lib/api/content.functions";
import { errorMessage } from "@/lib/errors";

interface ChurchSettingsProps {
  isOwner: boolean;
}

function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["UTC"];
  }
}

/**
 * The settings every TV at the church shares. Saved to the server, unlike the
 * editor preferences below them, which belong to this browser.
 */
export function ChurchSettings({ isOwner }: ChurchSettingsProps) {
  const zones = useMemo(timeZones, []);
  const [churchName, setChurchName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getOrgSettingsFn()
      .then((settings) => {
        setChurchName(settings.churchName);
        setTimezone(settings.timezone);
        setLoaded(true);
      })
      .catch((error: unknown) =>
        toast.error(`Couldn't load church settings: ${errorMessage(error)}`),
      );
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await updateOrgSettingsFn({ data: isOwner ? { churchName, timezone } : { timezone } });
      toast.success("Church settings saved. TVs pick them up within a minute.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <p className="text-sm text-muted-foreground">Loading church settings…</p>;
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="church-name">Church name</Label>
        <Input
          id="church-name"
          value={churchName}
          maxLength={120}
          disabled={!isOwner}
          onChange={(e) => setChurchName(e.target.value)}
          aria-describedby={isOwner ? undefined : "church-name-hint"}
        />
        {!isOwner && (
          <p id="church-name-hint" className="text-xs text-muted-foreground">
            Only the church's owner can rename it.
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="church-tz">Time zone</Label>
        <select
          id="church-tz"
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {zones.includes(timezone) ? null : <option value={timezone}>{timezone}</option>}
          {zones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Clocks and countdowns on every TV use this.</p>
      </div>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save church settings"}
      </Button>
    </form>
  );
}
