# Fretwork — Guitar Harmony & Scale Visualizer

A complete, dependency-free web app: build a chord progression, see every scale and
mode that fits it on an interactive 24-fret neck, and read live theory explaining why.

**Live app:** https://diazjulio9290.github.io/fretwork/ · user guide at
[/guide.html](https://diazjulio9290.github.io/fretwork/guide.html)
(also runs locally — open `index.html` in any browser)

## Why vanilla JS

The app is a single self-contained HTML file (~90 KB, no build tooling, no network
dependencies beyond Google Fonts). That makes it runnable anywhere — desktop, tablet,
phone — with zero install, and trivially portable later to React Native / Flutter /
Swift since all domain logic is pure functions with no DOM coupling.

## Architecture

```
src/
  theory.js     Data layer — notes, chord types, scales, mode families, chord-scale map
  engine.js     Harmony engine — pure functions: matching, spelling, classification
  fretboard.js  SVG fretboard renderer + CAGED windows + 3NPS pattern generator
  audio.js      Web Audio synth — plucked-string voice, chords, scales, progression
  library.js    Hand-written theory library topics (scales/chords auto-generate)
  ui.js         State, render functions, event delegation
  styles.css    Design tokens (light/dark), layout, components
  body.html     Markup skeleton
build.sh        Concatenates src/ into app.html (artifact-shaped single file)
preview.html    app.html wrapped in a full HTML skeleton for local use
```

State flows one way: a single `state` object → `render()` re-renders each section →
event delegation (`data-action` attributes) mutates state and re-renders. No framework
needed at this scale, and every module below `ui.js` is DOM-free and unit-testable in
Node (that's how the engine was verified).

## Data models

**Single source of truth: degree formulas.** Every chord and scale is defined only by
its degree-string array (`['1','♭3','5','♭7']`); semitones are derived through
`DEG_SEMITONES`, so the formula shown to the user can never disagree with the notes
computed for the neck.

- `CHORD_TYPES[key] = { name, symbol, degrees[], family }` — 21 types (maj…7alt);
  `family` (major/minor/dominant/dim/aug/sus) drives tension rules.
- `SCALES[key] = { name, cat, degrees[], character, use }` — 26 scales: all 7 major
  modes, harmonic minor + Phrygian dominant, all 7 melodic minor modes, pentatonics,
  blues, bebop, whole tone, both diminished, augmented scale.
- `MODE_FAMILIES` — which scales share one parent pitch-class set (used to group
  "D Dorian = C major's notes" into one suggestion card).
- `CHORD_SCALE_MAP[chordType] = [scaleKeys…]` — jazz chord-scale candidates per type.
- A chord instance is just `{ root: 0–11, type: key }`; a selected scale is
  `{ root, key }`. Fretboard notes are computed, never stored.

## Scale-matching algorithm

1. For each of 12 roots × 26 scales, compute the pitch-class set.
2. A scale **fits a chord** iff every chord tone ⊆ scale set (alterations included —
   so G7alt correctly finds only the A♭ melodic-minor family).
3. **Full fits** contain every chord; ranked by root (progression's first chord >
   any chord root > other) then category. Mode-family members collapse into one
   grouped card. **Near fits** (all but one chord) are listed with the clashing chord.
4. **Per-chord suggestions** come from `CHORD_SCALE_MAP`, ranked by overlap with the
   union of all progression tones ("% in context").
5. Special case: an all-dominant progression (blues) never shares one scale — the UI
   explains the convention and offers the I chord's blues/pentatonic scales.

Other engine functions: `classifyNote` (chord tone / tension / avoid — avoid = a
half step above a chord tone, except altered tensions over dominants),
`voiceLeading` (common tones + half-step moves between adjacent chords),
`targetTones` (3rds & 7ths), `arpeggioIdeas` (incl. superimposition from the 3rd),
correct enharmonic spelling via letter arithmetic (F♯ major yields E♯; chord symbols
use pragmatic spelling so you get B♭m7♭5, not A♯m7♭5).

## Fretboard rendering

Pure SVG string generation: 24 frets, standard tuning, gently tapered fret spacing,
rosewood board / brass frets / pearloid inlays (committed to in both themes).
Marker color = scale degree (single scale) or per-scale hue with pie-slice wedges on
shared notes (up to 4 overlaid scales). Root notes get an emphasis ring; the focused
chord's tones get a dashed ring. Label modes: names / intervals / degrees / none.
Views: full neck, 5 CAGED windows (computed from root positions on strings 6/5/4),
7 three-note-per-string patterns (generated in MIDI space), and free-click custom
shapes. Clicking any note plays it and explains its role over the focused chord.

## Extending it

- More tunings / 7-string: change `OPEN_MIDI` + `STRING_LABELS`.
- Chord voicing diagrams, drag-to-reorder progression, save/share progressions
  (URL-encode `state`), MIDI input, backing-track loop per chord, ear-training mode.
- Port to React Native/Flutter: keep `theory/engine/fretboard` as-is (pure JS),
  replace `ui.js` + SVG host.

## Development

```
sh build.sh   # rebuilds app.html and nothing else — then republish the artifact
```
