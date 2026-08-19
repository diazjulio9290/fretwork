/* ============================================================
   Fretwork — UI layer
   Single state object, full re-render per section on change,
   event delegation via data-action attributes.
   ============================================================ */

const state = {
  tab: 'studio',
  theme: 'auto', // auto | light | dark
  chords: [
    { root: 2, type: 'min7' },
    { root: 7, type: 'dom7' },
    { root: 0, type: 'maj7' },
  ],
  focus: 0,
  selected: [{ root: 0, key: 'ionian' }], // up to 4 {root, key}
  labelMode: 'names',
  emphasizeRoots: true,
  ringChordTones: true,
  view: 'full', // full | caged | 3nps | custom
  posIndex: 0,
  customSet: new Set(),
  libQuery: '',
  libCat: 'All',
};

const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const scaleId = (s) => s.root + ':' + s.key;
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
function renderProgression() {
  const rail = $('#prog-rail');
  rail.innerHTML = state.chords.map((c, i) => {
    const sym = chordSymbol(c);
    const spelled = spellChord(c.root, c.type);
    const rootOpts = ROOT_CHOICES.map((r) =>
      `<option value="${r.pc}" ${r.pc === c.root ? 'selected' : ''}>${r.label}</option>`).join('');
    const typeOpts = Object.entries(CHORD_TYPES).map(([k, t]) =>
      `<option value="${k}" ${k === c.type ? 'selected' : ''}>${t.name}</option>`).join('');
    return `<div class="chord-card ${i === state.focus ? 'focused' : ''}" data-action="focus-chord" data-idx="${i}">
      <div class="chord-sym" data-action="play-chord" data-idx="${i}" title="Play chord">${esc(sym)}</div>
      <div class="chord-notes mono">${spelled.notes.join(' ')}</div>
      <div class="chord-selects">
        <select data-role="chord-root" data-idx="${i}" aria-label="Chord root">${rootOpts}</select>
        <select data-role="chord-type" data-idx="${i}" aria-label="Chord type">${typeOpts}</select>
      </div>
      <button class="chord-remove" data-action="remove-chord" data-idx="${i}" ${state.chords.length <= 2 ? 'disabled' : ''} aria-label="Remove chord">×</button>
    </div>`;
  }).join('<div class="chord-arrow">→</div>');
  $('#add-chord').disabled = state.chords.length >= 12;
  $('#prog-count').textContent = state.chords.length + ' chords';
}

/* ================= Scale suggestions ================= */
function chipFor(root, key, extra = '') {
  const on = isSelected(root, key);
  return `<button class="chip ${on ? 'on' : ''}" data-action="toggle-scale" data-root="${root}" data-key="${key}">
    ${esc(scaleLabel(root, key))}${extra}</button>`;
}

function renderSuggestions() {
  const match = matchScales(state.chords);
  const { families, singles } = groupFullFits(match.full);
  const n = state.chords.length;

  let html = '';
  if (!match.full.length) {
    const allDominant = state.chords.every((c) => CHORD_TYPES[c.type].family === 'dominant');
    if (allDominant) {
      const r = state.chords[0].root;
      html += `<div class="fam-card"><div class="fam-head"><b>The blues answer</b>
        <span class="badge">convention beats theory</span></div>
        <p class="muted small">All-dominant progressions never share one scale — that clash <i>is</i> the blues.
        By convention, the minor pentatonic/blues scale of the I chord plays over everything;
        the ♭3-against-major-3rd rub is the blue note.</p>
        <div class="chip-row">${chipFor(r, 'minBlues')}${chipFor(r, 'minPent')}${chipFor(r, 'majBlues')}${chipFor(r, 'mixolydian')}</div>
      </div>`;
    } else {
      html += `<p class="muted">No single scale contains every chord — this progression modulates.
        Use the per-chord suggestions below and switch scales as the chords change.</p>`;
    }
  }
  for (const fam of families.slice(0, 4)) {
    const parentName = spellScale(fam.parentRoot, fam.fam.parent).rootName;
    html += `<div class="fam-card">
      <div class="fam-head"><b>${esc(parentName)} ${fam.fam.label}</b>
        <span class="badge">fits all ${n}</span></div>
      <div class="chip-row">${fam.modes.map((m) => chipFor(m.root, m.key)).join('')}</div>
    </div>`;
  }
  const singlesShown = singles.slice(0, 14);
  if (singlesShown.length) {
    html += `<div class="fam-card"><div class="fam-head"><b>Other full fits</b>
      <span class="badge">fits all ${n}</span></div>
      <div class="chip-row">${singlesShown.map((e) => chipFor(e.root, e.key)).join('')}</div></div>`;
  }
  $('#sugg-full').innerHTML = html;

  // Near fits
  const nearBox = $('#sugg-near');
  if (match.near.length) {
    nearBox.hidden = false;
    const items = match.near.slice(0, 10).map((e) => {
      const clash = state.chords.filter((_, i) => !e.fits[i]).map(chordSymbol).join(', ');
      return chipFor(e.root, e.key, ` <small>clashes: ${esc(clash)}</small>`);
    }).join('');
    nearBox.querySelector('div').innerHTML = `<div class="chip-row">${items}</div>`;
  } else nearBox.hidden = true;

  // Per-chord
  $('#sugg-perchord').innerHTML = '<h3>Chord-by-chord choices</h3>' + state.chords.map((c, i) => {
    const chips = match.perChord[i].map((s) =>
      chipFor(s.root, s.key, ` <small>${Math.round(s.overlap * 100)}% in context</small>`)).join('');
    return `<div class="perchord-row"><span class="pc-label mono">${esc(chordSymbol(c))}</span>
      <div class="chip-row">${chips}</div></div>`;
  }).join('');

  // Selected scales
  $('#selected-scales').innerHTML = state.selected.length
    ? '<h3>On the neck now</h3><div class="sel-row">' + state.selected.map((s, i) => {
      const multi = state.selected.length > 1;
      const sw = multi ? `style="background:var(--sc${i})"` : `style="background:var(--deg1)"`;
      return `<span class="sel-pill"><i class="swatch" ${sw}></i>${esc(scaleLabel(s.root, s.key))}
        <button data-action="play-scale" data-i="${i}" title="Play scale">▶</button>
        <button data-action="remove-scale" data-i="${i}" aria-label="Remove">×</button></span>`;
    }).join('') + '</div>'
    : '<p class="muted">Pick one or more scales above to light up the neck (up to 4 overlay together).</p>';
}

/* ================= Theory panel ================= */
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
    return `<span class="nchip ${cls.role}" title="${cls.role}">${esc(spelled.notes[i])}
      <small>${esc(cls.name)}</small></span>`;
  }).join('');
  const avoids = pcs.filter((pc) => classifyNote(pc, c).role === 'avoid');
  const avoidTxt = avoids.length
    ? `Avoid notes sit a half step above a chord tone — use them in passing, don’t sustain them.`
    : `No avoid notes over this chord — every non-chord tone is a sustainable tension.`;
  return `<div class="tcard"><h3>Note map · over ${esc(chordSymbol(c))}</h3>
    <p class="muted small">${esc(scaleLabel(sel.root, sel.key))}, note by note. Solid = chord tone, outlined = tension, struck = avoid.</p>
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
    ? `<div class="tcard wide"><h3>Why these scales fit</h3>${state.selected.map(whyItFits).join('')}</div>`
    : `<div class="tcard wide"><h3>Why these scales fit</h3><p class="muted">Select a scale to see the chord-by-chord reasoning.</p></div>`;
  $('#theory-panel').innerHTML =
    why + noteMapCard() + targetsCard() + voiceLeadingCard() + modalCard() + arpeggioCard() + lickCard();
}

/* ================= Fretboard section ================= */
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
  const scales = state.selected.map((s, i) => ({
    key: s.key, rootPc: s.root, spelled: spellScale(s.root, s.key),
  }));
  const winInfo = currentWindow();
  const filtInfo = currentFilter();
  const focusChord = state.chords[state.focus];

  $('#fret-wrap').innerHTML = renderFretboard({
    scales,
    labelMode: state.labelMode,
    emphasizeRoots: state.emphasizeRoots,
    window: winInfo ? winInfo.win : null,
    filterSet: filtInfo ? filtInfo.set : null,
    customSet: state.view === 'custom' ? state.customSet : null,
    focusPcs: state.ringChordTones ? new Set(chordPcs(focusChord.root, focusChord.type)) : null,
  });

  const posBox = $('#pos-controls');
  if (state.view === 'caged' || state.view === '3nps') {
    posBox.hidden = false;
    $('#pos-label').textContent = winInfo ? winInfo.label : (filtInfo ? filtInfo.label : '');
  } else posBox.hidden = true;
  $('#clear-custom').hidden = state.view !== 'custom';

  // Legend
  let legend = '';
  if (state.selected.length > 1) {
    legend = state.selected.map((s, i) =>
      `<span class="lg"><i class="swatch" style="background:var(--sc${i})"></i>${esc(scaleLabel(s.root, s.key))}</span>`).join('');
  } else if (state.selected.length === 1) {
    const degs = [...new Set(SCALES[state.selected[0].key].degrees.map(degreeNumber))];
    legend = degs.map((d) =>
      `<span class="lg"><i class="swatch" style="background:var(--deg${d})"></i>${d === 1 ? 'root' : 'degree ' + d}</span>`).join('');
  }
  if (state.ringChordTones)
    legend += `<span class="lg"><i class="swatch ring"></i>chord tones of ${esc(chordSymbol(focusChord))}</span>`;
  if (state.view === 'custom')
    legend += `<span class="lg muted">click anywhere on the neck to build your own shape</span>`;
  $('#fret-legend').innerHTML = legend;
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
    renderSuggestions();
    renderTheory();
    renderFretboardPanel();
  } else {
    renderLibrary();
  }
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
      noteStatus(st, f);
      return;
    }
    const el = ev.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;
    if (a === 'tab') { state.tab = el.dataset.tab; render(); }
    else if (a === 'theme') {
      state.theme = { auto: 'light', light: 'dark', dark: 'auto' }[state.theme];
      applyTheme();
    }
    else if (a === 'add-chord') {
      if (state.chords.length < 12) {
        const last = state.chords[state.chords.length - 1];
        state.chords.push({ root: mod12(last.root + 5), type: last.type });
        render();
      }
    }
    else if (a === 'remove-chord') {
      ev.stopPropagation();
      if (state.chords.length > 2) {
        state.chords.splice(+el.dataset.idx, 1);
        state.focus = Math.min(state.focus, state.chords.length - 1);
        render();
      }
    }
    else if (a === 'focus-chord') { state.focus = +el.dataset.idx; render(); }
    else if (a === 'play-chord') { ev.stopPropagation(); Audio_.playChord(state.chords[+el.dataset.idx]); }
    else if (a === 'play-prog') Audio_.playProgression(state.chords);
    else if (a === 'toggle-scale') toggleScale(+el.dataset.root, el.dataset.key);
    else if (a === 'remove-scale') { state.selected.splice(+el.dataset.i, 1); render(); }
    else if (a === 'play-scale') { const s = state.selected[+el.dataset.i]; Audio_.playScale(s.root, s.key); }
    else if (a === 'play-lick') {
      const steps = generateLickSteps() || [];
      steps.forEach(([st, f], i) => Audio_.pluck(OPEN_MIDI[st] + f, i * 0.24, 0.7, 0.85));
    }
    else if (a === 'pos-prev') { state.posIndex = Math.max(0, state.posIndex - 1); renderFretboardPanel(); }
    else if (a === 'pos-next') { state.posIndex += 1; renderFretboardPanel(); }
    else if (a === 'clear-custom') { state.customSet.clear(); renderFretboardPanel(); }
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
    const role = el.dataset.role;
    if (role === 'chord-root') { state.chords[+el.dataset.idx].root = +el.value; render(); }
    else if (role === 'chord-type') { state.chords[+el.dataset.idx].type = el.value; render(); }
    else if (el.id === 'label-mode') { state.labelMode = el.value; renderFretboardPanel(); }
    else if (el.id === 'view-mode') { state.view = el.value; state.posIndex = 0; renderFretboardPanel(); }
    else if (el.id === 'opt-roots') { state.emphasizeRoots = el.checked; renderFretboardPanel(); }
    else if (el.id === 'opt-rings') { state.ringChordTones = el.checked; renderFretboardPanel(); }
  });

  $('#lib-search').addEventListener('input', (ev) => {
    state.libQuery = ev.target.value;
    renderLibrary();
  });
}

function applyTheme() {
  const root = document.documentElement;
  if (state.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', state.theme);
  $('#theme-btn').textContent = { auto: '◐ auto', light: '☀ light', dark: '● dark' }[state.theme];
}

/* ================= Init ================= */
/* Splash: ported from the user's Claude Design canvas. Pluckable
   glowing strings, cycling chord chips, strum, Enter → Studio. */
function wireSplash() {
  const splash = $('#splash');
  if (!splash) return;
  const FREQS = [329.63, 246.94, 196.0, 146.83, 110.0, 82.41];
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
      const ctx = Audio_.get();
      const t = ctx.currentTime;
      const f = FREQS[i];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16 * (level || 1), t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2600, t);
      lp.frequency.exponentialRampToValueAtTime(700, t + 1.6);
      [[1, 1], [2, 0.32], [3, 0.14]].forEach(([mult, amp]) => {
        const o = ctx.createOscillator();
        o.type = mult === 1 ? 'triangle' : 'sine';
        o.frequency.value = f * mult;
        const og = ctx.createGain();
        og.gain.value = amp;
        o.connect(og).connect(lp);
        o.start(t);
        o.stop(t + 2.3);
      });
      lp.connect(g).connect(Audio_.master);
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

wireEvents();
wireSplash();
applyTheme();
render();
