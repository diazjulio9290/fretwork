/* ============================================================
   Fretwork — theory data layer
   Single source of truth: every scale and chord is defined by a
   degree-formula array; semitones are derived from it, so the
   displayed formula can never disagree with the computed notes.
   ============================================================ */

const DEG_SEMITONES = {
  '1': 0, '♭2': 1, '2': 2, '♯2': 3, '♭3': 3, '3': 4, '4': 5, '♯4': 6,
  '♭5': 6, '5': 7, '♯5': 8, '♭6': 8, '6': 9, '♭♭7': 9, '♭7': 10, '7': 11,
  '♭9': 1, '9': 2, '♯9': 3, '11': 5, '♯11': 6, '♭13': 8, '13': 9,
};

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PCS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// Preferred spelling per pitch class (jazz-leaning: flats for black keys except F♯)
const PC_PREFERRED = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const PC_SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const PC_FLAT  = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
// Root choices offered in dropdowns (dual-named where enharmonic)
const ROOT_CHOICES = [
  { pc: 0, label: 'C' }, { pc: 1, label: 'C♯ / D♭' }, { pc: 2, label: 'D' },
  { pc: 3, label: 'D♯ / E♭' }, { pc: 4, label: 'E' }, { pc: 5, label: 'F' },
  { pc: 6, label: 'F♯ / G♭' }, { pc: 7, label: 'G' }, { pc: 8, label: 'G♯ / A♭' },
  { pc: 9, label: 'A' }, { pc: 10, label: 'A♯ / B♭' }, { pc: 11, label: 'B' },
];

/* ---------------- Chord types ----------------
   family drives tension/avoid-note logic:
   major | minor | dominant | dim | aug | sus            */
const CHORD_TYPES = {
  maj:   { name: 'Major',            symbol: '',       degrees: ['1', '3', '5'],                family: 'major' },
  min:   { name: 'Minor',            symbol: 'm',      degrees: ['1', '♭3', '5'],               family: 'minor' },
  dom7:  { name: 'Dominant 7',       symbol: '7',      degrees: ['1', '3', '5', '♭7'],          family: 'dominant' },
  maj7:  { name: 'Major 7',          symbol: 'maj7',   degrees: ['1', '3', '5', '7'],           family: 'major' },
  min7:  { name: 'Minor 7',          symbol: 'm7',     degrees: ['1', '♭3', '5', '♭7'],         family: 'minor' },
  maj6:  { name: 'Major 6',          symbol: '6',      degrees: ['1', '3', '5', '6'],           family: 'major' },
  min6:  { name: 'Minor 6',          symbol: 'm6',     degrees: ['1', '♭3', '5', '6'],          family: 'minor' },
  mMaj7: { name: 'Minor–major 7',    symbol: 'm(maj7)',degrees: ['1', '♭3', '5', '7'],          family: 'minor' },
  dim:   { name: 'Diminished',       symbol: 'dim',    degrees: ['1', '♭3', '♭5'],              family: 'dim' },
  dim7:  { name: 'Diminished 7',     symbol: 'dim7',   degrees: ['1', '♭3', '♭5', '♭♭7'],       family: 'dim' },
  m7b5:  { name: 'Half-diminished',  symbol: 'm7♭5',   degrees: ['1', '♭3', '♭5', '♭7'],        family: 'dim' },
  aug:   { name: 'Augmented',        symbol: 'aug',    degrees: ['1', '3', '♯5'],               family: 'aug' },
  sus2:  { name: 'Sus2',             symbol: 'sus2',   degrees: ['1', '2', '5'],                family: 'sus' },
  sus4:  { name: 'Sus4',             symbol: 'sus4',   degrees: ['1', '4', '5'],                family: 'sus' },
  sus7:  { name: '7sus4',            symbol: '7sus4',  degrees: ['1', '4', '5', '♭7'],          family: 'dominant' },
  dom9:  { name: 'Dominant 9',       symbol: '9',      degrees: ['1', '3', '5', '♭7', '9'],     family: 'dominant' },
  b5:    { name: '7♭5',              symbol: '7♭5',    degrees: ['1', '3', '♭5', '♭7'],         family: 'dominant' },
  s5:    { name: '7♯5',              symbol: '7♯5',    degrees: ['1', '3', '♯5', '♭7'],         family: 'dominant' },
  b9:    { name: '7♭9',              symbol: '7♭9',    degrees: ['1', '3', '5', '♭7', '♭9'],    family: 'dominant' },
  s9:    { name: '7♯9',              symbol: '7♯9',    degrees: ['1', '3', '5', '♭7', '♯9'],    family: 'dominant' },
  alt:   { name: '7alt',             symbol: '7alt',   degrees: ['1', '3', '♭7', '♭9', '♯9', '♭5', '♯5'], family: 'dominant' },
};

/* ---------------- Scales & modes ---------------- */
const SCALE_CATEGORIES = [
  'Major scale modes', 'Minor scales', 'Harmonic minor', 'Melodic minor modes',
  'Pentatonic & blues', 'Bebop', 'Symmetric',
];

const SCALES = {
  ionian:       { name: 'Ionian (major)',        cat: 'Major scale modes', degrees: ['1','2','3','4','5','6','7'],
    character: 'Bright, stable, resolved — the home base of tonal music.',
    use: 'Major and maj7 chords functioning as the tonic (I).' },
  dorian:       { name: 'Dorian',                cat: 'Major scale modes', degrees: ['1','2','♭3','4','5','6','♭7'],
    character: 'Minor with a bright natural 6 — soulful and open, less dark than Aeolian.',
    use: 'Minor 7 chords, especially the ii chord and modal minor vamps (So What, Oye Como Va).' },
  phrygian:     { name: 'Phrygian',              cat: 'Major scale modes', degrees: ['1','♭2','♭3','4','5','♭6','♭7'],
    character: 'Dark and Spanish-flavored; the ♭2 is its signature tension.',
    use: 'Minor chords in flamenco/metal contexts; the iii chord in a major key.' },
  lydian:       { name: 'Lydian',                cat: 'Major scale modes', degrees: ['1','2','3','♯4','5','6','7'],
    character: 'Floating, dreamlike major sound — the ♯4 removes the major scale’s only avoid note.',
    use: 'Maj7 chords, especially IV; film-score colors; maj7♯11.' },
  mixolydian:   { name: 'Mixolydian',            cat: 'Major scale modes', degrees: ['1','2','3','4','5','6','♭7'],
    character: 'Major with a ♭7 — bluesy, rolling, unresolved. The dominant-chord home scale.',
    use: 'Dominant 7 chords, blues and rock vamps, the V chord.' },
  aeolian:      { name: 'Aeolian (natural minor)', cat: 'Minor scales',    degrees: ['1','2','♭3','4','5','♭6','♭7'],
    character: 'The natural minor scale — melancholy, classic minor-key sound.',
    use: 'Minor tonic chords (i); rock and pop minor keys.' },
  locrian:      { name: 'Locrian',               cat: 'Major scale modes', degrees: ['1','♭2','♭3','4','♭5','♭6','♭7'],
    character: 'Unstable by design: no perfect 5th. At home only over half-diminished chords.',
    use: 'm7♭5 chords (the ii in a minor ii–V–i).' },
  harmonicMinor:{ name: 'Harmonic minor',        cat: 'Harmonic minor',   degrees: ['1','2','♭3','4','5','♭6','7'],
    character: 'Minor with a raised 7 — the aug-2nd gap between ♭6 and 7 gives it an exotic pull.',
    use: 'Minor keys where the V chord is dominant; m(maj7) chords.' },
  phrygDom:     { name: 'Phrygian dominant',     cat: 'Harmonic minor',   degrees: ['1','♭2','3','4','5','♭6','♭7'],
    character: '5th mode of harmonic minor — flamenco, klezmer, surf. Major 3rd against ♭2 and ♭6.',
    use: 'V7 chords resolving to minor (esp. 7♭9); Spanish vamps.' },
  melodicMinor: { name: 'Melodic minor',         cat: 'Melodic minor modes', degrees: ['1','2','♭3','4','5','6','7'],
    character: 'A minor scale whose top half is pure major — smooth, sophisticated minor sound.',
    use: 'm6 and m(maj7) chords; the minor tonic in jazz.' },
  dorianB2:     { name: 'Dorian ♭2',             cat: 'Melodic minor modes', degrees: ['1','♭2','♭3','4','5','6','♭7'],
    character: '2nd mode of melodic minor — Dorian shaded darker by the ♭2.',
    use: 'Susb9 sounds; Phrygian-flavored m7 chords.' },
  lydianAug:    { name: 'Lydian augmented',      cat: 'Melodic minor modes', degrees: ['1','2','3','♯4','♯5','6','7'],
    character: '3rd mode of melodic minor — Lydian pushed further out with a ♯5.',
    use: 'Maj7♯5 chords; dreamlike, unresolved major colors.' },
  lydianDom:    { name: 'Lydian dominant',       cat: 'Melodic minor modes', degrees: ['1','2','3','♯4','5','6','♭7'],
    character: '4th mode of melodic minor — Mixolydian with ♯4. The classic sound over 7♯11.',
    use: 'Non-resolving dominants: tritone subs, backdoor dominants, bVII7.' },
  mixoB6:       { name: 'Mixolydian ♭6',         cat: 'Melodic minor modes', degrees: ['1','2','3','4','5','♭6','♭7'],
    character: '5th mode of melodic minor — a dominant sound that leans toward minor.',
    use: 'V7 resolving to minor; 7♭13 chords.' },
  locrianN2:    { name: 'Locrian ♮2',            cat: 'Melodic minor modes', degrees: ['1','2','♭3','4','♭5','♭6','♭7'],
    character: '6th mode of melodic minor — Locrian with a usable natural 9.',
    use: 'The modern first choice over m7♭5 chords.' },
  altered:      { name: 'Altered (super Locrian)', cat: 'Melodic minor modes', degrees: ['1','♭2','♯2','3','♭5','♭6','♭7'],
    character: '7th mode of melodic minor — every tension altered: ♭9 ♯9 ♭5 ♯5. Maximum pull.',
    use: 'V7alt chords resolving strongly (usually to minor, often to major too).' },
  majPent:      { name: 'Major pentatonic',      cat: 'Pentatonic & blues', degrees: ['1','2','3','5','6'],
    character: 'Five notes, zero avoid notes — the safest bright melodic vocabulary there is.',
    use: 'Major chords and keys; country, pop, rock solos.' },
  minPent:      { name: 'Minor pentatonic',      cat: 'Pentatonic & blues', degrees: ['1','♭3','4','5','♭7'],
    character: 'The guitarist’s mother tongue. Five notes that work over nearly any minor or bluesy chord.',
    use: 'Minor chords, blues, rock — and over dominant chords for a gritty ♯9 color.' },
  minBlues:     { name: 'Minor blues scale',     cat: 'Pentatonic & blues', degrees: ['1','♭3','4','♭5','5','♭7'],
    character: 'Minor pentatonic plus the ♭5 “blue note” — a chromatic passing tone with attitude.',
    use: 'Blues in any form; minor and dominant chords.' },
  majBlues:     { name: 'Major blues scale',     cat: 'Pentatonic & blues', degrees: ['1','2','♭3','3','5','6'],
    character: 'Major pentatonic plus the ♭3 blue note sliding into the 3 — sweet with a smirk.',
    use: 'Major-key blues, western swing, BB King-style major phrasing.' },
  bebopDom:     { name: 'Bebop dominant',        cat: 'Bebop',            degrees: ['1','2','3','4','5','6','♭7','7'],
    character: 'Mixolydian plus a passing natural 7 — eight notes so chord tones land on downbeats.',
    use: 'Dominant 7 chords in swing/bebop lines.' },
  bebopMaj:     { name: 'Bebop major',           cat: 'Bebop',            degrees: ['1','2','3','4','5','♯5','6','7'],
    character: 'Major scale plus a passing ♯5 between 5 and 6 — the same downbeat trick for major chords.',
    use: 'Major and maj6 chords in swing lines.' },
  wholeTone:    { name: 'Whole tone',            cat: 'Symmetric',        degrees: ['1','2','3','♯4','♯5','♭7'],
    character: 'Six equal whole steps — weightless, ambiguous, dreamlike. Only two of these exist.',
    use: '7♯5 and 7♭5 chords; augmented colors.' },
  dimWH:        { name: 'Diminished (whole–half)', cat: 'Symmetric',      degrees: ['1','2','♭3','4','♭5','♭6','6','7'],
    character: 'Eight notes alternating whole–half. Symmetric: repeats every minor 3rd.',
    use: 'dim7 chords. Only three distinct diminished scales exist.' },
  dimHW:        { name: 'Diminished (half–whole)', cat: 'Symmetric',      degrees: ['1','♭2','♯2','3','♯4','5','6','♭7'],
    character: 'Half–whole ordering — a dominant sound with ♭9, ♯9 and ♯11 but a natural 13.',
    use: '7♭9 and 13♭9 chords; Stravinsky-to-jazz crunch.' },
  augScale:     { name: 'Augmented scale',       cat: 'Symmetric',        degrees: ['1','♯2','3','5','♯5','7'],
    character: 'Alternating minor 3rd / half step — repeats every major 3rd. Angular, modern.',
    use: 'Maj7♯5 and aug chords; Coltrane-school colors.' },
};

// Mode families: modes that share one parent pitch-class set,
// listed in parent-degree order. Used to group suggestions.
const MODE_FAMILIES = [
  { parent: 'ionian', label: 'major scale',
    modes: [['ionian',0],['dorian',2],['phrygian',4],['lydian',5],['mixolydian',7],['aeolian',9],['locrian',11]] },
  { parent: 'melodicMinor', label: 'melodic minor',
    modes: [['melodicMinor',0],['dorianB2',2],['lydianAug',3],['lydianDom',5],['mixoB6',7],['locrianN2',9],['altered',11]] },
  { parent: 'harmonicMinor', label: 'harmonic minor',
    modes: [['harmonicMinor',0],['phrygDom',7]] },
];

/* Chord-scale map: candidate scale keys (built on the chord root)
   per chord type, in rough order of "most inside" → "most out". */
const CHORD_SCALE_MAP = {
  maj:   ['ionian', 'lydian', 'majPent', 'majBlues', 'bebopMaj'],
  maj7:  ['ionian', 'lydian', 'majPent', 'bebopMaj', 'lydianAug'],
  maj6:  ['ionian', 'lydian', 'majPent', 'bebopMaj'],
  min:   ['dorian', 'aeolian', 'minPent', 'melodicMinor', 'minBlues'],
  min7:  ['dorian', 'aeolian', 'phrygian', 'minPent', 'minBlues'],
  min6:  ['dorian', 'melodicMinor', 'minPent'],
  mMaj7: ['melodicMinor', 'harmonicMinor'],
  dom7:  ['mixolydian', 'lydianDom', 'bebopDom', 'minPent', 'minBlues', 'dimHW', 'altered'],
  dom9:  ['mixolydian', 'lydianDom', 'bebopDom'],
  sus7:  ['mixolydian', 'dorianB2', 'majPent'],
  sus2:  ['ionian', 'mixolydian', 'majPent'],
  sus4:  ['mixolydian', 'ionian', 'minPent'],
  dim:   ['dimWH', 'locrian'],
  dim7:  ['dimWH'],
  m7b5:  ['locrianN2', 'locrian'],
  aug:   ['wholeTone', 'augScale', 'lydianAug'],
  b5:    ['wholeTone', 'lydianDom', 'altered'],
  s5:    ['wholeTone', 'altered', 'mixoB6'],
  b9:    ['dimHW', 'phrygDom', 'altered'],
  s9:    ['altered', 'dimHW', 'minBlues'],
  alt:   ['altered'],
};
