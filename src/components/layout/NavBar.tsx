import { Link, useRouterState } from "@tanstack/react-router";
import { CircleUser, Menu, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSettingsStore } from "@/store/settingsStore";

const NAV = [
  { to: "/", label: "Screens" },
  { to: "/tvs", label: "TVs" },
  { to: "/widgets", label: "Widgets" },
  { to: "/presets", label: "Presets" },
  { to: "/settings", label: "Settings" },
] as const;

const ICON_BUTTON =
  "flex h-11 w-11 items-center justify-center rounded-md text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60";

export function NavBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const theme = useSettingsStore((s) => s.theme);
  const update = useSettingsStore((s) => s.update);
  const hydrate = useSettingsStore((s) => s.hydrate);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-navy px-4 text-white shadow-steward-sm sm:px-6">
      <Link to="/" className="flex items-center gap-3" aria-label="Steward Display home">
        <img src="/brand/steward-mark.svg" alt="" className="h-7 w-7" />
        <span className="text-sm font-semibold tracking-tight">
          Steward <span className="opacity-60">·</span> Display
        </span>
      </Link>

      <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
        {NAV.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            aria-current={isActive(item.to) ? "page" : undefined}
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

      <div className="flex items-center gap-1">
        <Link
          to="/account"
          aria-label="Your account"
          aria-current={isActive("/account") ? "page" : undefined}
          className={ICON_BUTTON}
        >
          <CircleUser className="h-5 w-5" />
        </Link>
        <button
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={() => update({ theme: theme === "dark" ? "light" : "dark" })}
          className={ICON_BUTTON}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button aria-label="Open menu" className={`${ICON_BUTTON} md:hidden`}>
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle>Steward · Display</SheetTitle>
              <SheetDescription className="sr-only">Main navigation</SheetDescription>
            </SheetHeader>
            <nav aria-label="Main" className="mt-6 flex flex-col gap-1">
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  aria-current={isActive(item.to) ? "page" : undefined}
                  className={`rounded-md px-3 py-3 text-base font-medium ${
                    isActive(item.to) ? "bg-accent text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
