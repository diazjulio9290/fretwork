/* ============================================================
   Fretwork — UI layer
   Single state object, full re-render per section on change,
   event delegation via data-action attributes.
   Layout per design critique: progression → answer → docked neck,
   with theory as reference in a right rail. Dark by default.
   ============================================================ */

const state = {
  tab: 'studio',
  theme: 'dark', // dark (default) | light | auto
  chords: [
    { root: 2, type: 'min7' },
    { root: 7, type: 'dom7' },
    { root: 0, type: 'maj7' },
  ],
  focus: 0,
  selected: [{ root: 0, key: 'ionian' }], // up to 4 {root, key}
  labelMode: 'names',
  emphasizeRoots: true,
  view: 'full', // full | caged | 3nps | custom
  posIndex: 0,
  customSet: new Set(),
  dockCollapsed: false,
  libQuery: '',
  libCat: 'All',
};

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---- Persistence (best effort; storage can be absent or blocked) ---- */
const STORE_KEY = 'fretwork.v2';
function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      theme: state.theme, chords: state.chords, focus: state.focus, selected: state.selected,
      labelMode: state.labelMode, emphasizeRoots: state.emphasizeRoots, view: state.view,
      bpm: Player.bpm, beats: Player.beats, loop: Player.loop, follow: Player.follow,
      volume: Audio_.volume, muted: Audio_.muted,
    }));
  } catch (e) { /* storage unavailable */ }
}
function restore() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return; }
  if (!saved || typeof saved !== 'object') return;
  const validChord = (c) => c && Number.isInteger(c.root) && c.root >= 0 && c.root < 12 && CHORD_TYPES[c.type];
  const validScale = (s) => s && Number.isInteger(s.root) && s.root >= 0 && s.root < 12 && SCALES[s.key];
  if (Array.isArray(saved.chords) && saved.chords.length && saved.chords.every(validChord))
    state.chords = saved.chords.slice(0, 12).map((c) => ({ root: c.root, type: c.type }));
  if (Array.isArray(saved.selected) && saved.selected.every(validScale))
    state.selected = saved.selected.slice(0, 4).map((s) => ({ root: s.root, key: s.key }));
  if (Number.isInteger(saved.focus)) state.focus = Math.max(0, Math.min(state.chords.length - 1, saved.focus));
  if (['dark', 'light', 'auto'].includes(saved.theme)) state.theme = saved.theme;
  if (['names', 'intervals', 'degrees', 'none'].includes(saved.labelMode)) state.labelMode = saved.labelMode;
  if (['full', 'caged', '3nps', 'custom'].includes(saved.view)) state.view = saved.view;
  if (typeof saved.emphasizeRoots === 'boolean') state.emphasizeRoots = saved.emphasizeRoots;
  if (Number.isFinite(saved.bpm)) Player.bpm = Math.max(40, Math.min(220, Math.round(saved.bpm)));
  if ([2, 4, 8].includes(saved.beats)) Player.beats = saved.beats;
  if (typeof saved.loop === 'boolean') Player.loop = saved.loop;
  if (typeof saved.follow === 'boolean') Player.follow = saved.follow;
  if (Number.isFinite(saved.volume)) Audio_.volume = Math.max(0, Math.min(1, saved.volume));
  if (typeof saved.muted === 'boolean') Audio_.muted = saved.muted;
}

const isSelected = (root, key) => state.selected.some((s) => s.root === root && s.key === key);
const scaleLabel = (root, key) => spellScale(root, key).rootName + ' ' + SCALES[key].name;

function toggleScale(root, key) {
  const i = state.selected.findIndex((s) => s.root === root && s.key === key);
  if (i >= 0) state.selected.splice(i, 1);
  else {
    if (state.selected.length >= 4) state.selected.shift();
    state.selected.push({ root, key });
  }
  state.posIndex = 0;
  render();
}

/* ================= Progression builder ================= */
const TYPE_SHORT = (k) => CHORD_TYPES[k].symbol || 'maj';

function renderProgression() {
  const rail = $('#prog-rail');
  rail.innerHTML = state.chords.map((c, i) => {
    const spelled = spellChord(c.root, c.type);
    const playing = Player.playing && Player.mode === 'prog' && Player.chordIndex === i;
    return `<div class="chord-card ${i === state.focus ? 'focused' : ''} ${playing ? 'playing' : ''}" data-action="focus-chord" data-idx="${i}"
      ${playing ? `style="--len:${(Player.secPerBeat() * Player.beats).toFixed(2)}s"` : ''}>
      <div class="chord-sym" data-action="play-chord" data-idx="${i}" title="Play chord">${esc(chordSymbol(c))}</div>
      <div class="chord-notes mono">${spelled.notes.join(' ')}</div>
      <button class="chord-remove" data-action="remove-chord" data-idx="${i}"
        ${state.chords.length <= 1 ? 'disabled' : ''}
        title="${state.chords.length <= 1 ? 'Keep at least one chord' : 'Remove ' + esc(chordSymbol(c))}"
        aria-label="Remove chord">×</button>
    </div>`;
  }).join('<div class="chord-arrow">→</div>')
  + `<button class="add-chip" data-action="add-chord" ${state.chords.length >= 12 ? 'disabled' : ''} aria-label="Add chord" title="Add chord">＋</button>`;
  $('#prog-count').textContent = state.chords.length + (state.chords.length === 1 ? ' chord (vamp) · 1–12' : ' chords · 1–12');
  renderChordEditor();
}

// Tap-target editor for the focused chord (no native dropdowns).
function renderChordEditor() {
  const c = state.chords[state.focus];
  const roots = ROOT_CHOICES.map((r) =>
    `<button class="ed-btn ${r.pc === c.root ? 'on' : ''}" data-action="set-root" data-pc="${r.pc}">${PC_PREFERRED[r.pc]}</button>`).join('');
  const types = Object.keys(CHORD_TYPES).map((k) =>
    `<button class="ed-btn ${k === c.type ? 'on' : ''}" data-action="set-type" data-key="${k}" title="${esc(CHORD_TYPES[k].name)}">${esc(TYPE_SHORT(k))}</button>`).join('');
  $('#chord-editor').innerHTML = `<div class="editor">
    <div class="ed-label mono">editing ${esc(chordSymbol(c))}</div>
    <div class="ed-row ed-roots">${roots}</div>
    <div class="ed-row ed-types">${types}</div>
  </div>`;
}

/* ================= The answer (three-tier scales) ================= */
function chipFor(root, key, extra = '') {
  const on = isSelected(root, key);
  return `<button class="chip ${on ? 'on' : ''}" data-action="toggle-scale" data-root="${root}" data-key="${key}">
    ${esc(scaleLabel(root, key))}${extra}</button>`;
}

// Chip with a fill bar behind it — length encodes fit, per critique.
function barChip(a) {
  const on = isSelected(a.root, a.key);
  const pct = Math.round(a.frac * 100);
  return `<button class="chip bar ${a.near ? 'dull' : 'gold'} ${on ? 'on' : ''}"
    data-action="toggle-scale" data-root="${a.root}" data-key="${a.key}"
    style="--fill:${pct}%">${esc(scaleLabel(a.root, a.key))}</button>`;
}

function renderAnswer() {
  const match = matchScales(state.chords);
  const { families, singles } = groupFullFits(match.full);
  const n = state.chords.length;
  const card = $('#answer-card');
  const altRow = $('#alt-row');
  const more = $('#more-scales');

  let alts = [];
  let moreList = [];

  if (families.length) {
    const fam = families[0];
    const parentName = spellScale(fam.parentRoot, fam.fam.parent).rootName;
    const first = state.chords[0];
    let reason = n === 1
      ? `<b>${esc(parentName)} ${fam.fam.label}</b> — the ${esc(chordSymbol(first))} sits entirely inside it.`
      : `<b>${esc(parentName)} ${fam.fam.label}</b> — all ${n} chords live here.`;
    const m = fam.modes.find((mm) => mm.root === first.root && mm.key !== fam.fam.parent);
    if (m) reason += ` Start on ${esc(spellScale(m.root, m.key).rootName)} for ${esc(SCALES[m.key].name)} color over the ${esc(chordSymbol(first))}.`;
    card.innerHTML = `<div class="answer">
      <div class="answer-status mono">${n === 1 ? 'fits the vamp' : 'fits all ' + n + ' chords'}</div>
      <p class="answer-reason">${reason}</p>
      <div class="chip-row">${fam.modes.map((mm) => chipFor(mm.root, mm.key)).join('')}</div>
    </div>`;
    families.slice(1).forEach((f2) => alts.push({ root: f2.parentRoot, key: f2.fam.parent, frac: 1 }));
    singles.forEach((e) => alts.push({ root: e.root, key: e.key, frac: 1 }));
    match.near.forEach((e) => alts.push({ root: e.root, key: e.key, frac: e.count / n, near: true }));
  } else {
    const allDominant = state.chords.every((c) => CHORD_TYPES[c.type].family === 'dominant');
    const r = state.chords[0].root;
    if (allDominant) {
      card.innerHTML = `<div class="answer">
        <div class="answer-status mono">no single fit — and that is the blues</div>
        <p class="answer-reason"><b>${esc(spellScale(r, 'minBlues').rootName)} minor blues</b> over everything.
        All-dominant progressions never share one scale; the ♭3-against-major-3rd rub is the blue note.</p>
        <div class="chip-row">${chipFor(r, 'minBlues')}${chipFor(r, 'minPent')}${chipFor(r, 'majBlues')}</div>
      </div>`;
      state.chords.forEach((c, i) => {
        match.perChord[i].slice(0, 1).forEach((s) => alts.push({ root: s.root, key: s.key, frac: s.overlap }));
      });
    } else {
      const top = match.perChord[0][0];
      card.innerHTML = `<div class="answer">
        <div class="answer-status mono">no single fit — this progression modulates</div>
        <p class="answer-reason">Switch scales as the chords change. Start with
        <b>${esc(scaleLabel(top.root, top.key))}</b> over the ${esc(chordSymbol(state.chords[0]))},
        then follow the chord-by-chord picks in the reference rail.</p>
        <div class="chip-row">${match.perChord[0].slice(0, 3).map((s) => chipFor(s.root, s.key)).join('')}</div>
      </div>`;
      match.near.forEach((e) => alts.push({ root: e.root, key: e.key, frac: e.count / n, near: true }));
    }
  }

  // dedupe alts against each other and the answer card
  const seen = new Set(state.selected.map((s) => s.root + ':' + s.key));
  alts = alts.filter((a) => {
    const id = a.root + ':' + a.key;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  const shown = alts.slice(0, 4);
  moreList = alts.slice(4);

  altRow.innerHTML = shown.length
    ? `<h3>Alternatives</h3><div class="chip-row">${shown.map(barChip).join('')}</div>`
    : '';

  if (moreList.length) {
    more.hidden = false;
    more.querySelector('summary').textContent = moreList.length + ' more options';
    more.querySelector('div').innerHTML = `<div class="chip-row">${moreList.map(barChip).join('')}</div>`;
  } else more.hidden = true;

  $('#selected-scales').innerHTML = state.selected.length
    ? '<h3>On the neck now</h3><div class="sel-row">' + state.selected.map((s, i) => {
      const multi = state.selected.length > 1;
      const sw = multi ? `style="background:var(--sc${i})"` : `style="background:var(--fn-scale)"`;
      return `<span class="sel-pill"><i class="swatch" ${sw}></i>${esc(scaleLabel(s.root, s.key))}
        <button data-action="play-scale" data-i="${i}" title="Play scale">▶</button>
        <button data-action="remove-scale" data-i="${i}" aria-label="Remove">×</button></span>`;
    }).join('') + '</div>'
    : '<p class="muted">Pick a scale above to light up the neck (up to 4 overlay together).</p>';

  return match;
}

/* ================= Reference rail ================= */
function renderPerChord(match) {
  $('#perchord-block').innerHTML = '<h3>Chord-by-chord</h3>' + state.chords.map((c, i) => {
    const chips = match.perChord[i].map((s) =>
      barChip({ root: s.root, key: s.key, frac: s.overlap })).join('');
    return `<div class="perchord-row"><span class="pc-label mono">${esc(chordSymbol(c))}</span>
      <div class="chip-row">${chips}</div></div>`;
  }).join('');
}

/* ================= Theory cards ================= */
function whyItFits(sel) {
  const pcs = new Set(scalePcs(sel.root, sel.key));
  const rows = state.chords.map((c) => {
    const cp = chordPcs(c.root, c.type);
    const spelled = spellChord(c.root, c.type);
    const inside = cp.every((pc) => pcs.has(pc));
    if (inside) {
      const gt = targetTones(c).map((t) => t.note + ' (' + t.deg + ')').join(', ');
      return `<li><b>${esc(chordSymbol(c))}</b> — every chord tone is in the scale; guide tones ${esc(gt)} are your strongest landing points.</li>`;
    }
    const missing = cp.filter((pc) => !pcs.has(pc))
      .map((pc) => spelled.notes[cp.indexOf(pc)]).join(', ');
    return `<li><b>${esc(chordSymbol(c))}</b> — ⚠ the chord tone ${esc(missing)} sits outside this scale; treat this bar as a scale-switch moment or bend into the missing note.</li>`;
  }).join('');
  return `<div class="theory-sub"><b>${esc(scaleLabel(sel.root, sel.key))}</b>
    <span class="mono muted"> ${SCALES[sel.key].degrees.join(' ')}</span>
    <p class="muted small">${esc(SCALES[sel.key].character)}</p><ul>${rows}</ul></div>`;
}

function noteMapCard() {
  const c = state.chords[state.focus];
  if (!state.selected.length) return '';
  const sel = state.selected[0];
  const spelled = spellScale(sel.root, sel.key);
  const pcs = scalePcs(sel.root, sel.key);
  const chips = pcs.map((pc, i) => {
    const cls = classifyNote(pc, c);
    const role = mod12(pc - c.root) === 0 ? 'root' : cls.role;
    return `<span class="nchip ${role}" title="${role === 'root' ? 'chord root' : cls.role}">${esc(spelled.notes[i])}
      <small>${esc(cls.name)}</small></span>`;
  }).join('');
  const avoids = pcs.filter((pc) => classifyNote(pc, c).role === 'avoid');
  const avoidTxt = avoids.length
    ? `Avoid notes sit a half step above a chord tone — use them in passing, don’t sustain them.`
    : `No avoid notes over this chord — every non-chord tone is a sustainable tension.`;
  return `<div class="tcard"><h3>Note map · over ${esc(chordSymbol(c))}</h3>
    <p class="muted small">${esc(scaleLabel(sel.root, sel.key))}, note by note — same colors as the neck.</p>
    <div class="nchip-row">${chips}</div><p class="small muted">${avoidTxt}</p></div>`;
}

function modalCard() {
  const match = matchScales(state.chords);
  const { families } = groupFullFits(match.full);
  if (!families.length) return '';
  const fam = families[0];
  const parentName = spellScale(fam.parentRoot, fam.fam.parent).rootName;
  const rows = state.chords.map((c) => {
    const m = fam.modes.find((mm) => mm.root === c.root);
    if (!m) return '';
    return `<li>Over <b>${esc(chordSymbol(c))}</b>, thinking <b>${esc(scaleLabel(m.root, m.key))}</b> keeps the same notes but centers your phrases on the chord of the moment.</li>`;
  }).filter(Boolean).join('');
  if (!rows) return '';
  return `<div class="tcard"><h3>Modal approach</h3>
    <p class="muted small">One parent scale (${esc(parentName)} ${fam.fam.label}) — seven vantage points.</p>
    <ul>${rows}</ul></div>`;
}

function voiceLeadingCard() {
  if (state.chords.length < 2) return '';
  const rows = [];
  for (let i = 0; i < state.chords.length - 1; i++) {
    const a = state.chords[i], b = state.chords[i + 1];
    const vl = voiceLeading(a, b);
    const bits = [];
    if (vl.common.length) bits.push('hold ' + vl.common.join(', '));
    if (vl.moves.length) bits.push('slide ' + vl.moves.join(' · '));
    rows.push(`<li><b>${esc(chordSymbol(a))} → ${esc(chordSymbol(b))}</b>: ${bits.length ? esc(bits.join(' — ')) : 'no shared or half-step tones — a bold leap; let the roots anchor it'}</li>`);
  }
  return `<div class="tcard"><h3>Voice leading</h3>
    <p class="muted small">Common tones to hold, half-step moves to lean into.</p><ul>${rows.join('')}</ul></div>`;
}

function targetsCard() {
  const rows = state.chords.map((c) => {
    const t = targetTones(c).map((x) => `${esc(x.note)} <small class="muted">(${esc(x.deg)})</small>`).join(', ');
    return `<li><b>${esc(chordSymbol(c))}</b>: ${t}</li>`;
  }).join('');
  return `<div class="tcard"><h3>Target tones</h3>
    <p class="muted small">Land phrases on these as each chord arrives — 3rds and 7ths carry the harmony.</p>
    <ul>${rows}</ul></div>`;
}

function arpeggioCard() {
  const c = state.chords[state.focus];
  const ideas = arpeggioIdeas(c).map((a) =>
    `<li><b>${esc(a.label)}</b>: <span class="mono">${esc(a.notes)}</span></li>`).join('');
  return `<div class="tcard"><h3>Arpeggios · ${esc(chordSymbol(c))}</h3><ul>${ideas}</ul>
    <p class="muted small">Click another chord in the progression to switch focus.</p></div>`;
}

/* --- lick generation: ascending run in position 1, resolving to the 3rd --- */
function generateLickSteps() {
  if (!state.selected.length) return null;
  const sel = state.selected[0];
  const c = state.chords[state.focus];
  const win = cagedWindows(sel.root)[0];
  const pcs = new Set(scalePcs(sel.root, sel.key));
  const steps = [];
  for (let st = 5; st >= 1 && steps.length < 10; st--) {
    const frets = [];
    for (let f = win.lo; f <= win.hi; f++) if (pcs.has(mod12(OPEN_MIDI[st] + f))) frets.push(f);
    steps.push(...frets.slice(0, 2).map((f) => [st, f]));
  }
  const thirdPc = mod12(c.root + DEG_SEMITONES[CHORD_TYPES[c.type].degrees[1]]);
  outer:
  for (const st of [1, 0, 2]) {
    for (let f = Math.max(0, win.lo - 1); f <= win.hi + 2; f++) {
      if (mod12(OPEN_MIDI[st] + f) === thirdPc) { steps.push([st, f]); break outer; }
    }
  }
  return steps;
}

function tabFromSteps(steps) {
  const lines = STRING_LABELS.map((l) => l + '|—');
  for (const [st, f] of steps) {
    const w = String(f).length;
    for (let s = 0; s < 6; s++)
      lines[s] += (s === st ? String(f) : '—'.repeat(w)) + '—';
  }
  return lines.map((l) => l + '|').join('\n');
}

function lickCard() {
  const steps = generateLickSteps();
  if (!steps) return '';
  const sel = state.selected[0];
  const c = state.chords[state.focus];
  const third = targetTones(c)[0];
  return `<div class="tcard"><h3>Example line</h3>
    <p class="muted small">${esc(scaleLabel(sel.root, sel.key))} through Position 1, resolving onto ${esc(third.note)} — the ${esc(third.deg)} of ${esc(chordSymbol(c))}.
    <button class="mini-btn" data-action="play-lick">▶ hear it</button></p>
    <pre class="tab mono">${tabFromSteps(steps)}</pre>
    <p class="muted small">Practice idea: keep the same contour but displace the start to each chord in the bar; always resolve onto the arriving chord’s 3rd.</p></div>`;
}

function renderTheory() {
  const why = state.selected.length
    ? `<div class="tcard"><h3>Why these scales fit</h3>${state.selected.map(whyItFits).join('')}</div>`
    : `<div class="tcard"><h3>Why these scales fit</h3><p class="muted">Select a scale to see the chord-by-chord reasoning.</p></div>`;
  $('#theory-panel').innerHTML =
    why + noteMapCard() + targetsCard() + voiceLeadingCard() + modalCard() + arpeggioCard() + lickCard();
}

/* ================= Docked neck ================= */
function currentWindow() {
  if (state.view !== 'caged' || !state.selected.length) return null;
  const wins = cagedWindows(state.selected[0].root);
  const w = wins[state.posIndex % wins.length];
  return { win: [w.lo, w.hi], label: w.label };
}

function currentFilter() {
  if (state.view !== '3nps' || !state.selected.length) return null;
  const sel = state.selected[0];
  const set = threeNPS(sel.root, sel.key, state.posIndex % 7);
  return set ? { set, label: `3NPS pattern ${(state.posIndex % 7) + 1} of 7` } : { set: null, label: '3NPS needs a 7-note scale' };
}

function renderFretboardPanel() {
  const scales = state.selected.map((s) => ({
    key: s.key, rootPc: s.root, spelled: spellScale(s.root, s.key),
  }));
  const winInfo = currentWindow();
  const filtInfo = currentFilter();
  const focusChord = state.chords[state.focus];
  const single = scales.length === 1;

  $('#fret-wrap').innerHTML = renderFretboard({
    scales,
    labelMode: state.labelMode,
    emphasizeRoots: state.emphasizeRoots,
    window: winInfo ? winInfo.win : null,
    filterSet: filtInfo ? filtInfo.set : null,
    customSet: state.view === 'custom' ? state.customSet : null,
    focusChord: single ? focusChord : null,
    focusPcs: !single && scales.length ? new Set(chordPcs(focusChord.root, focusChord.type)) : null,
  });

  const posBox = $('#pos-controls');
  if (state.view === 'caged' || state.view === '3nps') {
    posBox.hidden = false;
    $('#pos-label').textContent = winInfo ? winInfo.label : (filtInfo ? filtInfo.label : '');
  } else posBox.hidden = true;
  $('#clear-custom').hidden = state.view !== 'custom';

  // Legend: one place, function colors, chord named once (critique §4).
  const sym = chordSymbol(focusChord);
  let legend = '';
  if (single) {
    legend =
      `<span class="lg"><i class="swatch" style="background:var(--fn-root)"></i>root of ${esc(sym)}</span>` +
      `<span class="lg"><i class="swatch" style="background:var(--fn-chord)"></i>chord tone</span>` +
      `<span class="lg"><i class="swatch" style="background:var(--fn-scale)"></i>scale tone</span>` +
      `<span class="lg"><i class="swatch" style="background:var(--fn-tension)"></i>tension</span>` +
      `<span class="lg"><i class="swatch" style="background:var(--fn-avoid)"></i>avoid</span>`;
  } else if (scales.length > 1) {
    legend = state.selected.map((s, i) =>
      `<span class="lg"><i class="swatch" style="background:var(--sc${i})"></i>${esc(scaleLabel(s.root, s.key))}</span>`).join('') +
      `<span class="lg"><i class="swatch ring"></i>chord tones of ${esc(sym)}</span>`;
  }
  if (state.view === 'custom')
    legend += `<span class="lg muted">click anywhere on the neck to build your own shape</span>`;
  $('#fret-legend').innerHTML = legend;
}

function syncDock() {
  const dock = $('#neck-dock');
  const inStudio = state.tab === 'studio';
  dock.hidden = !inStudio;
  dock.classList.toggle('collapsed', state.dockCollapsed);
  $('#dock-caret').textContent = state.dockCollapsed ? '▴' : '▾';
  $('#dock-toggle').setAttribute('aria-expanded', String(!state.dockCollapsed));
  document.body.style.paddingBottom = inStudio ? dock.offsetHeight + 24 + 'px' : '';
}

/* ================= Library ================= */
function libraryEntries() {
  const entries = LIBRARY_TOPICS.map((t) => ({ ...t }));
  for (const [key, sc] of Object.entries(SCALES)) {
    const spelled = spellScale(0, key);
    entries.push({
      id: 'scale-' + key, title: sc.name, cat: 'Scales',
      tags: 'scale mode ' + sc.cat + ' ' + sc.degrees.join(' '),
      scaleKey: key,
      body: `<p>${esc(sc.character)}</p><p><b>Use over:</b> ${esc(sc.use)}</p>
        <p class="mono">Formula: ${sc.degrees.join(' ')} · in C: ${spelled.notes.join(' ')}</p>`,
    });
  }
  for (const [key, t] of Object.entries(CHORD_TYPES)) {
    const spelled = spellChord(0, key);
    const scaleNames = (CHORD_SCALE_MAP[key] || []).slice(0, 3).map((k) => SCALES[k].name).join(', ');
    entries.push({
      id: 'chord-' + key, title: t.name + ' chord', cat: 'Chords',
      tags: 'chord ' + t.symbol + ' ' + t.family, chordKey: key,
      body: `<p class="mono">Formula: ${t.degrees.join(' ')} · in C: ${spelled.notes.join(' ')} (C${esc(t.symbol)})</p>
        <p><b>First-call scales:</b> ${esc(scaleNames)}.</p>`,
    });
  }
  return entries;
}

function renderLibrary() {
  const q = state.libQuery.toLowerCase();
  const entries = libraryEntries().filter((e) => {
    if (state.libCat !== 'All' && e.cat !== state.libCat) return false;
    if (!q) return true;
    return (e.title + ' ' + e.tags + ' ' + e.cat + ' ' + e.body).toLowerCase().includes(q);
  });
  const cats = ['All', 'Harmony', 'Progressions', 'Technique', 'Scales', 'Chords'];
  $('#lib-cats').innerHTML = cats.map((c) =>
    `<button class="chip ${state.libCat === c ? 'on' : ''}" data-action="lib-cat" data-cat="${c}">${c}</button>`).join('');

  $('#lib-list').innerHTML = entries.map((e) => {
    let extra = '';
    if (e.scaleKey) {
      extra = `<div class="lib-diagram">${renderFretboard({
        frets: 12, compact: true, interactive: false, idPrefix: 'lib' + e.scaleKey,
        scales: [{ key: e.scaleKey, rootPc: 0, spelled: spellScale(0, e.scaleKey) }],
        labelMode: 'intervals',
      })}</div>
      <div class="lib-actions"><button class="mini-btn" data-action="lib-play-scale" data-key="${e.scaleKey}">▶ Play</button>
      <button class="mini-btn" data-action="lib-view-scale" data-key="${e.scaleKey}">View on neck</button></div>`;
    } else if (e.chordKey) {
      extra = `<div class="lib-diagram">${renderFretboard({
        frets: 12, compact: true, interactive: false, idPrefix: 'libc' + e.chordKey,
        scales: [{ degrees: CHORD_TYPES[e.chordKey].degrees, rootPc: 0, spelled: spellChord(0, e.chordKey) }],
        labelMode: 'intervals',
      })}</div>
      <div class="lib-actions"><button class="mini-btn" data-action="lib-play-chord" data-key="${e.chordKey}">▶ Play</button></div>`;
    } else if (e.prog) {
      const syms = e.prog.map(chordSymbol).join(' – ');
      extra = `<div class="lib-actions"><span class="mono small">${esc(syms)}</span>
        <button class="mini-btn" data-action="lib-load-prog" data-id="${e.id}">Send to Studio →</button></div>`;
    }
    return `<article class="lib-card"><header><h3>${esc(e.title)}</h3><span class="badge">${e.cat}</span></header>
      <div class="lib-body">${e.body}</div>${extra}</article>`;
  }).join('') || '<p class="muted">Nothing matches that search.</p>';
}

/* ================= Master render ================= */
function render() {
  $('#view-studio').hidden = state.tab !== 'studio';
  $('#view-library').hidden = state.tab !== 'library';
  document.querySelectorAll('[data-action="tab"]').forEach((b) =>
    b.classList.toggle('on', b.dataset.tab === state.tab));
  if (state.tab === 'studio') {
    renderProgression();
    const match = renderAnswer();
    renderPerChord(match);
    renderTheory();
    renderFretboardPanel();
  } else {
    renderLibrary();
  }
  syncDock();
  persist();
}

/* ================= Playback visuals ================= */
const SVG_NS = 'http://www.w3.org/2000/svg';

// Expanding ring on a fretboard note (removed when the animation ends).
function pingNote(g, seconds = 0.7) {
  const c = g.querySelector('circle');
  if (!c) return;
  const ring = document.createElementNS(SVG_NS, 'circle');
  ring.setAttribute('cx', c.getAttribute('cx'));
  ring.setAttribute('cy', c.getAttribute('cy'));
  ring.setAttribute('r', String(+c.getAttribute('r') + 2));
  ring.setAttribute('class', 'ping');
  ring.addEventListener('animationend', () => ring.remove());
  g.appendChild(ring);
  g.classList.add('lit');
  setTimeout(() => g.classList.remove('lit'), Math.min(1400, seconds * 1000));
}
function pingChordNotes(chord, seconds) {
  const pcs = new Set(chordPcs(chord.root, chord.type));
  document.querySelectorAll('#fret-wrap g.note').forEach((g) => {
    if (pcs.has(+g.dataset.pc)) pingNote(g, seconds);
  });
}
function pingFret(s, f, seconds) {
  const g = document.querySelector(`#fret-wrap g.note[data-s="${s}"][data-f="${f}"]`);
  if (g) pingNote(g, seconds);
}

function markPlayingCard(idx, seconds) {
  document.querySelectorAll('.chord-card.playing').forEach((el) => el.classList.remove('playing'));
  const card = document.querySelector(`.chord-card[data-idx="${idx}"]`);
  if (!card) return;
  card.style.setProperty('--len', seconds.toFixed(2) + 's');
  card.classList.add('playing');
  const rail = $('#prog-rail');
  const l = card.offsetLeft - rail.offsetLeft;
  if (l < rail.scrollLeft || l + card.offsetWidth > rail.scrollLeft + rail.clientWidth)
    rail.scrollTo({ left: Math.max(0, l - 24), behavior: 'smooth' });
}

function renderBeatDots(active = -1) {
  const n = Player.beats;
  $('#beat-dots').innerHTML = Array.from({ length: n }, (_, b) =>
    `<i class="${b === active ? 'on' : ''}${b === 0 ? ' down' : ''}"></i>`).join('');
}

function syncTransport() {
  const live = Player.playing && Player.mode === 'prog';
  const btn = $('#play-btn');
  btn.classList.toggle('live', live);
  btn.setAttribute('aria-pressed', String(live));
  btn.querySelector('.play-ico').textContent = live ? '■' : '▶';
  $('#play-label').textContent = live ? 'Stop' : (Player.loop ? 'Loop' : 'Play');
  $('#bpm').value = Player.bpm;
  $('#bpm-val').textContent = Player.bpm;
  $('#beats').value = String(Player.beats);
  $('#opt-loop').checked = Player.loop;
  $('#opt-follow').checked = Player.follow;
  $('#vol').value = Math.round(Audio_.volume * 100);
  $('#mute-btn').textContent = Audio_.muted ? '🔇' : (Audio_.volume < 0.4 ? '🔉' : '🔊');
  $('#mute-btn').setAttribute('aria-pressed', String(Audio_.muted));
  $('#vol').classList.toggle('muted', Audio_.muted);
  if (!live) {
    document.querySelectorAll('.chord-card.playing').forEach((el) => el.classList.remove('playing'));
    renderBeatDots(-1);
  }
  document.querySelectorAll('[data-action="play-scale"]').forEach((b) => {
    b.textContent = Player.playing && Player.mode === 'scale' ? '■' : '▶';
  });
  document.querySelectorAll('[data-action="play-lick"]').forEach((b) => {
    b.textContent = Player.playing && Player.mode === 'lick' ? '■ stop' : '▶ hear it';
  });
}

function wirePlayer() {
  Player.onState = syncTransport;
  Player.onChord = (idx, seconds) => {
    if (Player.follow && state.focus !== idx) { state.focus = idx; if (state.tab === 'studio') render(); }
    markPlayingCard(idx, seconds);
    const chord = state.chords[idx];
    if (chord) {
      pingChordNotes(chord, Math.min(seconds, 1.2));
      $('#fret-status').textContent = `Playing ${chordSymbol(chord)} — chord ${idx + 1} of ${state.chords.length}`;
    }
  };
  Player.onBeat = (b) => renderBeatDots(b);
  Player.onNote = (n, seconds) => {
    pingFret(n.s, n.f, Math.min(seconds, 1));
    noteStatus(n.s, n.f);
  };
}

/* ================= Events ================= */
function noteStatus(st, f) {
  const pc = mod12(OPEN_MIDI[st] + f);
  const parts = [`${PC_PREFERRED[pc]} — ${STRING_LABELS[st]} string, fret ${f}`];
  state.selected.forEach((s) => {
    const pcs = scalePcs(s.root, s.key);
    const i = pcs.indexOf(pc);
    if (i >= 0) parts.push(`${SCALES[s.key].degrees[i]} of ${scaleLabel(s.root, s.key)}`);
  });
  const c = state.chords[state.focus];
  const cls = classifyNote(pc, c);
  parts.push(`over ${chordSymbol(c)}: ${cls.name} (${cls.role === 'chord' ? 'chord tone' : cls.role})`);
  $('#fret-status').textContent = parts.join(' · ');
}

function wireEvents() {
  document.addEventListener('click', (ev) => {
    const note = ev.target.closest('g.note.clickable');
    if (note) {
      const st = +note.dataset.s, f = +note.dataset.f;
      if (state.view === 'custom') {
        const key = st + ':' + f;
        if (state.customSet.has(key)) state.customSet.delete(key);
        else state.customSet.add(key);
        renderFretboardPanel();
      }
      Audio_.playFret(st, f);
      pingFret(st, f, 0.8);
      noteStatus(st, f);
      return;
    }
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'tab') { state.tab = el.dataset.tab; render(); }
    else if (a === 'theme') {
      state.theme = { dark: 'light', light: 'auto', auto: 'dark' }[state.theme];
      applyTheme();
      persist();
    }
    else if (a === 'mute') { Audio_.setMuted(!Audio_.muted); syncTransport(); persist(); }
    else if (a === 'add-chord') {
      if (state.chords.length < 12) {
        const last = state.chords[state.chords.length - 1];
        state.chords.push({ root: mod12(last.root + 5), type: last.type });
        state.focus = state.chords.length - 1;
        render();
      }
    }
    else if (a === 'remove-chord') {
      ev.stopPropagation();
      if (state.chords.length > 1) {
        state.chords.splice(+el.dataset.idx, 1);
        state.focus = Math.min(state.focus, state.chords.length - 1);
        render();
      }
    }
    else if (a === 'focus-chord') { state.focus = +el.dataset.idx; render(); }
    else if (a === 'play-chord') {
      ev.stopPropagation();
      const c = state.chords[+el.dataset.idx];
      Audio_.playChord(c);
      pingChordNotes(c, 1.2);
    }
    else if (a === 'play-prog') Player.toggleProgression(() => state.chords);
    else if (a === 'set-root') { state.chords[state.focus].root = +el.dataset.pc; render(); }
    else if (a === 'set-type') { state.chords[state.focus].type = el.dataset.key; render(); }
    else if (a === 'toggle-scale') toggleScale(+el.dataset.root, el.dataset.key);
    else if (a === 'remove-scale') { state.selected.splice(+el.dataset.i, 1); render(); }
    else if (a === 'play-scale') {
      const s = state.selected[+el.dataset.i];
      if (Player.playing && Player.mode === 'scale') Player.stop();
      else Player.playLine(positionScaleRun(s.root, s.key), 'scale', 0.5, 3);
    }
    else if (a === 'play-lick') {
      const steps = generateLickSteps() || [];
      if (Player.playing && Player.mode === 'lick') Player.stop();
      else Player.playLine(steps.map(([s, f]) => ({ s, f, midi: OPEN_MIDI[s] + f, pc: mod12(OPEN_MIDI[s] + f) })), 'lick', 0.5, 4);
    }
    else if (a === 'pos-prev') { state.posIndex = Math.max(0, state.posIndex - 1); renderFretboardPanel(); }
    else if (a === 'pos-next') { state.posIndex += 1; renderFretboardPanel(); }
    else if (a === 'clear-custom') { state.customSet.clear(); renderFretboardPanel(); }
    else if (a === 'dock-toggle') { state.dockCollapsed = !state.dockCollapsed; syncDock(); }
    else if (a === 'lib-cat') { state.libCat = el.dataset.cat; renderLibrary(); }
    else if (a === 'lib-play-scale') Audio_.playScale(0, el.dataset.key);
    else if (a === 'lib-play-chord') Audio_.playChord({ root: 0, type: el.dataset.key });
    else if (a === 'lib-view-scale') {
      if (!isSelected(0, el.dataset.key)) toggleScale(0, el.dataset.key);
      state.tab = 'studio'; render();
      window.scrollTo({ top: 0 });
    }
    else if (a === 'lib-load-prog') {
      const entry = LIBRARY_TOPICS.find((t) => t.id === el.dataset.id);
      if (entry && entry.prog) {
        state.chords = entry.prog.map((c) => ({ ...c }));
        state.focus = 0;
        state.tab = 'studio';
        render();
        window.scrollTo({ top: 0 });
      }
    }
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.id === 'label-mode') { state.labelMode = el.value; renderFretboardPanel(); persist(); }
    else if (el.id === 'view-mode') { state.view = el.value; state.posIndex = 0; renderFretboardPanel(); persist(); }
    else if (el.id === 'opt-roots') { state.emphasizeRoots = el.checked; renderFretboardPanel(); persist(); }
    else if (el.id === 'beats') { Player.beats = +el.value; renderBeatDots(-1); syncTransport(); persist(); }
    else if (el.id === 'opt-loop') { Player.loop = el.checked; syncTransport(); persist(); }
    else if (el.id === 'opt-follow') { Player.follow = el.checked; persist(); }
  });
  document.addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.id === 'bpm') { Player.bpm = +el.value; $('#bpm-val').textContent = Player.bpm; }
    else if (el.id === 'vol') {
      Audio_.setVolume(+el.value / 100);
      if (Audio_.muted && +el.value > 0) Audio_.setMuted(false);
      syncTransport();
    }
  });
  document.addEventListener('pointerup', (ev) => { if (ev.target.id === 'bpm' || ev.target.id === 'vol') persist(); });

  // Keyboard: space plays/stops the progression, Esc stops everything.
  document.addEventListener('keydown', (ev) => {
    const tag = (ev.target.tagName || '').toLowerCase();
    if (['input', 'select', 'textarea'].includes(tag)) return;
    if (ev.code === 'Space' && !ev.repeat && state.tab === 'studio' && !$('#splash')) {
      ev.preventDefault();
      Player.toggleProgression(() => state.chords);
    } else if (ev.key === 'Escape' && Player.playing) {
      Player.stop();
    }
  });

  $('#lib-search').addEventListener('input', (ev) => {
    state.libQuery = ev.target.value;
    renderLibrary();
  });

  if (window.ResizeObserver) new ResizeObserver(syncDock).observe($('#neck-dock'));
}

function applyTheme() {
  const root = document.documentElement;
  if (state.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', state.theme);
  $('#theme-btn').textContent = { auto: '◐ auto', light: '☀ light', dark: '● dark' }[state.theme];
}

/* Splash: ported from the user's Claude Design canvas. Pluckable
   glowing strings, cycling chord chips, strum, Enter → Studio. */
function wireSplash() {
  const splash = $('#splash');
  if (!splash) return;
  const NAMES = ['e', 'B', 'G', 'D', 'A', 'E'];
  const amps = [0, 0, 0, 0, 0, 0];
  let raf = null, cycle = null;

  // Fret lines + inlay markers
  const N = 13;
  const fretsBox = splash.querySelector('.sp-frets');
  for (let i = 1; i <= N; i++) {
    const d = document.createElement('div');
    d.className = 'sp-fret';
    d.style.left = (i * 100) / (N + 1) + '%';
    fretsBox.appendChild(d);
  }
  const mBox = splash.querySelector('.sp-markers');
  const marks = [3, 5, 7, 9].map((n) => [((n + 0.5) * 100) / (N + 1), 'calc(50% - 5px)']);
  marks.push([(12.5 * 100) / (N + 1), 'calc(33.3% - 5px)']);
  for (const [pct, top] of marks) {
    const d = document.createElement('div');
    d.className = 'sp-marker';
    d.style.left = `calc(${pct}% - 5px)`;
    d.style.top = top;
    mBox.appendChild(d);
  }

  // Strings
  const sBox = splash.querySelector('.sp-strings');
  const glows = [];
  for (let i = 0; i < 6; i++) {
    const row = document.createElement('div');
    row.className = 'sp-string';
    row.style.height = 100 / 6 + '%';
    row.style.top = (i * 100) / 6 + '%';
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', 'Pluck ' + NAMES[i] + ' string');
    row.innerHTML = `<div class="sp-line"><div class="sp-line-base" style="transform:scaleY(${(1 + (5 - i) * 0.55).toFixed(2)})"></div><div class="sp-line-glow"></div></div><span class="sp-string-label">${NAMES[i]}</span>`;
    row.addEventListener('click', () => pluck(i, 1));
    sBox.appendChild(row);
    glows.push(row.querySelector('.sp-line-glow'));
  }
  function paint() {
    amps.forEach((a, i) => {
      glows[i].style.opacity = a.toFixed(3);
      glows[i].style.transform = `scaleY(${(1 + a * 2.6).toFixed(2)})`;
    });
  }
  function decay() {
    cancelAnimationFrame(raf);
    const step = () => {
      let alive = false;
      for (let i = 0; i < 6; i++) {
        amps[i] = amps[i] > 0.004 ? amps[i] * 0.94 : 0;
        if (amps[i] > 0) alive = true;
      }
      paint();
      if (alive) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function hit(i, level) { amps[i] = Math.min(1, level == null ? 1 : level); paint(); decay(); }
  function pluckAudio(i, level) {
    try {
      // Same physical string model as the studio: open string i, let it ring.
      Audio_.pluck(OPEN_MIDI[i], 0, 2.4, 0.55 + 0.4 * (level == null ? 1 : level), { pan: (2.5 - i) * 0.18 });
    } catch (e) { /* audio optional */ }
  }
  function pluck(i, level) { hit(i, level); pluckAudio(i, level); }
  function strum() {
    [5, 4, 3, 2, 1, 0].forEach((i, k) => setTimeout(() => pluck(i, 0.9 - k * 0.06), k * 68));
    $('#strum-label').textContent = 'Strum again';
  }

  // Title letters
  const titleBox = $('#sp-title');
  'Fretwork'.split('').forEach((ch, i) => {
    const s = document.createElement('span');
    s.className = 'sp-letter' + (i === 0 ? ' accent' : '');
    s.textContent = ch;
    s.style.animationDelay = 0.18 + i * 0.065 + 's';
    titleBox.appendChild(s);
  });
  titleBox.insertAdjacentHTML('beforeend', '<span class="sp-space"></span><span class="sp-caret"></span>');

  // Chord chips
  const CHORDS = [
    { name: 'Dm7', notes: 'D F A C', strings: [3, 2, 1, 0] },
    { name: 'G7', notes: 'G B D F', strings: [4, 3, 2, 1] },
    { name: 'Cmaj7', notes: 'C E G B', strings: [4, 3, 2, 0] },
  ];
  const chipsBox = $('#sp-chords');
  const chipEls = [];
  let active = 2;
  const setActive = (i) => {
    active = i;
    chipEls.forEach((el, k) => el.classList.toggle('on', k === i));
  };
  CHORDS.forEach((c, i) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sp-chip';
    chip.innerHTML = `<span class="nm">${c.name}</span><span class="nt">${c.notes}</span>`;
    chip.addEventListener('click', () => {
      setActive(i);
      c.strings.forEach((s, k) => setTimeout(() => pluck(s, 0.85), k * 80));
    });
    chipsBox.appendChild(chip);
    chipEls.push(chip);
    if (i < CHORDS.length - 1)
      chipsBox.insertAdjacentHTML('beforeend', '<span class="sp-chord-arrow">→</span>');
  });
  setActive(2);
  cycle = setInterval(() => setActive((active + 1) % 3), 2200);

  // Ambient intro: silent visual plucks after load
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    [1, 3, 5].forEach((i, k) => setTimeout(() => hit(i, 0.55), 1400 + k * 260));

  $('#strum-btn').addEventListener('click', strum);
  $('#enter-btn').addEventListener('click', () => {
    strum(); // the click gesture unlocks audio; ride the strum in
    splash.classList.add('gone');
    setTimeout(() => {
      clearInterval(cycle);
      cancelAnimationFrame(raf);
      splash.remove();
    }, 800);
  });
}

/* ================= Init ================= */
state.dockCollapsed = window.innerWidth < 700;
restore();
wireEvents();
wirePlayer();
wireSplash();
applyTheme();
render();
renderBeatDots(-1);
syncTransport();
