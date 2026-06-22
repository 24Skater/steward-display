# Screen builder rebuild

Current pain: drag-only positioning, no visual resize, settings panel is plain text inputs, no layout templates, no widget toolbar. Goal is a Dakboard-like flow: pick a starting layout, drop widgets into a snapping 12×8 grid, edit every setting in a structured right panel.

## What you'll see

1. New editor layout

```text
┌────────────────────────────────────────────────────────────────┐
│ Toolbar: ← Back  |  Screen name  |  Grid · Snap · Zoom  | Preview│
├──────────┬────────────────────────────────────────┬────────────┤
│ Library  │            CANVAS (12 × 8 grid)        │  Settings  │
│ search…  │    ┌──────┬──────┬──────┐              │  ▸ Content │
│ Clock    │    │Clock │Date  │Weath │   snap dots  │  ▸ Style   │
│ Date     │    └──────┴──────┴──────┘              │  ▸ Layout  │
│ Weather  │    ┌─────────────┐ ┌────┐              │  ▸ Schedule│
│ Image …  │    │Announcement │ │Img │              │            │
│          │    └─────────────┘ └────┘              │  [Delete]  │
└──────────┴────────────────────────────────────────┴────────────┘
```

2. Empty-state for a fresh screen: 6 layout templates (Single, 2-Up, 3-Up, Sidebar + main, Header + grid, Quad) — one click seeds widgets in the right zones.

3. Selected widget gets corner + edge handles to resize, snapping to the 12×8 grid. A floating mini-toolbar above it: Duplicate · Lock · Bring forward · Send back · Delete.

4. Right "Settings" panel becomes a tabbed/collapsible card:
   - Content — widget-type-specific fields with real controls (date pickers, dropdowns for align, image URL with thumbnail preview, color swatches)
   - Style — background/text color, radius, opacity, padding
   - Layout — X/Y/W/H steppers, align to canvas, fill row/column
   - Schedule (widget-level visibility window — stub, optional)

5. Keyboard: arrows nudge by 1 cell, Shift+arrows by 4, Delete removes, Cmd/Ctrl+D duplicates, Esc deselects.

## What I'm changing

- `src/routes/_admin.screens.$id.edit.tsx` — new shell with toolbar, template chooser when empty, keyboard handling.
- `src/components/editor/Canvas.tsx` — render snap dots, draw selection box, support resize via `dnd-kit` modifiers (or pointer events for handles), show ghost preview during drag/resize.
- `src/components/editor/WidgetPanel.tsx` — searchable library grouped by category with icons.
- `src/components/editor/PropertiesPanel.tsx` — restructured into collapsible sections + per-widget config split into its own file `WidgetConfigForms.tsx`. Replace freeform text fields with proper Select / ColorPicker / DateTime / Switch.
- New `src/components/editor/LayoutTemplates.tsx` + `src/lib/layoutTemplates.ts` — 6 presets returning widget seed lists.
- New `src/components/editor/WidgetToolbar.tsx` — floating per-widget actions.
- New `src/components/editor/ResizeHandles.tsx` — 8 handles per selected widget.
- `src/store/screenStore.ts` — add `duplicateWidget`, `reorderWidget`, `lockWidget` (uses existing `updateWidget`).
- `src/store/editorStore.ts` — add `clipboard` slot for duplicate, no new persistence.

## What I'm NOT changing this pass

- Storage / data model: `WidgetInstance` already has x/y/w/h/config/style — no migration needed.
- Widget renderers themselves (Clock, Weather, etc.) — only their config forms.
- Routing, auth, contrast audit work.
- Preview route stays as-is.

## Verification

- `bunx tsc --noEmit`
- Open `/screens/<id>/edit`, walk through: empty → template → add widget from library → drag → resize → edit settings → duplicate → delete → preview.
- Browser screenshot after each major change.

Ship in this order so you can review along the way:
1. Settings panel restructure + better per-widget forms (most-asked pain).
2. Resize handles + floating widget toolbar.
3. Layout templates + empty-state.
4. Library panel polish + keyboard shortcuts.
