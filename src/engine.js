/* ============================================================
   Fretwork — harmony engine
   Pure functions over the theory data. No DOM access here.
   ============================================================ */

const mod12 = (n) => ((n % 12) + 12) % 12;

function degreeNumber(deg) { return parseInt(deg.replace(/[^0-9]/g, ''), 10); }

function scalePcs(rootPc, scaleKey) {
  return SCALES[scaleKey].degrees.map((d) => mod12(rootPc + DEG_SEMITONES[d]));
}
function chordPcs(rootPc, typeKey) {
  return CHORD_TYPES[typeKey].degrees.map((d) => mod12(rootPc + DEG_SEMITONES[d]));
}

/* ---------- Spelling ---------- */
// Spell one degree relative to a named root, using letter arithmetic
// so F♯ major yields E♯, not F.
// pragmatic=true swaps theoretically-correct-but-awkward names
// (F♭, B♯, double accidentals) for their everyday equivalents —
// used for chord symbols, where B♭m7♭5 beats A♯m7♭5.
function spellDegree(rootName, rootPc, deg, pragmatic = false) {
  const rootLetter = rootName[0];
  const li = LETTERS.indexOf(rootLetter);
  const n = degreeNumber(deg);
  const letter = LETTERS[(li + n - 1) % 7];
  const target = mod12(rootPc + DEG_SEMITONES[deg]);
  const diff = mod12(target - LETTER_PCS[letter]);
  const acc = { 0: '', 1: '♯', 2: '𝄪', 11: '♭', 10: '𝄫' }[diff];
  const out = acc === undefined ? PC_PREFERRED[target] : letter + acc;
  if (pragmatic && (/[𝄪𝄫]/.test(out) || ['E♯', 'B♯', 'C♭', 'F♭'].includes(out)))
    return PC_PREFERRED[target];
  return out;
}

// Choose the root spelling (sharp vs flat name) that spells the
// whole degree set with the fewest ugly accidentals.
function bestRootName(rootPc, degrees, pragmatic = false) {
  const candidates = [...new Set([PC_SHARP[rootPc], PC_FLAT[rootPc]])];
  const preferred = PC_PREFERRED[rootPc];
  const cost = (name) => degrees.reduce((sum, d) => {
    const s = spellDegree(name, rootPc, d, pragmatic);
    if (/[𝄪𝄫]/.test(s)) return sum + 3;
    if (['E♯', 'B♯', 'C♭', 'F♭'].includes(s)) return sum + 2;
    if (/[♯♭]/.test(s)) return sum + 1;
    return sum;
  }, 0) + (name === preferred ? 0 : 0.1);
  candidates.sort((a, b) => cost(a) - cost(b));
  return candidates[0];
}

function spellScale(rootPc, scaleKey) {
  const degrees = SCALES[scaleKey].degrees;
  const rootName = bestRootName(rootPc, degrees);
  return { rootName, notes: degrees.map((d) => spellDegree(rootName, rootPc, d)) };
}
function spellChord(rootPc, typeKey) {
  const degrees = CHORD_TYPES[typeKey].degrees;
  const rootName = bestRootName(rootPc, degrees, true);
  return { rootName, notes: degrees.map((d) => spellDegree(rootName, rootPc, d, true)) };
}
function chordSymbol(chord) {
  return spellChord(chord.root, chord.type).rootName + CHORD_TYPES[chord.type].symbol;
}

/* ---------- Interval naming (note against a chord) ---------- */
const TENSION_NAMES = ['R', '♭9', '9', '♯9', '3', '11', '♯11', '5', '♭13', '13', '♭7', '7'];

/* ---------- Scale ↔ progression matching ---------- */
// A scale "fits" a chord when every chord tone is in the scale.
function scaleFitsChord(pcsSet, chord) {
  return chordPcs(chord.root, chord.type).every((pc) => pcsSet.has(pc));
}

// All (root, scale) pairs ranked against the progression.
// Returns { full, near, perChord } — see README for the algorithm.
function matchScales(progression) {
  const full = [];
  const near = [];
  const n = progression.length;
  const chordRootSet = new Set(progression.map((c) => c.root));

  for (let root = 0; root < 12; root++) {
    for (const key of Object.keys(SCALES)) {
      const pcs = scalePcs(root, key);
      const set = new Set(pcs);
      const fits = progression.map((c) => scaleFitsChord(set, c));
      const count = fits.filter(Boolean).length;
      const entry = { root, key, pcs, count, fits };
      if (count === n) full.push(entry);
      else if (n >= 3 && count === n - 1) near.push(entry);
    }
  }

  const catRank = (k) => SCALE_CATEGORIES.indexOf(SCALES[k].cat);
  const rank = (e) =>
    (e.root === progression[0].root ? 0 : chordRootSet.has(e.root) ? 1 : 2) * 100 + catRank(e.key);
  full.sort((a, b) => rank(a) - rank(b));
  near.sort((a, b) => rank(a) - rank(b));

  // Per-chord chord-scale suggestions, ranked by agreement with the
  // notes the rest of the progression uses.
  const unionPcs = new Set(progression.flatMap((c) => chordPcs(c.root, c.type)));
  const perChord = progression.map((chord) => {
    const cands = CHORD_SCALE_MAP[chord.type] || ['ionian'];
    return cands
      .map((key) => {
        const pcs = scalePcs(chord.root, key);
        const overlap = pcs.filter((pc) => unionPcs.has(pc)).length / pcs.length;
        return { root: chord.root, key, pcs, overlap };
      })
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 4);
  });

  return { full, near, perChord };
}

// Group full fits: mode-family sets collapse into one family card;
// everything else lists individually.
function groupFullFits(full) {
  const families = [];
  const singles = [];
  const seenFamily = new Set();
  const modeToFamily = {};
  for (const fam of MODE_FAMILIES)
    for (const [k, offset] of fam.modes) modeToFamily[k] = { fam, offset };

  for (const e of full) {
    const m = modeToFamily[e.key];
    if (m) {
      const parentRoot = mod12(e.root - m.offset);
      const id = m.fam.parent + ':' + parentRoot;
      if (seenFamily.has(id)) continue;
      seenFamily.add(id);
      const modes = m.fam.modes.map(([k, off]) => ({ root: mod12(parentRoot + off), key: k }));
      families.push({ id, fam: m.fam, parentRoot, modes, rank: full.indexOf(e) });
    } else {
      singles.push(e);
    }
  }
  return { families, singles };
}

/* ---------- Note classification over a chord ----------
   Each scale note is a chord tone, a tension, or an avoid note.
   Avoid = a non-chord-tone a half step above a chord tone (it pulls
   down and blurs the chord), EXCEPT altered tensions over dominant
   chords, where that rub is the point.                              */
function classifyNote(pc, chord) {
  const cPcs = chordPcs(chord.root, chord.type);
  const family = CHORD_TYPES[chord.type].family;
  const interval = mod12(pc - chord.root);
  const name = TENSION_NAMES[interval];
  const idx = cPcs.indexOf(pc);
  if (idx >= 0) return { role: 'chord', name: CHORD_TYPES[chord.type].degrees[idx] };
  const rubs = cPcs.some((t) => mod12(pc - t) === 1);
  if (rubs) {
    const altOK = family === 'dominant' && ['♭9', '♯9', '♭13', '♯11'].includes(name);
    if (!altOK) return { role: 'avoid', name };
  }
  return { role: 'tension', name };
}

/* ---------- Voice leading between adjacent chords ---------- */
function voiceLeading(a, b) {
  const aPcs = chordPcs(a.root, a.type);
  const bPcs = new Set(chordPcs(b.root, b.type));
  const aSpell = spellChord(a.root, a.type);
  const bSpell = spellChord(b.root, b.type);
  const nameOf = (spelled, pcs, pc) => spelled.notes[pcs.indexOf(pc)];
  const bList = chordPcs(b.root, b.type);

  const common = aPcs.filter((pc) => bPcs.has(pc))
    .map((pc) => nameOf(aSpell, aPcs, pc));
  const moves = [];
  for (const pc of aPcs) {
    if (bPcs.has(pc)) continue;
    for (const step of [1, -1]) {
      const to = mod12(pc + step);
      if (bPcs.has(to)) {
        moves.push(nameOf(aSpell, aPcs, pc) + ' → ' + nameOf(bSpell, bList, to));
        break;
      }
    }
  }
  return { common, moves };
}

/* ---------- Guide tones / targets ---------- */
function targetTones(chord) {
  const t = CHORD_TYPES[chord.type];
  const spelled = spellChord(chord.root, chord.type);
  const picks = [];
  t.degrees.forEach((d, i) => {
    const n = degreeNumber(d);
    if (n === 3 || n === 7 || (n === 4 && t.family === 'sus') || (n === 6 && t.degrees.length === 4))
      picks.push({ deg: d, note: spelled.notes[i] });
  });
  if (!picks.length) picks.push({ deg: t.degrees[1], note: spelled.notes[1] });
  return picks;
}

// Superimposed arpeggio suggestion: for 7th chords, the arpeggio built
// on the 3rd gives 3-5-7-9 of the underlying harmony.
function arpeggioIdeas(chord) {
  const t = CHORD_TYPES[chord.type];
  const spelled = spellChord(chord.root, chord.type);
  const ideas = [{ label: chordSymbol(chord) + ' arpeggio', notes: spelled.notes.join(' – ') }];
  if (t.degrees.length >= 4) {
    const third = mod12(chord.root + DEG_SEMITONES[t.degrees[1]]);
    const superType = { major: 'min7', minor: 'maj7', dominant: 'm7b5', dim: 'min7', aug: 'maj7', sus: 'min7' }[t.family];
    if (superType && CHORD_TYPES[superType]) {
      const s = spellChord(third, superType);
      ideas.push({
        label: 'From the 3rd: ' + s.rootName + CHORD_TYPES[superType].symbol,
        notes: s.notes.join(' – ') + '  (gives you 3·5·7·9)',
      });
    }
  }
  return ideas;
}
