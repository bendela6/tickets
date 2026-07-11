// Bootstrap: fetch JSON → validate → layout → render → wire. All model data comes
// from the JSON file; nothing about the diagram is hardcoded here.

import { loadModel } from './model.js';
import { packLayout, fitToView } from './layout.js';
import { buildScene, applyTransform, setRouting, relayout, clearFocus } from './render.js';
import { wireInteractions } from './interactions.js';
import { wireFilters } from './filters.js';
import { updateDetail } from './detail.js';
import { runChecks } from './checks.js';

const DEFAULT_MODEL = './eer-model.json';

const els = {
  world: document.getElementById('world'),
  viewport: document.getElementById('viewport'),
  detail: document.getElementById('detail'),
  banner: document.getElementById('banner'),
  bannerBody: document.getElementById('banner-body'),
  bannerClose: document.getElementById('banner-close'),
  brandTitle: document.getElementById('brand-title'),
  brandSub: document.getElementById('brand-sub'),
  groupToggles: document.getElementById('group-toggles'),
  kindToggles: document.getElementById('kind-toggles'),
  search: document.getElementById('search'),
  searchResults: document.getElementById('search-results'),
  routingBtn: document.getElementById('routing-btn'),
  fitBtn: document.getElementById('fit-btn'),
  rearrangeBtn: document.getElementById('rearrange-btn'),
  checkBtn: document.getElementById('check-btn'),
  checks: document.getElementById('checks'),
  checksBody: document.getElementById('checks-body'),
  checksClose: document.getElementById('checks-close'),
};

const state = {
  model: null,
  view: { zoom: 1, panX: 0, panY: 0, routing: 'curved' },
  els,
  selection: null,
  focus: null,
  hidden: { groups: new Set(), kinds: new Set() },
  applyTransform: null,
};
state.applyTransform = () => applyTransform(state);

async function boot() {
  const url = new URL(window.location.href).searchParams.get('model') || DEFAULT_MODEL;

  let raw;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    raw = await res.json();
  } catch (err) {
    return showFetchError(url, err);
  }

  const { model, errors, warnings } = loadModel(raw);
  showBanner(errors, warnings);
  if (errors.length) return; // model is invalid — banner explains why, nothing to render

  state.model = model;
  state.view.routing = model.view.routing;

  els.brandTitle.textContent = model.meta.title || 'EER model viewer';
  els.brandSub.textContent = model.meta.description || `${model.entities.length} entities · ${model.relationships.length} relationships`;

  packLayout(model);
  buildScene(state);
  wireInteractions(state);
  wireFilters(state);
  updateDetail(state);
  wireTopBar();

  // Fit after the layout has settled (grid columns / scrollbars finalize a frame
  // late), otherwise we measure a stale viewport size and over-zoom.
  requestAnimationFrame(() => requestAnimationFrame(() => fitToView(state)));

  // headless / console hooks
  window.__eer = state;
  window.__eerChecks = () => runChecks(state);
}

function wireTopBar() {
  const ROUTING_MODES = ['curved', 'avoid', 'ortho'];
  const ROUTING_LABELS = { curved: 'Lines: curved', avoid: 'Lines: avoid', ortho: 'Lines: ortho' };
  const ROUTING_TIP = {
    curved: 'Direct curves (may cross cards)',
    avoid: 'Curves routed around cards',
    ortho: 'Horizontal / vertical only',
  };
  const setRoutingBtn = (m) => {
    els.routingBtn.textContent = ROUTING_LABELS[m];
    els.routingBtn.title = ROUTING_TIP[m];
  };
  setRoutingBtn(state.view.routing);
  els.routingBtn.addEventListener('click', () => {
    const next = ROUTING_MODES[(ROUTING_MODES.indexOf(state.view.routing) + 1) % ROUTING_MODES.length];
    setRouting(state, next);
    setRoutingBtn(next);
  });

  els.fitBtn.addEventListener('click', () => fitToView(state));

  els.rearrangeBtn.addEventListener('click', () => {
    clearFocus(state);
    packLayout(state.model);
    relayout(state);
    fitToView(state);
  });

  els.checkBtn.addEventListener('click', () => renderChecks());
  els.checksClose.addEventListener('click', () => els.checks.classList.remove('show'));
  els.bannerClose.addEventListener('click', () => els.banner.classList.remove('show'));
}

function renderChecks() {
  const results = runChecks(state);
  els.checksBody.innerHTML = results
    .map(
      (r) => `<div class="chk ${r.pass ? 'pass' : 'fail'}">
        <span class="mark">${r.pass ? '✓' : '✗'}</span>
        <span class="txt"><b>${r.name}</b> — ${r.pass ? r.scope + ' ok' : r.problems.length + ' problem(s): ' + escape(r.problems.slice(0, 4).join('; '))}</span>
      </div>`
    )
    .join('');
  els.checks.classList.add('show');
}

function showBanner(errors, warnings) {
  if (!errors.length && !warnings.length) return;
  const parts = [];
  if (errors.length) parts.push(`<h3>${errors.length} error(s) — the model cannot render</h3>`);
  else parts.push(`<h3 class="warn">${warnings.length} warning(s)</h3>`);
  const list = [
    ...errors.map((e) => `<li>${escape(e)}</li>`),
    ...warnings.map((w) => `<li class="warn">${escape(w)}</li>`),
  ].join('');
  parts.push(`<ul>${list}</ul>`);
  els.bannerBody.innerHTML = parts.join('');
  els.banner.classList.add('show');
}

function showFetchError(url, err) {
  els.bannerBody.innerHTML = `<h3>Could not load the model</h3>
    <ul>
      <li>Tried to fetch <code>${escape(url)}</code> — ${escape(err.message || String(err))}</li>
      <li>This viewer fetches JSON over <b>http</b>. Opening the file with <code>file://</code> won't work.</li>
      <li>Serve this folder and reload — e.g. <code>cd docs/opus &amp;&amp; npx serve</code>, then open <code>/eer-viewer.html</code>.</li>
    </ul>`;
  els.banner.classList.add('show');
}

function escape(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
}

boot();
