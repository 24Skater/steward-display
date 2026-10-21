import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/auth/AuthCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { claimPairingFn } from "@/lib/api/devices.functions";
import { errorMessage } from "@/lib/errors";
import type { Screen } from "@/types";
import { ScreenSelect } from "./ScreenSelect";

interface PairTvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  screens: Screen[];
  onPaired: () => void;
}

export function PairTvDialog({ open, onOpenChange, screens, onPaired }: PairTvDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [screenId, setScreenId] = useState<string | null>(screens[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState(false);

  // Screens may still be loading when the page opens. Until the person picks
  // something themselves, default to the first screen rather than to standby.
  useEffect(() => {
    if (open && !picked && screenId === null && screens.length > 0) setScreenId(screens[0].id);
  }, [open, picked, screenId, screens]);

  function reset() {
    setCode("");
    setName("");
    setError(null);
    setPicked(false);
    setScreenId(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await claimPairingFn({ data: { code, name, screenId } });
      toast.success(`Paired "${name}". The TV switches over in a few seconds.`);
      reset();
      onOpenChange(false);
      onPaired();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle>Pair a TV</DialogTitle>
            <DialogDescription>
              On the TV, open this site's <span className="font-mono">/tv</span> page. Type the
              six-character code it shows.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pair-code">Code on the TV</Label>
              <Input
                id="pair-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 9))}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                placeholder="K7M4QX"
                className="font-mono text-lg tracking-[0.3em]"
                aria-describedby={error ? "pair-error" : undefined}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pair-name">Name this TV</Label>
              <Input
                id="pair-name"
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lobby, left of the doors"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pair-screen">What it shows</Label>
              <ScreenSelect
                id="pair-screen"
                screens={screens}
                value={screenId}
                onChange={(id) => {
                  setPicked(true);
                  setScreenId(id);
                }}
              />
            </div>
            <FormError id="pair-error" message={error} />
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={busy || code.replace(/[^0-9A-Z]/g, "").length < 6 || !name.trim()}
            >
              {busy ? "Pairing…" : "Pair TV"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
