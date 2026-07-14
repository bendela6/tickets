# EER model viewer — build prompt

Use this document as a from-scratch brief or agent prompt. It is **not** tied to a specific UI framework, graph library, color system, or backend.

**Data rule:** the diagram is driven entirely by **JSON** (file and/or HTTP). Rendering code must not hardcode entities, fields, or edges.

## Reference implementation (this repo)

| File | Role |
|------|------|
| [`eer-viewer.html`](./eer-viewer.html) | JSON-driven interactive viewer |
| [`eer-model.sample.json`](./eer-model.sample.json) | Sample model |

Serve the folder (fetch needs HTTP, not `file://`):

```bash
npx --yes serve docs/grok
```

Then open `/eer-viewer.html` (optional `?model=eer-model.sample.json`).

---

## Requirements

- Do not assume a specific UI framework, graph library, color system, or backend.
- Prefer a single-page viewer that loads JSON and renders it.
- Focus on correct field-level connections and clear exploration over decorative styling.
- Implement the features below as a checklist; choose any stack that can deliver them.

---

## Data source (JSON)

- Serve the EER model from one or more JSON files (or a JSON HTTP endpoint).
- On load, fetch/parse JSON and build the full diagram from that data only.
- Changing the JSON (and reloading) must be enough to change the model — no code edits for new entities/fields/relationships.
- Validate JSON shape on load; show a clear error if required keys are missing or references are broken.
- Support a documented schema so others can author models without reading renderer source.
- Optional: support multiple model files / model picker later; v1 may use a single JSON URL or path.
- Sample JSON ships with the project demonstrating PK/FK, cardinalities, groups, and multi-field entities.

### Suggested JSON concepts

Names can vary; the structure must cover these concepts:

| Concept | Contents |
|--------|----------|
| **groups / zones** | id, label, optional order |
| **entities / tables** | id, label, group id, optional description, optional layout hints |
| **fields / columns** | name, type, optional title, description, role (`pk` / `fk` / none), optional ref entity, optional meta |
| **relationships / edges** | id, source entity, source field, target entity, target field, optional kind, optional label, optional cardinality (`1-1` \| `1-n` \| `n-1` \| `n-m`) |
| **view settings** (optional) | default zoom, layout name, toggles |

- Infer cardinality when omitted (e.g. PK→FK → `1-n`, FK→PK → `n-1`) but prefer explicit values in JSON when known.
- Reject or warn on edges that reference missing entities/fields.

---

## Core model (runtime)

- Represent entities as nodes with ordered fields from JSON.
- Represent relationships as edges between fields (not only whole entities).
- Support grouping entities into zones/regions from JSON.
- Keep model data immutable after load except for pure view state (selection, pan, zoom, filters).

---

## Entity cards

- Compact card: header (entity name) + field list.
- Default field display is minimal (e.g. name + type).
- Full field detail (title, description, constraints, refs) lives in a detail panel.
- Visually distinguish PK and FK fields.

---

## Field connectors

- Every field has left and right connector ports.
- Ports sit outside the card with a small fixed gap (e.g. ~8px).
- Draw a short straight static stem from card edge to each outer port: `o—[card]—o`.
- Relationship edges attach to field ports, not entity centers.
- Auto-pick left/right port from relative entity positions (facing side).
- Ports/stems stay correct after move, zoom, and layout recompute.
- One visual port set only (no duplicate CSS + graph dots).

---

## Relationships / edges

- Connect source field port → target field port using JSON endpoints.
- Edge labels show **cardinality only** (`1-1`, `1-n`, `n-1`, `n-m`), not long path names.
- Optional edge kinds (e.g. solid vs dashed).
- Endpoints must always land on real ports (no floating lines).
- Optional simple routing modes (curved vs orthogonal).
- In focus mode, keep related edges distinguishable (color and/or spacing).

---

## Interaction — navigation

- Mouse wheel zooms toward cursor.
- Middle-mouse drag pans the canvas only.
- Left-mouse drag moves entities (and groups if supported).
- Left-click selects/focuses without fighting drag.
- Fit-to-view and rearrange/reset layout actions.
- Optional card size scale that reflows by measurement.

---

## Interaction — exploration / focus

- Click entity → focus related entities/edges; hide or fade the rest.
- Hover field → highlight only edges attached to that field’s ports.
- Hover/click edge → isolate that path and its two entities.
- Clear focus with Escape or empty-canvas click.
- Hover/focus must not reflow or shift entity positions (view state only).

---

## Detail panel

- Shows selected entity from JSON: description, full fields, relationships.
- Relationship rows show direction, opposite entity/field, cardinality.
- Clicking a panel relationship isolates that edge on the diagram.
- Empty state explains controls.

---

## Layout

- Auto-layout packs entities by group with margins (no overlaps).
- On-demand rearrange after load and after size changes.
- After layout/drag, re-anchor ports, stems, and edges.
- No vertical/horizontal drift from hover or highlight.

---

## Filtering / search

- Toggle zones/groups from JSON group ids.
- Toggle relationship kinds if present in JSON.
- Search entities/fields and jump/focus matches.

---

## Quality checks

- Programmatically verify every relationship endpoint hits a port.
- Verify one L/R port pair per field (no duplicates).
- Verify hover/focus does not change node coordinates.
- Verify broken JSON references surface as user-visible errors.

---

## Non-goals

- No hardcoded product domain beyond sample JSON.
- Backend optional for v1 (static JSON file is enough).
- No screenshot-only verification.
- No mandatory design system.

---

## Deliverables

- Runnable viewer that loads model JSON (file path and/or URL)
- JSON schema (or equivalent docs) for the model format
- Sample JSON demonstrating the features above
- README: how to add entity/field/relationship in JSON and point the viewer at a file/URL
- Note on controls: wheel zoom, middle pan, left drag, field hover, entity focus
