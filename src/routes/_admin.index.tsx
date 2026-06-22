import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MonitorPlay, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/layout/EmptyState";
import { ScreenCard } from "@/components/screens/ScreenCard";
import { useScreenStore } from "@/store/screenStore";

export const Route = createFileRoute("/_admin/")({
  head: () => ({
    meta: [
      { title: "Screens — Steward Display" },
      { name: "description", content: "Manage your display configurations." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const screens = useScreenStore((s) => s.screens);
  const hydrated = useScreenStore((s) => s.hydrated);
  const [q, setQ] = useState("");
  const [orientation, setOrientation] = useState<string>("all");
  const [sort, setSort] = useState<string>("updated");

  const list = useMemo(() => {
    let r = screens.filter((s) => (orientation === "all" ? true : s.orientation === orientation));
    if (q) r = r.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
    r = [...r].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return r;
  }, [screens, q, orientation, sort]);

  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-10">
      <PageHeader
        title="Screens"
        subtitle="Manage your display configurations."
        actions={
          <Button asChild>
            <Link to="/screens/new">
              <Plus className="h-4 w-4" /> Add screen
            </Link>
          </Button>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search screens"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={orientation} onValueChange={setOrientation}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Orientation" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All orientations</SelectItem>
            <SelectItem value="landscape">Landscape</SelectItem>
            <SelectItem value="portrait">Portrait</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Last modified</SelectItem>
            <SelectItem value="created">Date created</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {!hydrated ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={MonitorPlay}
          title="No screens yet"
          body="Create one to get started."
          action={
            <Button asChild>
              <Link to="/screens/new"><Plus className="h-4 w-4" /> Create your first screen</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((s) => (
            <ScreenCard key={s.id} screen={s} />
          ))}
        </div>
      )}
    </main>
  );
}