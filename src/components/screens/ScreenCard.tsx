import { Link, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Copy, Trash2, Pencil, Play } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScreenThumbnail } from "./ScreenThumbnail";
import type { Screen } from "@/types";
import { useScreenStore } from "@/store/screenStore";
import { useState } from "react";
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
import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";

function relTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ScreenCard({ screen }: { screen: Screen }) {
  const navigate = useNavigate();
  const duplicate = useScreenStore((s) => s.duplicateScreen);
  const remove = useScreenStore((s) => s.deleteScreen);
  const [confirm, setConfirm] = useState(false);

  return (
    <>
      <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-steward-sm transition-all hover:-translate-y-0.5 hover:shadow-steward-md">
        <Link
          to="/screens/$id/edit"
          params={{ id: screen.id }}
          className="block focus:outline-none"
          aria-label={`Edit ${screen.name}`}
        >
          <div className="border-b border-border">
            <ScreenThumbnail screen={screen} />
          </div>
        </Link>

        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-h3 font-medium text-foreground">{screen.name}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="font-normal">
                {screen.resolution === "custom"
                  ? `${screen.customWidth ?? 1920}×${screen.customHeight ?? 1080}`
                  : screen.resolution}
              </Badge>
              <span>·</span>
              <span>
                {screen.widgets.length} widget{screen.widgets.length === 1 ? "" : "s"}
              </span>
              <span>·</span>
              <span>{relTime(screen.updatedAt)}</span>
              {screen.schedule?.enabled && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald" />
                    Scheduled
                  </span>
                </>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Screen options"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => navigate({ to: "/screens/$id/edit", params: { id: screen.id } })}
              >
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => window.open(`/screens/${screen.id}/preview`, "_blank")}
              >
                <Play className="mr-2 h-4 w-4" /> Preview
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  duplicate(screen.id)
                    .then((copy) => copy && toast.success("Screen duplicated."))
                    .catch((error: unknown) => toast.error(errorMessage(error)));
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setConfirm(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this screen?</AlertDialogTitle>
            <AlertDialogDescription>
              "{screen.name}" and its widgets will be deleted for everyone at your church. Any TV
              showing it goes to standby.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                remove(screen.id)
                  .then(() => toast.success("Screen deleted."))
                  .catch((error: unknown) => toast.error(errorMessage(error)));
              }}
            >
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
