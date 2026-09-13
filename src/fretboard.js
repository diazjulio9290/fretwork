/* ============================================================
   Fretwork — fretboard rendering
   Pure SVG-string generation. Strings drawn player-diagram style:
   high e on top. sIdx 0 = high e … 5 = low E.
   ============================================================ */

const OPEN_MIDI = [64, 59, 55, 50, 45, 40]; // e B G D A E
const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];
const INLAY_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
const DOUBLE_INLAYS = [12, 24];

// Gently tapered fret spacing (real spacing reads cramped past fret 15)
function fretX(f, frets, width, nutX) {
  const raw = (n) => 1 - Math.pow(2, -n / 26);
  return nutX + (raw(f) / raw(frets)) * (width - nutX);
}

function pieSlice(cx, cy, r, a0, a1) {
  const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${cx},${cy} L${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
}

// Semantic note-function color: root / chord tone / scale tone /
// tension / avoid, judged against the focused chord (design critique §4).
function fnColor(pc, chord) {
  const cls = classifyNote(pc, chord);
  if (mod12(pc - chord.root) === 0) return { fill: 'var(--fn-root)', text: '#fdf6ea' };
  if (cls.role === 'chord') return { fill: 'var(--fn-chord)', text: '#241a0c' };
  if (cls.role === 'avoid') return { fill: 'var(--fn-avoid)', text: '#241a0c' };
  if (['♭9', '♯9', '♯11', '♭13'].includes(cls.name)) return { fill: 'var(--fn-tension)', text: '#f4effc' };
  return { fill: 'var(--fn-scale)', text: '#eef7f3' };
}

function renderFretboard(opts) {
  const {
    frets = 24, compact = false, scales = [], labelMode = 'names',
    emphasizeRoots = true, window: win = null, customSet = null,
    filterSet = null, focusPcs = null, focusChord = null,
    interactive = true, idPrefix = 'fb',
  } = opts;

  const rowH = compact ? 20 : 27;
  const top = compact ? 12 : 18;
  const nutX = compact ? 26 : 46;
  const W = compact ? 560 : 1440;
  const H = top + rowH * 5 + (compact ? 26 : 46);
  const r = compact ? 7.5 : 11;
  const boardTop = top - rowH / 2 - 2;
  const boardH = rowH * 5 + rowH + 4;
  const stringY = (s) => top + s * rowH + rowH / 2;

  const primary = scales[0] || null;
  const multi = scales.length > 1;

  // pc → membership list [{scaleIdx, degree}]
  const membership = new Map();
  scales.forEach((sc, i) => {
    (sc.degrees || SCALES[sc.key].degrees).forEach((deg, di) => {
      const pc = mod12(sc.rootPc + DEG_SEMITONES[deg]);
      if (!membership.has(pc)) membership.set(pc, []);
      membership.get(pc).push({ scaleIdx: i, degree: deg, note: sc.spelled.notes[di] });
    });
  });

  let s = `<svg class="fb${compact ? ' fb-compact' : ''}" viewBox="0 0 ${W} ${H}" width="100%" ` +
    `xmlns="http://www.w3.org/2000/svg" font-family="'Spline Sans Mono',ui-monospace,monospace" role="img" aria-label="Guitar fretboard diagram">`;
  s += `<defs>
    <linearGradient id="${idPrefix}wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4d3322"/><stop offset="0.5" stop-color="#3b2718"/><stop offset="1" stop-color="#2c1c10"/>
    </linearGradient>
    <linearGradient id="${idPrefix}fret" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e2d4ab"/><stop offset="0.5" stop-color="#9a8253"/><stop offset="1" stop-color="#6e5c3c"/>
    </linearGradient>
  </defs>`;

  // Board, nut, frets, inlays
  s += `<rect x="${nutX - 2}" y="${boardTop}" width="${W - nutX - 2}" height="${boardH}" rx="4" fill="url(#${idPrefix}wood)"/>`;
  s += `<rect x="${nutX - 4}" y="${boardTop}" width="6" height="${boardH}" rx="2" fill="#e7ddc4"/>`;
  for (let f = 1; f <= frets; f++) {
    const x = fretX(f, frets, W - 6, nutX);
    s += `<rect x="${(x - 1.2).toFixed(1)}" y="${boardTop + 1}" width="2.4" height="${boardH - 2}" fill="url(#${idPrefix}fret)"/>`;
  }
  const inlayY = top + 2 * rowH + rowH / 2 + rowH / 2;
  for (let f = 1; f <= frets; f++) {
    const cx = (fretX(f - 1, frets, W - 6, nutX) + fretX(f, frets, W - 6, nutX)) / 2;
    if (INLAY_FRETS.includes(f))
      s += `<circle cx="${cx.toFixed(1)}" cy="${inlayY}" r="${compact ? 4 : 6}" fill="#e9e2cf" opacity="0.5"/>`;
    if (DOUBLE_INLAYS.includes(f)) {
      s += `<circle cx="${cx.toFixed(1)}" cy="${stringY(1)}" r="${compact ? 4 : 6}" fill="#e9e2cf" opacity="0.5"/>`;
      s += `<circle cx="${cx.toFixed(1)}" cy="${stringY(4)}" r="${compact ? 4 : 6}" fill="#e9e2cf" opacity="0.5"/>`;
    }
  }

  // Position window shading
  if (win) {
    const x0 = fretX(Math.max(win[0] - 1, 0), frets, W - 6, nutX);
    const x1 = fretX(Math.min(win[1], frets), frets, W - 6, nutX);
    s += `<rect x="${x0.toFixed(1)}" y="${boardTop}" width="${(x1 - x0).toFixed(1)}" height="${boardH}" fill="#f5d78a" opacity="0.13"/>`;
    s += `<rect x="${x0.toFixed(1)}" y="${boardTop}" width="${(x1 - x0).toFixed(1)}" height="${boardH}" fill="none" stroke="#d9a84e" stroke-width="1.6" rx="3" opacity="0.75"/>`;
  }

  // Strings
  for (let st = 0; st < 6; st++) {
    const w = [1, 1.15, 1.4, 1.9, 2.5, 3.1][st] * (compact ? 0.8 : 1);
    s += `<line x1="${nutX - 4}" y1="${stringY(st)}" x2="${W - 4}" y2="${stringY(st)}" stroke="#cdbfa2" stroke-width="${w}" opacity="0.85"/>`;
    s += `<text x="${nutX - (compact ? 14 : 24)}" y="${stringY(st) + 3.5}" font-size="${compact ? 9 : 11}" fill="var(--muted)" text-anchor="middle">${STRING_LABELS[st]}</text>`;
  }

  // Fret numbers: every fret on the full neck, with the inlay frets
  // (3 5 7 9 12 …) set bolder so the eye can land on them from a distance.
  // Compact library diagrams keep just the inlay frets.
  const numY = boardTop + boardH + (compact ? 12 : 21);
  const landmarks = [...INLAY_FRETS, ...DOUBLE_INLAYS];
  for (let f = 1; f <= frets; f++) {
    const landmark = landmarks.includes(f);
    if (compact && !landmark) continue;
    const cx = (fretX(f - 1, frets, W - 6, nutX) + fretX(f, frets, W - 6, nutX)) / 2;
    if (compact) {
      s += `<text x="${cx.toFixed(1)}" y="${numY}" font-size="8.5" fill="var(--muted)" text-anchor="middle">${f}</text>`;
    } else if (landmark) {
      s += `<text x="${cx.toFixed(1)}" y="${numY}" font-size="13.5" font-weight="700" fill="var(--ink)" text-anchor="middle">${f}</text>`;
    } else {
      s += `<text x="${cx.toFixed(1)}" y="${numY}" font-size="10.5" fill="var(--muted)" text-anchor="middle" opacity="0.8">${f}</text>`;
    }
  }

  // Note markers
  for (let st = 0; st < 6; st++) {
    for (let f = 0; f <= frets; f++) {
      const pc = mod12(OPEN_MIDI[st] + f);
      const mem = membership.get(pc) || [];
      const key = st + ':' + f;
      const isCustom = customSet && customSet.has(key);
      if (!mem.length && !isCustom) continue;

      const x = f === 0
        ? nutX + (compact ? 8 : 12)
        : (fretX(f - 1, frets, W - 6, nutX) + fretX(f, frets, W - 6, nutX)) / 2;
      const y = stringY(st);

      const inWindow = !win || (f >= win[0] && f <= win[1]);
      const guideOnly = customSet && !isCustom;           // custom view: scale notes are dim guides
      const outOfPattern = filterSet && !filterSet.has(key);
      const dim = (win && !inWindow) || guideOnly || outOfPattern;
      const opacity = dim ? 0.22 : 1;

      const isRoot = primary && !isCustom && mem.some((m) => m.scaleIdx === 0) && pc === primary.rootPc;
      const rr = isRoot && emphasizeRoots ? r + (compact ? 1.5 : 2.5) : r;

      let g = `<g class="note${interactive ? ' clickable' : ''}" data-s="${st}" data-f="${f}" data-pc="${pc}" opacity="${opacity}">`;

      let textFill = '#fdf9f0';
      if (isCustom && !mem.length) {
        g += `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--surface2)" stroke="var(--accent)" stroke-width="2" stroke-dasharray="3 2.4"/>`;
        textFill = 'var(--ink)';
      } else if (multi && mem.length > 1) {
        const k = mem.length;
        mem.forEach((m, i) => {
          const a0 = -Math.PI / 2 + (i / k) * 2 * Math.PI;
          const a1 = -Math.PI / 2 + ((i + 1) / k) * 2 * Math.PI;
          g += `<path d="${pieSlice(x, y, rr, a0, a1)}" fill="var(--sc${m.scaleIdx})"/>`;
        });
        g += `<circle cx="${x}" cy="${y}" r="${rr}" fill="none" stroke="#1d140c" stroke-width="1" opacity="0.5"/>`;
      } else {
        const m = mem[0];
        let fill;
        if (multi) fill = `var(--sc${m.scaleIdx})`;
        else if (focusChord) {
          const fn = fnColor(pc, focusChord);
          fill = fn.fill;
          textFill = fn.text;
        } else fill = `var(--deg${degreeNumber(m.degree)})`;
        g += `<circle cx="${x}" cy="${y}" r="${rr}" fill="${fill}" stroke="#1d140c" stroke-width="1" ${isCustom ? 'stroke-dasharray="3 2.4"' : ''}/>`;
      }

      if (isRoot && emphasizeRoots)
        g += `<circle cx="${x}" cy="${y}" r="${rr + 2}" fill="none" stroke="#f3ead6" stroke-width="1.8"/>`;
      if (focusPcs && focusPcs.has(pc) && !dim)
        g += `<circle cx="${x}" cy="${y}" r="${rr + (isRoot && emphasizeRoots ? 5 : 3.5)}" fill="none" stroke="var(--ring)" stroke-width="1.4" stroke-dasharray="2.5 2"/>`;

      // Label
      let label = '';
      const m0 = mem.find((m) => m.scaleIdx === 0) || mem[0];
      if (labelMode === 'names') label = m0 ? m0.note : PC_PREFERRED[pc];
      else if (labelMode === 'intervals' && m0) label = m0.degree;
      else if (labelMode === 'degrees' && m0) label = String(degreeNumber(m0.degree));
      if (isCustom && !mem.length) label = labelMode === 'none' ? '' : PC_PREFERRED[pc];
      if (label)
        g += `<text x="${x}" y="${y + (compact ? 2.6 : 3.4)}" font-size="${compact ? 7.5 : (label.length > 2 ? 8 : 9.5)}" fill="${textFill}" text-anchor="middle" font-weight="600">${label}</text>`;
      g += '</g>';
      s += g;
    }
  }

  s += '</svg>';
  return s;
}

/* ---------- CAGED position windows ---------- */
function cagedWindows(rootPc) {
  const f6 = mod12(rootPc - 4);  // root fret on low E (and high e)
  const f5 = mod12(rootPc - 9);  // root fret on A string
  const f4 = mod12(rootPc - 2);  // root fret on D string
  const raw = [
    { name: 'E shape', lo: f6 },
    { name: 'D shape', lo: f4 },
    { name: 'C shape', lo: f5 - 3 },
    { name: 'A shape', lo: f5 },
    { name: 'G shape', lo: f6 - 3 },
  ].map((w) => {
    let lo = w.lo;
    while (lo < 0) lo += 12;
    return { name: w.name, lo, hi: lo + 4 };
  });
  raw.sort((a, b) => a.lo - b.lo);
  return raw.map((w, i) => ({ ...w, label: `Position ${i + 1} · ${w.name}` }));
}

/* ---------- Three-note-per-string patterns ----------
   Only defined for 7-note scales. patternIdx 0–6 = start on each
   scale degree found ascending on the low E string. */
function threeNPS(rootPc, scaleKey, patternIdx) {
  const pcsSet = new Set(scalePcs(rootPc, scaleKey));
  if (pcsSet.size !== 7) return null;
  const strings = [5, 4, 3, 2, 1, 0]; // low E → high e
  const lowOpen = OPEN_MIDI[5];
  const startFrets = [];
  for (let f = 0; f <= 24 && startFrets.length < 7; f++)
    if (pcsSet.has(mod12(lowOpen + f))) startFrets.push(f);
  const startPitch = lowOpen + startFrets[patternIdx % startFrets.length];

  const set = new Set();
  let nextPitch = startPitch;
  for (const st of strings) {
    const open = OPEN_MIDI[st];
    // first scale pitch on this string at or above nextPitch
    let p = Math.max(nextPitch, open);
    while (!pcsSet.has(mod12(p)) || p < open) p++;
    for (let i = 0; i < 3; i++) {
      const fret = p - open;
      if (fret > 24) return set;
      set.add(st + ':' + fret);
      p++;
      while (!pcsSet.has(mod12(p))) p++;
    }
    nextPitch = p;
  }
  return set;
}
