# Steward Display — Build Plan (Phases 1 + 2)

Adapts the spec to the current stack: **TanStack Start + Tailwind v4 + React 19**. Tokens live in `src/styles.css` under `@theme inline`, routes under `src/routes/`, navigation via `@tanstack/react-router`. All other product/brand decisions follow the spec verbatim.

## 1. Brand & design system

**`src/styles.css`** — replace the default shadcn palette with the Steward tokens (oklch equivalents of the spec hex values, mapped through `@theme inline` so utilities like `bg-navy`, `text-ink`, `border-border` work):

- Brand: `--navy #1B2A41`, `--blue #2563EB`, `--emerald #16A34A`, `--amber #F59E0B`, `--red #DC2626`
- Neutrals: `--ink`, `--slate`, `--muted`, `--border`, `--surface`, `--subtle`
- Also remap shadcn aliases: `--background → --subtle`, `--foreground → --ink`, `--card → --surface`, `--primary → --blue`, `--destructive → --red`, etc., so existing shadcn components inherit the brand without rewrites.
- `[data-theme="dark"]` block per spec for admin dark mode + display view.
- Radius scale (`--radius-sm/md/lg/xl` = 4/8/12/16), spacing aliases, three shadow tokens.
- Type scale exposed as `--text-display/h1/h2/h3/body/small/caption` plus matching `text-display` etc. via `@theme inline --text-*`.

**Font:** install `@fontsource-variable/inter`, import in `src/styles.css`. Set `--font-sans: "Inter Variable"`.

**Logo:** load the three SVGs from the `24Skater/steward-brand` raw URLs as `<img>` (no download needed for MVP). Header shows the horizontal lockup + "· Display" suffix.

## 2. Routes (TanStack file-based)

| File | URL | Purpose |
|---|---|---|
| `src/routes/__root.tsx` | — | Shell: HeadContent, QueryClientProvider, theme bootstrap, Toaster |
| `src/routes/_admin.tsx` | — | Admin layout: top nav + `<Outlet />` |
| `src/routes/_admin.index.tsx` | `/` | Dashboard (screen library) |
| `src/routes/_admin.screens.new.tsx` | `/screens/new` | Creation wizard (modal-style page) |
| `src/routes/_admin.screens.$id.edit.tsx` | `/screens/$id/edit` | Editor canvas |
| `src/routes/_admin.widgets.tsx` | `/widgets` | Widget library (stub grid) |
| `src/routes/_admin.settings.tsx` | `/settings` | Settings (stub sections) |
| `src/routes/screens.$id.preview.tsx` | `/screens/$id/preview` | Display View — no admin chrome |

Each route sets its own `head()` with title + meta. `_admin` layout owns the NavBar; the preview route is intentionally outside it.

## 3. State & persistence

- **Zustand** stores: `screenStore` (screens CRUD), `editorStore` (selected widget id, zoom, history stack, grid toggle), `settingsStore` (org name, timezone, theme).
- **`src/lib/storage.ts`** — typed `localStorage` get/set with JSON, SSR-guarded (`typeof window !== "undefined"`).
- Zustand `persist` middleware writes to localStorage keys `steward.screens`, `steward.settings`. Editor store is in-memory only.
- **`src/lib/widgetRegistry.ts`** — single source of truth: id, label, icon, category, default size, default config, React component for display, React component for properties panel. All 10 widget types registered (even if Phase-2 stubs render a placeholder card with the widget name).
- **`src/types/index.ts`** — `Screen`, `WidgetInstance`, `WidgetType`, `Schedule` exactly as specified.

## 4. Base UI components (`src/components/ui/*`)

Reuse the existing shadcn primitives (Button, Card, Input, Dialog, DropdownMenu, Badge, Sonner toast, Tabs, Tooltip, Switch, Slider, Select, ScrollArea, Separator). Add Steward-flavored variants where needed:

- `Button` — add `variant="primary"` (blue), keep `secondary`, `destructive`, `ghost`. Map existing `default` → blue.
- `Card` — add hover lift class via a wrapper `<ScreenCard>` rather than mutating the primitive.
- Add `PageHeader` (title + subtitle + actions slot) and `EmptyState` (icon, headline, body, CTA) in `src/components/layout/`.

## 5. Admin shell

`src/components/layout/AppShell.tsx` + `NavBar.tsx`:

- 56px navy bar, horizontal lockup left, nav links (Screens, Widgets, Settings) using `<Link>` with `activeProps` blue underline, "Add screen" primary button right, theme toggle (Sun/Moon) + overflow menu.
- Theme toggle writes `data-theme` on `<html>` and persists in `settingsStore`. SSR-safe: read once on mount, default light.

## 6. Dashboard (`/`)

- `PageHeader` "Screens" / "Manage your display configurations"
- Filter bar: search input, orientation `Select`, sort `Select`
- Responsive `ScreenCard` grid (1/2/3 col). Card = 16:9 thumbnail (navy w/ widget placeholder rectangles derived from `screen.widgets`), footer with name (H3), resolution badge, last-modified, widget count, overflow menu (Edit, Preview, Duplicate, Delete with two-step confirm Dialog). Scheduled screens show emerald dot + "Scheduled" pill.
- Empty state when no screens — CTA opens `/screens/new`.
- "New Screen" page: modal-styled form (name, orientation toggle, resolution select w/ custom W/H), creates a screen and navigates to its editor.

## 7. Editor (`/screens/$id/edit`) — Phase 2

`src/components/editor/`:

- **EditorTopBar** — back button, inline-editable screen name (click to edit), Preview button (opens `/screens/$id/preview` in new tab), Save (auto-save indicator since persist is automatic).
- **WidgetPanel** (left, 280px) — search input + categories (Time, Content, Media, Data, Layout) from registry. Each widget = draggable icon card. Double-click adds to canvas center.
- **Canvas** (center) — scaled iframe-free preview. 24-column CSS grid overlay (toggleable). Screen-sized stage at zoom ratio (25/50/75/100%). Widgets render via `WidgetRenderer` from the registry. Selected widget shows resize handles (8 handles, drag to resize on grid). Click to select, Shift+click for multi-select, Backspace deletes, Ctrl+Z/Y undo/redo via editor store history.
- **PropertiesPanel** (right, 320px, contextual) — common fields (X, Y, W, H number inputs, bg color, text color, radius, opacity slider) + widget-specific fields from the registry entry. Destructive Delete button at bottom.
- **DnD:** `@dnd-kit/core` for palette→canvas drag, `useDraggable` on canvas widgets for repositioning with grid snap. Keyboard fallback: arrow keys move selected widget by 1 grid cell, Shift+arrow by 4.

## 8. Display view (`/screens/$id/preview`)

- 100vw/100vh, `overflow: hidden`, `data-theme="dark"` forced on root.
- Renders widgets at true pixel positions via `position: absolute` inside a `Screen.width × Screen.height` stage, then `transform: scale()` to fit viewport while preserving aspect.
- Staggered fade-in (100ms per widget) using CSS animation utility classes.
- Escape key navigates back to editor (uses `useNavigate`). Background color/image from screen config. Optional Steward watermark (bottom-right, 30% opacity, toggle in screen settings).

## 9. Widget implementations (live components)

All ten widgets shipped functional per spec (Clock ticks every second via `setInterval` in a hook, Date updates at midnight, Countdown live, Scripture/Text/Announcement static config-driven, Image renders from URL/base64, Divider, Giving Progress as `<progress>`-styled bar, Event List as static list). Each widget has both `<DisplayComponent>` and `<ConfigComponent>` registered in `widgetRegistry`.

## 10. Stubs (Phase 3/4 placeholders, present so nav works)

- `/widgets` — grid of widget cards from registry with description + "Add to screen" disabled-with-tooltip.
- `/settings` — sections rendered as cards: Organization (name input bound to settings store), Display defaults, Data sources (disabled), Export/Import (working JSON export + import via `<input type="file">` + `src/lib/export.ts`), About.

## 11. Voice, a11y, microcopy

- All copy follows spec (`"Screen saved."`, `"No screens yet. Create one to get started."`, two-step destructive confirms).
- Focus rings via `focus-visible:outline-2 focus-visible:outline-blue`.
- All icon-only buttons get `aria-label`.
- `prefers-reduced-motion` disables stagger and shimmer.

## 12. Dependencies to install

```
bun add zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @fontsource-variable/inter
```

(`lucide-react`, `sonner`, Radix primitives, `react-router`-equivalent already present via shadcn + TanStack.)

## 13. Out of scope this turn

Phase 3 polish (schedule UI fully wired, keyboard shortcuts cheatsheet, weather API), Phase 4 (advanced undo across sessions), auth, real-time sync, README/LICENSE files (will add when explicitly requested).

## Technical details

- **No hardcoded hex** in `src/components/**` — only utility classes mapped to brand tokens. The spec's hex values appear only inside `src/styles.css`.
- **SSR safety:** Zustand stores are created lazily; localStorage access wrapped in `typeof window` guard; theme attribute set in a `useEffect` to avoid hydration mismatch (initial render uses light).
- **Editor history** kept in-memory (last 50 entries) — undo/redo doesn't survive reload, matching MVP intent.
- **Canvas scaling** uses `transform-origin: top left` so widget pixel coordinates match what Display View renders 1:1.
- **Drag preview** uses `DragOverlay` to avoid layout shifts inside the scaled canvas.
- No backend; everything client-only.
