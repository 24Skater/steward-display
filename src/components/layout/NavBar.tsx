import { Link, useRouterState } from "@tanstack/react-router";
import { Moon, Plus, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settingsStore";
import { useEffect } from "react";

const NAV = [
  { to: "/", label: "Screens" },
  { to: "/widgets", label: "Widgets" },
  { to: "/settings", label: "Settings" },
] as const;

export function NavBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const theme = useSettingsStore((s) => s.theme);
  const update = useSettingsStore((s) => s.update);
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-navy px-6 text-white shadow-steward-sm">
      <Link to="/" className="flex items-center gap-3" aria-label="Steward Display home">
        <img
          src="https://raw.githubusercontent.com/24Skater/steward-brand/main/assets/logo/steward-mark-light.svg"
          alt=""
          className="h-7 w-7"
        />
        <span className="text-sm font-semibold tracking-tight">
          Steward <span className="opacity-60">·</span> Display
        </span>
      </Link>

      <nav className="hidden items-center gap-1 md:flex">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              isActive(item.to)
                ? "bg-white/10 text-white"
                : "text-white/70 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <button
          aria-label="Toggle theme"
          onClick={() => update({ theme: theme === "dark" ? "light" : "dark" })}
          className="flex h-9 w-9 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <Button asChild size="sm">
          <Link to="/screens/new">
            <Plus className="h-4 w-4" />
            Add screen
          </Link>
        </Button>
      </div>
    </header>
  );
}