import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { Pencil, Plus, Trash2, Tv } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PairTvDialog } from "@/components/tvs/PairTvDialog";
import { ScreenSelect } from "@/components/tvs/ScreenSelect";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listDevicesFn, removeDeviceFn, updateDeviceFn } from "@/lib/api/devices.functions";
import { errorMessage } from "@/lib/errors";
import type { DeviceSummary } from "@/server/devices";
import { useScreenStore } from "@/store/screenStore";

export const Route = createFileRoute("/_admin/tvs")({
  head: () => ({ meta: [{ title: "TVs — Steward Display" }] }),
  component: TvsPage,
});

/** How often the list refreshes, so "online" stays honest while the page is open. */
const REFRESH_MS = 15_000;

function TvsPage() {
  const screens = useScreenStore((s) => s.screens);
  const [devices, setDevices] = useState<DeviceSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pairing, setPairing] = useState(false);
  const [removing, setRemoving] = useState<DeviceSummary | null>(null);

  const refresh = useCallback(async () => {
    try {
      setDevices(await listDevicesFn());
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  async function update(device: DeviceSummary, patch: { name?: string; screenId?: string | null }) {
    try {
      await updateDeviceFn({ data: { id: device.id, ...patch } });
      await refresh();
      if (patch.screenId !== undefined)
        toast.success(`"${device.name}" switches over within a minute.`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function remove(device: DeviceSummary) {
    try {
      await removeDeviceFn({ data: { id: device.id } });
      toast.success(`Unpaired "${device.name}". It shows a new pairing code.`);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const pairButton = (
    <Button onClick={() => setPairing(true)}>
      <Plus className="h-4 w-4" /> Pair a TV
    </Button>
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="TVs"
        subtitle="Each TV shows one screen, and keeps showing it if the internet drops."
        actions={devices && devices.length > 0 ? pairButton : undefined}
      />

      {loadError && (
        <p
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Couldn't load your TVs: {loadError}
        </p>
      )}

      {devices === null && !loadError && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading TVs">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {devices?.length === 0 && (
        <EmptyState
          icon={Tv}
          title="No TVs yet"
          body="On the TV's browser, open this site's /tv page. It shows a six-character code. Pair a TV and type that code."
          action={pairButton}
        />
      )}

      {devices && devices.length > 0 && (
        <ul className="space-y-3">
          {devices.map((device) => (
            <li
              key={device.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-steward-sm"
            >
              <Status device={device} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{device.name}</p>
                <p className="text-xs text-muted-foreground">
                  {device.awaitingTv
                    ? "Waiting for the TV to finish pairing"
                    : device.lastSeenAt
                      ? `Last checked in ${formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true })}`
                      : "Never checked in"}
                </p>
              </div>
              <div className="w-full sm:w-64">
                <ScreenSelect
                  id={`screen-${device.id}`}
                  aria-label={`Screen shown on ${device.name}`}
                  screens={screens}
                  value={device.screenId}
                  onChange={(screenId) => void update(device, { screenId })}
                />
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11"
                  aria-label={`Rename ${device.name}`}
                  onClick={() => {
                    const name = window.prompt("Name this TV", device.name)?.trim();
                    if (name && name !== device.name) void update(device, { name });
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 text-destructive"
                  aria-label={`Unpair ${device.name}`}
                  onClick={() => setRemoving(device)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PairTvDialog
        open={pairing}
        onOpenChange={setPairing}
        screens={screens}
        onPaired={() => void refresh()}
      />

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unpair "{removing?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The TV stops showing your screen at its next check-in and shows a new pairing code.
              Pair it again any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (removing) void remove(removing);
                setRemoving(null);
              }}
            >
              Unpair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function Status({ device }: { device: DeviceSummary }) {
  const [label, tone] = device.awaitingTv
    ? ["Pairing", "bg-amber"]
    : device.online
      ? ["Online", "bg-emerald"]
      : ["Offline", "bg-muted-foreground"];
  return (
    <span className="flex w-20 items-center gap-2 text-xs font-medium text-foreground">
      <span className={`h-2.5 w-2.5 rounded-full ${tone}`} aria-hidden />
      {label}
    </span>
  );
}
