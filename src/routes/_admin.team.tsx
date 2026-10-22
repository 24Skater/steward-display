import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Copy, MailCheck, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/auth/AuthCard";
import { PageHeader } from "@/components/layout/PageHeader";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  changeRoleFn,
  getTeamFn,
  inviteFn,
  removeMemberFn,
  revokeInvitationFn,
} from "@/lib/api/team.functions";
import { errorMessage } from "@/lib/errors";
import type { PendingInvitation, TeamMember } from "@/server/team";

export const Route = createFileRoute("/_admin/team")({
  head: () => ({ meta: [{ title: "Team — Steward Display" }] }),
  component: TeamPage,
});

type Role = "OWNER" | "EDITOR";

interface TeamState {
  members: TeamMember[];
  invitations: PendingInvitation[];
  canEmail: boolean;
  isOwner: boolean;
  me: string;
}

const ROLE_HELP: Record<Role, string> = {
  OWNER: "Everything, including the team and the church's name",
  EDITOR: "Screens, presets and TVs",
};

function TeamPage() {
  const [team, setTeam] = useState<TeamState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [demotingSelf, setDemotingSelf] = useState<TeamMember | null>(null);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      setTeam(await getTeamFn());
      setLoadError(null);
    } catch (error) {
      setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      toast.success(success);
      await refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function setRole(member: TeamMember, role: Role) {
    setSavingRole(member.membershipId);
    await run(
      () => changeRoleFn({ data: { membershipId: member.membershipId, role } }),
      member.userId === team?.me
        ? "You're now an editor."
        : `${member.name} is now ${role === "OWNER" ? "an owner" : "an editor"}.`,
    );
    setSavingRole(null);
    // Your own role changed: the rest of the app has to see it straight away.
    if (member.userId === team?.me) await router.invalidate();
  }

  function onRoleChange(member: TeamMember, role: Role) {
    if (role === member.role) return;
    // Stepping down cannot be undone by yourself, so it is asked, not assumed.
    if (member.userId === team?.me && role !== "OWNER") setDemotingSelf(member);
    else void setRole(member, role);
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <PageHeader
        title="Team"
        subtitle="Everyone who can build screens and look after the TVs."
        actions={
          team?.isOwner ? (
            <Button onClick={() => setInviting(true)}>
              <UserPlus className="h-4 w-4" /> Invite someone
            </Button>
          ) : undefined
        }
      />

      {loadError && (
        <p
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          Couldn't load the team: {loadError}
        </p>
      )}

      {!team && !loadError && (
        <div className="space-y-3" aria-busy="true" aria-label="Loading team">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {team && (
        <>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card shadow-steward-sm">
            {team.members.map((member) => (
              <li key={member.membershipId} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {member.name}
                    {member.userId === team.me && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>
                    )}
                  </p>
                  <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                    {member.email}
                    {member.emailVerified && (
                      <MailCheck
                        className="h-3.5 w-3.5 text-emerald"
                        aria-label="Email confirmed"
                      />
                    )}
                  </p>
                </div>
                {team.isOwner ? (
                  <select
                    aria-label={`Role for ${member.name}`}
                    value={member.role}
                    disabled={savingRole === member.membershipId}
                    onChange={(e) => onRoleChange(member, e.target.value as Role)}
                    className="h-11 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  >
                    <option value="OWNER">Owner</option>
                    <option value="EDITOR">Editor</option>
                  </select>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {member.role === "OWNER" ? "Owner" : "Editor"}
                  </span>
                )}
                {team.isOwner && member.userId !== team.me && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-destructive"
                    aria-label={`Remove ${member.name}`}
                    onClick={() => setRemoving(member)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>

          {team.invitations.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-h3 font-semibold">Waiting to accept</h2>
              <ul className="divide-y divide-border rounded-xl border border-dashed border-border bg-card">
                {team.invitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-foreground">{invitation.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {invitation.role === "OWNER" ? "Owner" : "Editor"} · link expires{" "}
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    {team.isOwner && (
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          try {
                            const { revoked } = await revokeInvitationFn({
                              data: { id: invitation.id },
                            });
                            if (revoked)
                              toast.success(`Cancelled the invitation for ${invitation.email}.`);
                            else
                              toast.info(`${invitation.email} accepted before it was cancelled.`);
                            await refresh();
                          } catch (error) {
                            toast.error(errorMessage(error));
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <dl className="mt-8 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {(Object.keys(ROLE_HELP) as Role[]).map((role) => (
              <div key={role}>
                <dt className="inline font-medium text-foreground">
                  {role === "OWNER" ? "Owners" : "Editors"}:
                </dt>{" "}
                <dd className="inline">{ROLE_HELP[role]}</dd>
              </div>
            ))}
          </dl>

          <InviteDialog
            open={inviting}
            onOpenChange={setInviting}
            canEmail={team.canEmail}
            onInvited={() => void refresh()}
          />
        </>
      )}

      <AlertDialog open={!!demotingSelf} onOpenChange={(open) => !open && setDemotingSelf(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Step down to editor?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll no longer be able to manage the team or rename the church. Only another owner
              can make you an owner again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay an owner</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const me = demotingSelf;
                setDemotingSelf(null);
                if (me) void setRole(me, "EDITOR");
              }}
            >
              Step down
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name} from the team?</AlertDialogTitle>
            <AlertDialogDescription>
              They're signed out here straight away. Their account stays, so you can invite them
              back any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const member = removing;
                setRemoving(null);
                if (member) {
                  void run(
                    () => removeMemberFn({ data: { membershipId: member.membershipId } }),
                    `Removed ${member.name}.`,
                  );
                }
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEmail: boolean;
  onInvited: () => void;
}

function InviteDialog({ open, onOpenChange, canEmail, onInvited }: InviteDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("EDITOR");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ link: string | null; emailed: boolean } | null>(null);
  // Bumped whenever the dialog closes, so a request still in flight cannot
  // land its result in the next, unrelated invitation.
  const generation = useRef(0);

  function close(next: boolean) {
    if (!next) {
      generation.current++;
      setEmail("");
      setRole("EDITOR");
      setError(null);
      setResult(null);
    }
    onOpenChange(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const mine = generation.current;
    try {
      const invited = await inviteFn({ data: { email, role } });
      if (mine !== generation.current) return;
      setResult(invited);
      onInvited();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it yourself.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>{result.link ? "Send them this link" : "Invitation sent"}</DialogTitle>
              <DialogDescription>
                {result.link
                  ? "This server couldn't email it, so pass this link on yourself: a text message works. It works once, for seven days."
                  : `We emailed ${email} a link to join. It works once, for seven days. Nothing arriving? Cancel and invite again.`}
              </DialogDescription>
            </DialogHeader>
            {result.link && (
              <div className="mt-4 flex gap-2">
                <Input
                  readOnly
                  value={result.link}
                  aria-label="Invitation link"
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  onClick={() => void copy(result.link!)}
                  aria-label="Copy link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )}
            <DialogFooter className="mt-6">
              <Button onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <DialogHeader>
              <DialogTitle>Invite someone</DialogTitle>
              <DialogDescription>
                {canEmail
                  ? "They'll get an email with a link to join."
                  : "If this server can't email them, you'll get a link to send them yourself."}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Their email</Label>
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-describedby={error ? "invite-error" : undefined}
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Role</legend>
                {(Object.keys(ROLE_HELP) as Role[]).map((value) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted"
                  >
                    <input
                      type="radio"
                      name="invite-role"
                      value={value}
                      checked={role === value}
                      onChange={() => setRole(value)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-medium">
                        {value === "OWNER" ? "Owner" : "Editor"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {ROLE_HELP[value]}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <FormError id="invite-error" message={error} />
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !email.trim()}>
                {busy ? "Inviting…" : "Invite"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
