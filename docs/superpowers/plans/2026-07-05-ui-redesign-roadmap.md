# tickets UI redesign — phase roadmap

Spec: `docs/superpowers/specs/2026-07-05-ui-redesign-design.md`
Designs: `docs/design/*.html` (Instrument design system + 7 screens; open in a browser, needs internet for fonts/React CDN)

The redesign is too large for one plan. It ships as eight phases; **each phase
gets its own plan document written when the phase starts** (so later plans are
grounded in what actually got built, not guesses). Each phase leaves the app
working — old UI and new UI coexist until a screen is replaced, then the old
screen's code is deleted in that same phase.

Migration strategy: the new UI is built inside the existing `apps/web` app
(same router, same data layer — TanStack Query hooks and API client are kept).
Tailwind is added alongside `globals.css` **without preflight** so existing
screens don't shift; preflight arrives in phase 8 when the last old CSS dies.

| # | Phase | Delivers | Plan |
|---|-------|----------|------|
| 1 | Foundation & core primitives | Tailwind v4 + Instrument tokens (both themes), IBM Plex fonts, vitest test infra, `src/ui/` primitives: Button, Input, Textarea, Checkbox, Switch, RadioGroup, badge family (status shapes, option chips, type, key, avatar), dev gallery route | `2026-07-05-redesign-phase-1-foundation.md` |
| 2 | Overlays & complex controls | radix-ui overlays (Tooltip, Popover, Menu, Dialog, Toast), searchable Combobox single/multi, workflow-aware StatusSelect, DatePicker, MarkdownEditor, NumberInput; field-renderer registry rewired onto the new controls | written at phase start |
| 3 | Shell + Home | New app shell (sidebar nav from `01-shell-home.html`), project switcher, user picker, theme toggle, command palette, Home projects-overview screen with kind-segmented progress; old header deleted | written at phase start |
| 4 | Project board | Table mode (view-driven columns, density toggle, inline status edit) + Kanban mode (kind-colored columns, workflow-legal drag), view tabs, filter builder, KPI strip toggle; view config schema gains `mode`/`density`/`kpi`/`cardFields`; old table deleted | written at phase start |
| 5 | Ticket detail + new ticket | Peek drawer + full page from `04-ticket-detail.html`, subtasks w/ quick-add, links, comments, activity; type-first new-ticket flow from `05-new-ticket.html`; old drawer/dialog deleted | written at phase start |
| 6 | Settings / admin | Settings shell, Fields CRUD + options, type/field form builder, statuses, workflow graph editor, link types, users, views, projects (`06-settings-admin.html`). API mostly exists (`POST/PATCH` fields/options/statuses/transitions/link-types per DESIGN.md); gaps found while building get endpoints added in this phase | written at phase start |
| 7 | All Tickets — global view | Cross-project working view (`02-all-tickets.html`): fields shared by key, group-by-project, saved cross-project views. Needs API/DB work: workspace-level views + a cross-project board payload | written at phase start |
| 8 | Mobile & cleanup | Bottom-sheet filter builder, status sheet, search tab (`07-mobile-interactions.html`), responsive gaps, Tailwind preflight on, `globals.css` and any surviving old CSS deleted | written at phase start |

Dependency policy: every new package is flagged in its phase plan and goes
through the add-package approval flow at install time.

## Execution decisions (2026-07-06)

Locked by the user before the implementation marathon:

1. **Full-stack.** Build the API/DB endpoints the design needs (vocabulary
   mutations for settings, workspace-level views, cross-project board payload),
   not frontend-only. The UI must be real end-to-end.
2. **Replace & delete per phase.** When a screen's redesign lands it becomes
   the real app and the old component is deleted. No long-lived flag; old and
   new only coexist within a phase until the swap.
3. **Extend vocab + seed to match the design.** Add the `assignee` field
   (already spec'd) and seed real workflow transitions so workflow-aware UI has
   data to act on. DB mutations are in scope.
4. **Browser screenshot-compare each screen** against its `docs/design/*.html`
   file and self-correct before moving on (chrome-devtools MCP).

Mode: autonomous — commit after every task, keep the TIX-89..96 ticket statuses
in sync, only stop for genuine blockers.
