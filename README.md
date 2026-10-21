# Steward Display

# Steward Display — Lovable Build Prompt

> Copy this entire document as your opening prompt to Lovable. It is written to maximize credit efficiency by front-loading all design decisions, architecture constraints, and brand rules so Lovable generates production-quality output on the first pass with minimal iteration cycles.

---

## Project Identity

**Product name:** Steward Display
**Product format:** `Steward · Display`
**Type:** Open-source, screen/display system for Steward ecosystem applications
**Inspiration reference:** DAKboard (dakboard.com) — a configurable, screen-based display platform
**GitHub brand source:** https://github.com/24Skater/steward-brand
**License:** MIT (OSS, consistent with Steward ecosystem)

---

## What Steward Display Is

Steward Display is a modular, screen-based display system that lets administrators configure one or more "screens" composed of "widgets." Each screen can be assigned to a physical display or a browser tab, and auto-rotates or holds based on configuration. Screens are built from a library of pre-built widgets (clock, announcements, event countdown, media, scripture, giving progress, weather, etc.) that are arranged on a canvas with a drag-and-drop editor.

The system has two distinct surfaces:

1. **The Display View** — the full-screen, public-facing rendering of a configured screen (no chrome, no controls, just the live output). This is what gets shown on a TV, lobby screen, or projector.

2. **The Admin Dashboard** — the management interface where screens are created, widgets are configured, schedules are set, and the display library is managed. This is used by church staff on a laptop or tablet.

---

## Brand Specification

Implement the Steward brand exactly. Do not deviate. All values below come directly from the official Steward brand guide.

### Colors

Define these as CSS custom properties on `:root`:

```css
:root {
  /* Brand */
  --color-navy:   #1B2A41;   /* Primary brand — backgrounds, headers */
  --color-blue:   #2563EB;   /* Actions, links, primary buttons */
  --color-emerald:#16A34A;   /* Success states */
  --color-amber:  #F59E0B;   /* Warnings */
  --color-red:    #DC2626;   /* Errors */

  /* Neutrals */
  --color-ink:    #0B1220;   /* Darkest text */
  --color-slate:  #334155;   /* Secondary text */
  --color-muted:  #64748B;   /* Tertiary/meta text */
  --color-border: #E2E8F0;   /* Dividers, outlines */
  --color-surface:#FFFFFF;   /* Card / elevated surfaces */
  --color-subtle: #F8FAFC;   /* Page background */
}
```

Dark mode overrides (used in the Display View and as an optional admin theme):

```css
[data-theme="dark"] {
  --color-surface: #1B2A41;
  --color-subtle:  #0B1220;
  --color-border:  #334155;
  --color-ink:     #F8FAFC;
  --color-slate:   #E2E8F0;
  --color-muted:   #94A3B8;
}
```

### Typography

Font: **Inter** (load from Google Fonts: `Inter:wght@400;500;600;700`)

```css
:root {
  --font-family: 'Inter', system-ui, -apple-system, sans-serif;

  --text-display: 2.25rem; /* 36px, Bold 700 — hero headlines */
  --text-h1:      1.875rem;/* 30px, Semibold 600 — page titles */
  --text-h2:      1.5rem;  /* 24px, Semibold 600 — section headers */
  --text-h3:      1.25rem; /* 20px, Medium 500 — card titles */
  --text-body:    1rem;    /* 16px, Regular 400 — primary content */
  --text-small:   0.875rem;/* 14px, Regular 400 — secondary */
  --text-caption: 0.75rem; /* 12px, Regular 400 — labels, metadata */
}
```

### Logo

Use the Steward mark SVG from:
`https://raw.githubusercontent.com/24Skater/steward-brand/main/assets/logo/steward-mark.svg`

Use the horizontal lockup from:
`https://raw.githubusercontent.com/24Skater/steward-brand/main/assets/logo/steward-lockup-horizontal.svg`

Use the light variant (white logo) from:
`https://raw.githubusercontent.com/24Skater/steward-brand/main/assets/logo/steward-mark-light.svg`

Display the product name in headers as: **Steward · Display**

### Spacing & Radius

```css
:root {
  --radius-sm:  4px;
  --radius-md:  8px;
  --radius-lg:  12px;
  --radius-xl:  16px;
  --space-1:    4px;
  --space-2:    8px;
  --space-3:    12px;
  --space-4:    16px;
  --space-6:    24px;
  --space-8:    32px;
  --space-10:   40px;
  --space-12:   48px;
}
```

### Shadows

```css
:root {
  --shadow-sm:  0 1px 2px rgba(11,18,32,0.06);
  --shadow-md:  0 4px 12px rgba(11,18,32,0.08);
  --shadow-lg:  0 8px 24px rgba(11,18,32,0.12);
}
```

---

## Tech Stack

- **Framework:** React 18 + TypeScript
- **Styling:** Tailwind CSS v3 (using `tailwind.config.js` with `extend` block that maps Steward brand tokens above — do not override Tailwind defaults, extend them)
- **Component library:** Radix UI primitives (unstyled, accessible) + custom styled wrappers matching Steward brand
- **Icons:** Lucide React (consistent with Steward ecosystem)
- **Drag and drop:** `@dnd-kit/core` + `@dnd-kit/sortable` for the widget canvas editor
- **State management:** Zustand for global screen/widget state
- **Routing:** React Router v6
- **Data persistence (MVP):** localStorage + JSON export/import (no backend required for MVP)
- **Build:** Vite

---

## Application Architecture

### Routes

| Route | Purpose |
|-------|---------|
| `/` | Admin dashboard home — screen library |
| `/screens/new` | Screen creation wizard |
| `/screens/:id/edit` | Widget canvas editor for a screen |
| `/screens/:id/preview` | Fullscreen display view (kiosk mode) |
| `/settings` | Global settings (organization name, timezone, default themes) |
| `/widgets` | Widget library browser |

### Data Models

```typescript
interface Screen {
  id: string;
  name: string;
  description?: string;
  orientation: 'landscape' | 'portrait';
  resolution: '1920x1080' | '1280x720' | '3840x2160' | 'custom';
  customWidth?: number;
  customHeight?: number;
  backgroundColor: string;
  backgroundImage?: string;
  widgets: WidgetInstance[];
  schedule?: Schedule;
  createdAt: string;
  updatedAt: string;
}

interface WidgetInstance {
  id: string;
  widgetType: WidgetType;
  x: number;        // grid column start
  y: number;        // grid row start
  w: number;        // grid column span
  h: number;        // grid row span
  config: Record<string, unknown>; // widget-specific config
  style?: {
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
    opacity?: number;
  };
}

type WidgetType =
  | 'clock'
  | 'date'
  | 'announcement'
  | 'countdown'
  | 'scripture'
  | 'weather'
  | 'image'
  | 'video'
  | 'giving-progress'
  | 'event-list'
  | 'divider'
  | 'text';

interface Schedule {
  enabled: boolean;
  startTime?: string;  // HH:mm
  endTime?: string;
  daysOfWeek?: number[];
  timezone: string;
}
```

---

## Pages to Build

### 1. Admin Dashboard (`/`)

**Purpose:** Screen library overview — the home base for managing all configured screens.

**Layout:**
- Top navigation bar with `Steward · Display` wordmark (horizontal lockup SVG), nav links (Screens, Widgets, Settings), and an "Add Screen" primary button
- Page header: "Screens" H1, subtitle "Manage your display configurations"
- Filter bar: search input, orientation filter (All / Landscape / Portrait), sort (Name / Last Modified / Created)
- Screen grid: 3-column card grid (responsive: 1 col mobile, 2 col tablet, 3 col desktop)

**Screen Card design:**
- 16:9 thumbnail preview area (navy background with a mini visual representation of the screen layout — show widget placeholders as subtle rounded rectangles)
- Card footer: screen name (H3), resolution badge, last modified date, widget count
- Overflow menu (three-dot): Edit, Preview, Duplicate, Delete
- Clicking the card body opens the editor
- Empty state: centered illustration placeholder, "No screens yet" headline, "Create your first screen" CTA button

**Design notes:**
- Card hover: lift shadow + blue top border accent (2px)
- Active/selected state: blue ring outline
- Status badge for screens that have a schedule enabled: small emerald dot + "Scheduled" label

---

### 2. Screen Editor (`/screens/:id/edit`)

**Purpose:** The core drag-and-drop widget canvas editor.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  [← Back]  Screen Name (editable inline)    [Preview] [Save] │
├────────────────┬────────────────────────────────────────┤
│                │                                        │
│  Widget Panel  │         Canvas (scaled preview)        │
│  (left drawer) │                                        │
│                │                                        │
│  [Search]      │   ┌──────────────────────────────┐    │
│                │   │                              │    │
│  Clock         │   │    Screen at scale ratio     │    │
│  Date          │   │    with grid overlay         │    │
│  Announcement  │   │    and dropped widgets       │    │
│  Countdown     │   │                              │    │
│  Scripture     │   └──────────────────────────────┘    │
│  Weather       │                                        │
│  ...           │   [1920×1080]  [Zoom: 75%  ▼]        │
│                │                                        │
└────────────────┴────────────────────────────────────────┤
│  Properties Panel (right drawer — appears when widget   │
│  is selected)                                           │
└─────────────────────────────────────────────────────────┘
```

**Canvas behavior:**
- 24-column grid overlay (toggleable)
- Widgets snap to grid on drop
- Resize handles on selected widgets
- Multi-select with Shift+click
- Delete selected with Backspace/Delete key
- Undo/redo (Ctrl+Z / Ctrl+Shift+Z)
- Canvas background color picker
- Zoom controls: 25%, 50%, 75%, 100%

**Widget Panel (left):**
- Grouped by category: Time, Content, Media, Data, Layout
- Each widget shown as an icon card with label
- Drag from panel onto canvas to add
- Double-click to add with default size at canvas center

**Properties Panel (right, contextual):**
- Appears when a widget is selected
- Shows widget-specific config fields
- Common fields: Position (X, Y), Size (W, H), Background color, Text color, Border radius, Opacity
- Widget-specific fields below (e.g., for Clock: time format 12h/24h, show seconds, font size override)
- Delete widget button at panel bottom (red, destructive, with confirmation)

---

### 3. Display View (`/screens/:id/preview`)

**Purpose:** Full-screen, production display output. No chrome. Pure content.

**Behavior:**
- Fills 100vw / 100vh with `overflow: hidden`
- No scrollbars, no navigation, no admin UI
- Renders every widget at its configured position and size
- Widgets animate in on load (subtle fade, staggered by 100ms per widget)
- Keyboard shortcut `Escape` exits to editor
- Clock/date widgets update every second
- Optional auto-refresh: page refreshes itself every N minutes (configurable)
- Background: configured screen background (color or image)
- Subtle Steward watermark option (bottom-right corner, low opacity) — toggleable per screen

**Widget rendering in display mode:**
- Widgets render at their true pixel dimensions (not scaled)
- Each widget is a self-contained component that manages its own live data (clock ticks, countdown counts down, etc.)

---

### 4. Widget Library (`/widgets`)

**Purpose:** Browser for all available widget types — reference and documentation for admins.

**Layout:**
- Page header: "Widget Library" H1
- Category tabs: All, Time, Content, Media, Data, Layout
- Widget cards in a 4-column grid
- Each card: large icon, widget name, one-sentence description, "Add to Screen" button (opens screen selector dropdown)
- Clicking a card expands it to show available configuration options and a live preview mockup

---

### 5. Settings (`/settings`)

**Purpose:** Global application configuration.

**Sections:**
- Organization: name, logo upload, timezone
- Display Defaults: default orientation, default background color, default font size
- Data Sources: weather API key (OpenWeatherMap), giving platform integration (placeholder for future)
- Export / Import: download all screens as JSON, import from JSON backup
- About: version number, link to GitHub repository, MIT license notice

---

## Widget Implementations

Build the following widgets as fully functional components:

### Clock Widget
- Displays current time, updates every second
- Config: 12h vs 24h format, show/hide seconds, font size (sm/md/lg/xl), text color
- Display: large time in display weight (700), optional seconds in smaller weight

### Date Widget
- Displays current date
- Config: format string (e.g., "Sunday, June 22, 2026"), text color, font size
- Updates at midnight automatically

### Announcement Widget
- Displays a text announcement with optional title
- Config: title text, body text, title color, body color, background color, text alignment
- Optional: auto-scroll long text vertically

### Countdown Widget
- Counts down to a target date/time
- Config: target datetime, label (e.g., "Service begins in"), display format (days/hours/minutes/seconds), which units to show
- Display: large numeric blocks with unit labels

### Scripture Widget
- Displays a Bible verse
- Config: verse reference (text field), verse text (text area), version label (e.g., "RVR1960"), text color, background
- No API required for MVP — admin manually enters the verse

### Text Widget
- Free-form rich text block
- Config: text content (basic formatting: bold, italic, size), alignment, color, background

### Image Widget
- Displays an image
- Config: URL or file upload (base64 stored), fit mode (cover/contain/fill), background color

### Divider Widget
- Horizontal or vertical line separator
- Config: orientation, color, thickness, opacity

### Giving Progress Widget (Placeholder)
- Shows a progress bar toward a giving goal
- Config: goal label, goal amount, current amount (manual entry for MVP), accent color
- Display: progress bar + percentage + dollar amounts

### Event List Widget (Placeholder)
- Shows a list of upcoming events
- Config: event entries (name, date, time) — manual for MVP
- Display: clean list with date chips

---

## Design Language — Specific Rules

These rules must be applied throughout every component:

1. **No decorative borders on dark backgrounds.** On navy/dark surfaces, use depth (shadow, opacity layers) instead of border lines.

2. **Button hierarchy:**
   - Primary: `background: var(--color-blue)`, white text, `border-radius: var(--radius-md)`, 10px 20px padding
   - Secondary: white background, `border: 1px solid var(--color-border)`, ink text
   - Destructive: `background: var(--color-red)`, white text
   - Ghost: transparent background, blue text, no border — hover adds subtle blue bg tint

3. **Form inputs:**
   - `border: 1px solid var(--color-border)`
   - `border-radius: var(--radius-md)`
   - Focus ring: `outline: 2px solid var(--color-blue)`, `outline-offset: 2px`
   - Placeholder text: `var(--color-muted)`

4. **Card pattern:**
   - `background: var(--color-surface)`
   - `border: 1px solid var(--color-border)`
   - `border-radius: var(--radius-lg)`
   - `box-shadow: var(--shadow-sm)`
   - Hover: `box-shadow: var(--shadow-md)`, `transition: box-shadow 150ms ease`

5. **Navigation bar:**
   - Background: `var(--color-navy)` (the deep brand navy — #1B2A41)
   - Text: white
   - Active nav item: `var(--color-blue)` left border accent (3px) or blue text
   - Height: 56px
   - Horizontal lockup logo at left, actions at right

6. **Loading states:** Skeleton loaders using `var(--color-subtle)` with a shimmer animation — never spinners unless an action is actively in progress.

7. **Empty states:** Centered in container, muted icon (64px, `var(--color-muted)`), H3 headline, body text, CTA button. Never just "No data."

8. **Toast notifications:**
   - Success: left border `var(--color-emerald)`, emerald icon
   - Warning: left border `var(--color-amber)`, amber icon
   - Error: left border `var(--color-red)`, red icon
   - Info: left border `var(--color-blue)`, blue icon
   - Position: bottom-right, stack upward, auto-dismiss after 4s

9. **Modal / Dialog:**
   - Backdrop: `rgba(11, 18, 32, 0.6)`
   - Panel: `var(--color-surface)`, `border-radius: var(--radius-xl)`, `box-shadow: var(--shadow-lg)`
   - Max width: 480px (small), 640px (medium), 800px (large)
   - Always includes a visible close button (X) in top-right

10. **Typography enforcement:**
    - Page titles use H1 (`var(--text-h1)`, semibold)
    - Section headers use H2 (`var(--text-h2)`, semibold)
    - Card titles use H3 (`var(--text-h3)`, medium)
    - No italic text in UI chrome (only in content widgets if appropriate)
    - Sentence case everywhere — never ALL CAPS in UI labels

---

## Accessibility Requirements

- All interactive elements must have visible keyboard focus states using the blue focus ring
- Minimum contrast ratio: 4.5:1 for normal text, 3:1 for large text
- All images and icons that convey meaning must have `aria-label` or `alt` text
- Drag-and-drop canvas must have keyboard-accessible fallback (arrow keys to move selected widget, Tab to cycle widgets)
- Color is never the sole indicator of state — always pair with text or icon

---

## Voice and Microcopy Rules

Apply the Steward voice throughout all UI text:

- "Screen saved." — not "Your screen configuration has been successfully saved."
- "Widget added." — not "Widget insertion operation complete."
- "No screens yet. Create one to get started." — not "No results found."
- "Delete this screen?" — not "Are you sure you want to permanently delete this screen? This action cannot be undone."
- Confirmations for destructive actions: two-step — primary "Delete" button, then a confirmation dialog with a red "Yes, delete" button.
- Error messages state what to do, not what went wrong in system terms: "Add a screen name to continue." not "Field 'name' is required."

---

## File Structure

Organize the project as follows:

```
src/
  components/
    ui/           # Base components (Button, Input, Card, Modal, Toast, Badge, etc.)
    layout/       # AppShell, NavBar, Sidebar, PageHeader
    widgets/      # One file per widget type
      ClockWidget.tsx
      DateWidget.tsx
      AnnouncementWidget.tsx
      CountdownWidget.tsx
      ScriptureWidget.tsx
      TextWidget.tsx
      ImageWidget.tsx
      DividerWidget.tsx
      GivingProgressWidget.tsx
      EventListWidget.tsx
    editor/       # Canvas, WidgetPanel, PropertiesPanel, CanvasGrid
    screens/      # ScreenCard, ScreenGrid, ScreenThumbnail
  pages/
    DashboardPage.tsx
    EditorPage.tsx
    DisplayPage.tsx
    WidgetLibraryPage.tsx
    SettingsPage.tsx
  store/
    screenStore.ts     # Zustand — screens CRUD
    editorStore.ts     # Zustand — editor state (selected widget, zoom, history)
    settingsStore.ts   # Zustand — global settings
  hooks/
    useScreen.ts
    useWidgetRegistry.ts
    useKeyboardShortcuts.ts
  lib/
    storage.ts         # localStorage read/write helpers
    export.ts          # JSON export/import
    widgetRegistry.ts  # Registry of all widget types with metadata
  styles/
    tokens.css         # All CSS custom properties defined above
    global.css         # Base styles, font import, reset
  types/
    index.ts           # All shared TypeScript types/interfaces
```

---

## Build Order

Build in this sequence — each phase is a Lovable prompt iteration:

**Phase 1 (this prompt):** Full application scaffold
- Design system (tokens, base components: Button, Input, Card, Badge, Toast, Modal, NavBar)
- Dashboard page with screen card grid and empty state
- Screen data model and Zustand store
- localStorage persistence layer

**Phase 2:** Screen Editor
- Canvas with grid
- Widget panel (left drawer) with all widget types listed
- Drag-and-drop from panel to canvas using @dnd-kit
- Widget resize handles
- Properties panel (right) — common fields only

**Phase 3:** Widget Implementations
- All 10 widget types as fully functioning display components
- Widget-specific config fields in Properties Panel
- Display View page (full-screen kiosk output)

**Phase 4:** Polish and Settings
- Settings page
- Widget Library page
- Schedule configuration
- JSON export/import
- Keyboard shortcuts
- Undo/redo history

---

## What NOT to Build

- No user authentication in MVP (this is a local/kiosk tool, auth is out of scope for OSS v1)
- No real-time sync or WebSocket backend in MVP
- No weather API integration in MVP (weather widget shows placeholder with config fields for API key)
- No React Native or mobile app (admin UI is responsive web only)
- No i18n/localization in MVP

---

## OSS Notes

- Include a `README.md` with project name, description, setup instructions, and a link to the Steward brand guide
- MIT License
- Add a `.env.example` file documenting any environment variables (e.g., VITE_APP_VERSION)
- Export/import of screens as JSON enables portability without a backend

---

## Start Here

Begin with Phase 1. Scaffold the full project with the design system, base components, and Dashboard page. The admin dashboard should be visually complete and pixel-accurate to the Steward brand before moving to editor functionality. Every component must use the CSS custom properties defined above — no hardcoded hex values anywhere in component files.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bcdf21ee-c73e-41f0-9285-0c36be282800).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
