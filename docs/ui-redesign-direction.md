# Sikim UI redesign direction

## Visual direction

Sikim should read as a serious internal operations tool: dark navy/slate base, quiet panels, clear borders, compact spacing, and a restrained violet accent for active navigation and primary actions. The app should feel operational and durable, not like a demo.

The redesign should prioritize:

- clear page headers with title, short context, and actions grouped on the right;
- wider desktop layouts that use available horizontal space for calendars, filters, KPIs, and tables;
- dense but readable tables with stable row actions;
- consistent panel, filter, badge, and metric styles;
- mobile layouts that collapse predictably without horizontal UI collisions.

## What to take from the references

Image A, reservations/calendar:

- calendar as the main object on `/reservas`;
- strong hierarchy between page header, calendar controls, calendar grid, and weekly summary;
- understated summary cards below the primary work surface.

Image B, operational dashboard:

- compact operational KPI strip;
- filter bar as a first-class control surface;
- split between a dense primary list and smaller side panels.

This is future inspiration only. Do not create a new control-center route unless product scope asks for it.

Image C, Cheffing products:

- best reference for Cheffing list pages;
- filters above KPIs and table;
- compact table rows with clear status badges and right-aligned row actions;
- inventory/cost numbers treated as operational data, not decorative cards.

## What not to copy

- Fake modules, fake routes, fake data, or a navigation model that conflicts with the current app.
- A new control center page in the first redesign PRs.
- Any action pattern that bypasses current permissions.
- Any behavior that changes reservations, Cheffing, POS, OCR, Supabase, storage, auth, or admin flows.
- Purely decorative visual effects that reduce density or make service-time screens harder to scan.

## Reusable primitives introduced in PR 1

Location: `src/components/ui/`

- `PageHeader`: consistent page title, description, meta, and actions.
- `Surface`: reusable dark panel with controlled padding and tone.
- `Toolbar`: shared filter/action bar structure.
- `MetricCard` and `MetricStrip`: compact KPI presentation.
- `DataTableShell`: table container with optional heading, toolbar, and footer.
- `StatusBadge`: shared status colors for operational states.

These primitives are intentionally presentation-only. They should be adopted page by page after visual review, not forced through a large migration.

## Rollout PR sequence

1. Visual foundations: shared primitives, shell width alignment, and this direction doc.
2. Cheffing Productos pilot: apply the primitives to the real products page and validate table density, filters, KPI strip, and row actions.
3. Cheffing list family: apply the proven pattern to elaboraciones, platos, bebidas, menus, carta, compras, proveedores, and menu engineering where it fits.
4. Reservas calendar: redesign the calendar view with the same surface/header system while preserving current reservation behavior.
5. Admin and operations pass: normalize tareas, rutinas, notas del dia, usuarios, and disco/aforo surfaces without changing workflows.

## First pilot recommendation

Start with `/cheffing/productos`.

Reason:

- it is the strongest match for the visual references;
- it already exposes the duplicated needs: search, filters, metrics, data table, badges, and row actions;
- improvements there can become the template for the rest of Cheffing without touching reservations logic.

Recommended pilot scope:

- use `PageHeader` for title and actions;
- use `Toolbar` for search and filters;
- introduce a compact `MetricStrip`;
- wrap the table in `DataTableShell`;
- replace local status pills with `StatusBadge`;
- preserve all current data fetching, edit/delete behavior, and routes.

## Risks

- Widening shells can expose pages that were tuned for narrower widths. Use page-level max widths only where a form genuinely benefits from a narrower reading line.
- Shared primitives can become too generic. Keep them small and only add variants when a second real page needs them.
- Cheffing has many local mutation buttons. When redesigning tables, preserve disabled/loading/error behavior exactly.
- Do not let the operational dashboard reference drive fake modules or routes.

## Verification checklist

- No auth, permission, API, Supabase, OCR, POS, storage, or env changes.
- No package or lockfile changes.
- No new dependencies.
- Main app and Cheffing still render through their existing layouts.
- Mobile header and Cheffing nav still wrap without overflow.
- Pilot pages remain visually dense but readable at desktop widths.
- Destructive or mutating actions remain visually distinct and keep current behavior.
