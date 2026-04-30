# Sikim UI redesign direction

## Visual direction

Sikim should read as a premium internal operations system for a restaurant and discotheque: dark, fast, elegant, dense, and durable. The interface should feel closer to night hospitality operations than to a generic blue SaaS dashboard.

The primary dark-mode direction is dark graphite, charcoal, and warm black. Slate can remain as a supporting neutral, but the UI should not feel strongly blue. Violet may remain as a small brand accent where it already exists, but it should not dominate navigation, primary CTAs, KPI cards, or large active surfaces unless explicitly approved.

The app should feel operational and durable, not like a demo or a marketing landing page. The design should borrow the structure of the Reservas/calendar reference without copying its blue/violet palette.

The redesign should prioritize:

- clear page headers with title, short context, and actions grouped on the right;
- wider desktop layouts that use available horizontal space for calendars, filters, KPIs, and tables;
- dense but readable tables with stable row actions;
- consistent panel, filter, badge, and metric styles;
- theme-aware surfaces with warm neutral borders and clear text contrast;
- restrained warm accents for key actions and active states;
- mobile layouts that collapse predictably without horizontal UI collisions.

Recommended design dials:

- `DESIGN_VARIANCE`: 4-5. Keep structure familiar, with modest asymmetry only where it improves scanning.
- `MOTION_INTENSITY`: 2-3. Use CSS-only hover, focus, and pressed states. Avoid cinematic or perpetual motion.
- `VISUAL_DENSITY`: 7-8. Operational screens should feel compact and information-rich without becoming cramped.

## Palette direction

Use this palette direction for future redesign PRs. Exact tokens can evolve during implementation, but the visual intent should remain stable.

Dark mode remains the primary validated direction:

- Base: warm black, graphite, charcoal, and deep neutral surfaces.
- Supporting neutrals: slate only where useful for contrast, not as the dominant blue cast.
- Text: off-white for primary text, warm gray for secondary copy, muted gray for metadata.
- Borders: warm neutral hairlines, subtle inner highlights, and low-contrast separators.
- Accent: muted amber, gold, copper, sand, or olive for selected states and primary emphasis.
- Status colors: keep semantic colors for actual status only, such as green for confirmed/success, amber for warning, red/rose for danger, and blue only where it clearly means information.

Light mode should feel like Sikim operations in day mode, not like a generic white SaaS tool:

- Base: light ivory, sand, and warm off-white app backgrounds.
- Surfaces: cream, stone, and pale warm-neutral panels with subtle separation.
- Text: graphite for primary text, warm gray for secondary copy, muted stone for metadata.
- Borders: beige, stone, and warm neutral hairlines with enough contrast for dense tables and forms.
- Accent: darker copper, amber, muted gold, or olive for selected states and primary emphasis.
- Status colors: keep semantic states clear and accessible on light surfaces, with enough contrast in badges, alerts, and row states.

Avoid:

- very blue navy SaaS feel;
- large violet or purple active surfaces;
- neon purple, glows, or generic Tailwind purple-dashboard aesthetics;
- flashy gradients or decorative orbs;
- marketing-page hero composition inside the app;
- pure white generic tool surfaces as the dominant light-mode base.

Violet/purple rule:

- allowed as a small Sikim brand accent, logo echo, or rare highlight;
- not the default active navigation color;
- not the default primary CTA color;
- not the default chart/KPI/card identity;
- never neon, glowing, or paired with blue gradients.

## Theme system: dark and light modes

The current dark direction remains the main visual base for Sikim. The next step is to make it a theme system that can also support a lighter operational mode for users who find the dark UI too low-brightness for daily work.

Dark and light modes should share the same product design:

- same composition;
- same density;
- same layouts;
- same components;
- same hierarchy;
- same interactions.

Do not duplicate screens for dark and light mode. Do not create two separate visual products. A screen should be built once and themed through semantic tokens so the same component tree can live in both modes.

Future screens should avoid hardcoded colors that only work on dark surfaces. Prefer semantic theme tokens, even if the first implementation still maps them to the current dark palette.

Recommended semantic tokens:

- `app background`
- `app surface`
- `app surface raised`
- `app surface subtle`
- `border`
- `border strong`
- `text primary`
- `text secondary`
- `text muted`
- `accent`
- `accent hover`
- `accent subtle`
- `success`
- `warning`
- `danger`
- `info`

These tokens should make theme changes possible without duplicating components, route files, business logic, or interaction patterns.

Theme rules:

- keep the dark mode close to the validated warm black, graphite, charcoal, amber, and copper direction;
- make light mode warm and operational: ivory/sand background, cream/stone surfaces, graphite text, beige/stone borders, and darker copper/amber accents;
- keep semantic status colors accessible in both modes;
- avoid new hardcoded dark colors unless there is a clear token mapping;
- avoid rigid black/white bases, dominant slate/blue/indigo/violet palettes, and a return to the old blue/violet SaaS look;
- do not change product logic, permissions, data flow, routes, or workflows for theme reasons.

## What to take from the references

Image A, reservations/calendar:

- calendar as the main object on `/reservas`;
- strong hierarchy between page header, calendar controls, calendar grid, and weekly summary;
- understated summary cards below the primary work surface.
- retain the structure, density, sidebar strength, and operational rhythm;
- translate the palette to graphite/warm-black with controlled warm accents instead of blue/violet dominance.

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
- The previous blue/violet SaaS identity as the main visual language.
- Neon purple, purple glows, or large purple active navigation blocks unless explicitly approved.
- Separate dark-mode and light-mode page implementations.
- A white, low-density, generic SaaS interpretation of light mode.
- Visual theme changes that alter product behavior or business rules.

## Reusable primitives introduced in PR 1

Location: `src/components/ui/`

- `PageHeader`: consistent page title, description, meta, and actions.
- `Surface`: reusable dark panel with controlled padding and tone.
- `Toolbar`: shared filter/action bar structure.
- `MetricCard` and `MetricStrip`: compact KPI presentation.
- `DataTableShell`: table container with optional heading, toolbar, and footer.
- `StatusBadge`: shared status colors for operational states.

These primitives are intentionally presentation-only. They should be adopted page by page after visual review, not forced through a large migration.

When these primitives are revisited, prefer semantic theme tokens and warm-neutral/warm-accent variants over expanding the old navy/violet look. Keep variants small and grounded in real pages.

## Rollout PR sequence

1. Theme foundation: introduce semantic theme tokens and a `light` / `dark` / `system` preference without changing product logic.
2. Reservas light-mode pilot: adapt `/reservas` first because it is already validated as the strongest visual pattern.
3. Reservas forms/detail adaptation: normalize `/reservas/nueva` and `/reservas/grupo/[id]` using the same themed primitives and current behavior.
4. Cocina and Mantenimiento light-mode adaptation: carry the same theme system into the already-redesigned operational modules without changing workflows.
5. Disco, Admin, and Cheffing redesigns: continue pending redesign work using theme tokens from the start, including future decisions for Cheffing.
6. Extension across remaining modules: complete dark and light support progressively without duplicating layouts, components, routes, or data logic.

## First pilot recommendation

After the Cheffing sweep, start the next redesign phase with `/reservas`.

Reason:

- it is the closest match to the primary Reservas/calendar reference;
- it is a core operational workflow for Sikim;
- it exposes the shared needs for page header, sidebar rhythm, calendar surface, compact reservation cards, status badges, and KPI strip;
- improvements there can become the template for Cocina, Mantenimiento, Disco, and Admin without touching Cheffing business logic.

Recommended pilot scope:

- use `PageHeader` for title and actions;
- introduce a `CalendarShell` pattern around the current calendar data;
- introduce compact `ReservationCard` styling for real reservation rows/cards;
- introduce a compact `MetricStrip` for real weekly/day metrics where already derivable from loaded data;
- replace local status pills with `StatusBadge` where behavior is unchanged;
- preserve all current data fetching, query params, links, redirects, and reservation behavior.

## Risks

- Widening shells can expose pages that were tuned for narrower widths. Use page-level max widths only where a form genuinely benefits from a narrower reading line.
- Shared primitives can become too generic. Keep them small and only add variants when a second real page needs them.
- Cheffing has many local mutation buttons. When redesigning tables, preserve disabled/loading/error behavior exactly.
- Do not let the operational dashboard reference drive fake modules or routes.
- Palette migration can become noisy if all colors are changed at once. Prefer page-by-page adoption after shell and primitive support exists.
- Warm accents can drift into a beige/brown theme. Keep the base dark graphite and use warm accents sparingly.
- Violet still exists in current code and branding. Reduce dominance gradually rather than doing a risky global replacement.
- Light mode can drift into generic white SaaS if it uses pure white surfaces, blue/slate defaults, or loose spacing. Keep it warm, dense, and operational.
- Theme support can create maintenance cost if screens are duplicated. Use semantic tokens and shared components instead.

## Verification checklist

- No auth, permission, API, Supabase, OCR, POS, storage, or env changes.
- No package or lockfile changes.
- No new dependencies.
- Main app and Cheffing still render through their existing layouts.
- Mobile header and Cheffing nav still wrap without overflow.
- Pilot pages remain visually dense but readable at desktop widths.
- Destructive or mutating actions remain visually distinct and keep current behavior.
- New surfaces do not read as blue/violet SaaS by default.
- Active navigation and primary CTAs use the approved warm-accent direction unless a route has explicit product approval for violet.
- Dark and light modes reuse the same layouts, components, and interactions.
- New color decisions map to semantic theme tokens instead of one-off hardcoded dark colors.
