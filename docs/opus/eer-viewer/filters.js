// Filters — group toggles, edge-kind toggles, and search. Group/kind toggles hide
// (never re-layout), so nothing drifts. Search focuses + centers a match.

import { applyVisibility, focusEntity, highlightField, clearFieldHighlight } from './render.js';
import { centerOn } from './layout.js';
import { updateDetail } from './detail.js';

export function wireFilters(state) {
  buildGroupToggles(state);
  buildKindToggles(state);
  wireSearch(state);
}

function buildGroupToggles(state) {
  const host = state.els.groupToggles;
  if (!host) return;
  host.innerHTML = '<span class="label">Zones</span>';
  for (const g of state.model.groups) {
    const chip = document.createElement('button');
    chip.className = 'chip on';
    chip.type = 'button';
    chip.innerHTML = `<span class="dot"></span>${g.label}`;
    chip.addEventListener('click', () => {
      const nowHidden = !state.hidden.groups.has(g.id);
      if (nowHidden) state.hidden.groups.add(g.id);
      else state.hidden.groups.delete(g.id);
      chip.classList.toggle('on', !nowHidden);
      chip.classList.toggle('off', nowHidden);
      applyVisibility(state);
    });
    host.appendChild(chip);
  }
}

function buildKindToggles(state) {
  const host = state.els.kindToggles;
  if (!host) return;
  if (!state.model.kinds.length) {
    host.style.display = 'none';
    return;
  }
  host.innerHTML = '<span class="label">Edges</span>';
  for (const k of state.model.kinds) {
    const chip = document.createElement('button');
    chip.className = 'chip on';
    chip.type = 'button';
    chip.innerHTML = `<span class="dot"></span>${k.label}`;
    chip.addEventListener('click', () => {
      const nowHidden = !state.hidden.kinds.has(k.id);
      if (nowHidden) state.hidden.kinds.add(k.id);
      else state.hidden.kinds.delete(k.id);
      chip.classList.toggle('on', !nowHidden);
      chip.classList.toggle('off', nowHidden);
      applyVisibility(state);
    });
    host.appendChild(chip);
  }
}

function wireSearch(state) {
  const input = state.els.search;
  const results = state.els.searchResults;
  if (!input || !results) return;

  const index = buildIndex(state);
  let hlIndex = -1;
  let current = [];

  const render = (matches) => {
    current = matches;
    hlIndex = -1;
    if (!matches.length) {
      results.classList.remove('open');
      results.innerHTML = '';
      return;
    }
    results.innerHTML = matches
      .map(
        (m, i) =>
          `<div class="res" data-i="${i}">
            <span class="mono">${m.label}</span>
            <span class="k">${m.kind === 'field' ? m.entityLabel + ' · field' : 'entity'}</span>
          </div>`
      )
      .join('');
    results.classList.add('open');
    results.querySelectorAll('.res').forEach((el) => {
      el.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        pick(matches[Number(el.dataset.i)]);
      });
    });
  };

  const pick = (m) => {
    state.selection = m.entityId;
    focusEntity(state, m.entityId);
    centerOn(state, m.entityId);
    updateDetail(state);
    if (m.kind === 'field') {
      highlightField(state, m.entityId, m.field);
    } else {
      clearFieldHighlight(state);
    }
    results.classList.remove('open');
    input.blur();
  };

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      render([]);
      return;
    }
    render(index.filter((m) => m.search.includes(q)).slice(0, 20));
  });

  input.addEventListener('keydown', (e) => {
    if (!results.classList.contains('open')) return;
    const items = results.querySelectorAll('.res');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      hlIndex = Math.min(hlIndex + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      hlIndex = Math.max(hlIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(current[hlIndex >= 0 ? hlIndex : 0]);
      return;
    } else {
      return;
    }
    items.forEach((el, i) => el.classList.toggle('hl', i === hlIndex));
  });

  input.addEventListener('blur', () => setTimeout(() => results.classList.remove('open'), 120));
}

function buildIndex(state) {
  const idx = [];
  for (const e of state.model.entities) {
    idx.push({ kind: 'entity', label: e.label, entityId: e.id, entityLabel: e.label, search: (e.label + ' ' + e.id).toLowerCase() });
    for (const f of e.fields) {
      idx.push({
        kind: 'field',
        label: f.name,
        field: f.name,
        entityId: e.id,
        entityLabel: e.label,
        search: (f.name + ' ' + e.label).toLowerCase(),
      });
    }
  }
  return idx;
}
