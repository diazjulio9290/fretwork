/* ============================================================
   Fretwork — theory library
   Hand-written harmony topics. Scale and chord entries are
   generated from the data layer at runtime (see ui.js).
   Entries with a `prog` array get a "Send to Studio" button.
   ============================================================ */

const LIBRARY_TOPICS = [
  {
    id: 'chord-construction', title: 'Chord construction', cat: 'Harmony',
    tags: 'triad seventh stacking thirds intervals build',
    body: `<p>Chords are built by stacking 3rds from a scale. Take a major scale, pick a root, then take every other note: 1–3–5 makes a triad, adding the 7 makes a seventh chord.</p>
<p>The quality comes from the interval sizes: a <b>major 3rd</b> (4 semitones) plus a <b>minor 3rd</b> (3 semitones) = major triad; stack them the other way for minor; two minor 3rds = diminished; two major 3rds = augmented.</p>
<p>Sevenths extend the same idea: maj7 = major triad + major 3rd on top, dom7 = major triad + minor 3rd, m7 = minor triad + minor 3rd, m7♭5 = diminished triad + major 3rd. Extensions (9, 11, 13) keep stacking 3rds past the octave.</p>`,
  },
  {
    id: 'functional-harmony', title: 'Functional harmony', cat: 'Harmony',
    tags: 'tonic subdominant dominant function resolution tension cadence',
    body: `<p>In a key, every chord plays one of three roles. <b>Tonic</b> (I, vi, iii) is home — stable, resolved. <b>Subdominant</b> (IV, ii) moves away from home. <b>Dominant</b> (V, vii°) demands resolution back to tonic — its tritone between the 3rd and ♭7 is the engine of tonal music.</p>
<p>Most progressions are journeys: tonic → subdominant → dominant → tonic. Hear it in C: C (rest) → F (lift) → G7 (tension) → C (arrival).</p>
<p>For soloing, this tells you where the tension belongs: play colorfully over the dominant, resolve onto a chord tone when the tonic lands.</p>`,
    prog: [{ root: 0, type: 'maj' }, { root: 5, type: 'maj' }, { root: 7, type: 'dom7' }, { root: 0, type: 'maj' }],
  },
  {
    id: 'modal-harmony', title: 'Modal harmony', cat: 'Harmony',
    tags: 'modes dorian mixolydian vamp drone color tone',
    body: `<p>Modal music replaces the pull of V→I with a single <i>color</i>. Instead of a journey, you sit on one or two chords and let the mode's characteristic note define the atmosphere: Dorian's natural 6, Phrygian's ♭2, Lydian's ♯4, Mixolydian's ♭7.</p>
<p>To make a mode speak: keep the root as a drone or pedal, avoid the strong V7→I cadence of its parent major scale, and lean on the characteristic note in your melodies. Two-chord vamps work beautifully — Dm7→G7 (loops, never resolving to C) is D Dorian; D→C over a D pedal is D Mixolydian.</p>`,
    prog: [{ root: 2, type: 'min7' }, { root: 7, type: 'dom7' }],
  },
  {
    id: 'secondary-dominants', title: 'Secondary dominants', cat: 'Harmony',
    tags: 'V of V applied dominant tonicization',
    body: `<p>Any chord can be preceded by <i>its own</i> V7 — a dominant borrowed from outside the key that spotlights the chord it resolves to. In C major, A7 is "V of ii": it doesn't belong to C, but it pulls hard into Dm7.</p>
<p>Write them as V7/x: V7/ii = A7, V7/V = D7, V7/vi = E7 (the "Beatles chord" in a thousand pop songs). The tell-tale sign: a dominant 7 chord whose root is a 5th above a diatonic chord.</p>
<p>Solo-wise, treat each secondary dominant on its own terms — Mixolydian or, resolving to a minor chord, Phrygian dominant / 7♭9 colors.</p>`,
    prog: [{ root: 0, type: 'maj7' }, { root: 9, type: 'dom7' }, { root: 2, type: 'min7' }, { root: 7, type: 'dom7' }],
  },
  {
    id: 'tritone-sub', title: 'Tritone substitution', cat: 'Harmony',
    tags: 'substitute dominant flat two subV jazz reharmonization',
    body: `<p>Two dominant chords a tritone apart share the same two crucial notes: G7 and D♭7 both contain B and F (as 3↔♭7). So one can replace the other. Instead of Dm7–G7–Cmaj7, play Dm7–D♭7–Cmaj7 — the bass now walks down chromatically: D→D♭→C.</p>
<p>The substitute (written subV or ♭II7) sounds slick and chromatic while making the same harmonic promise. Over a tritone sub, <b>Lydian dominant</b> is the classic scale choice — its ♯4 is exactly the original key's tonic.</p>`,
    prog: [{ root: 2, type: 'min7' }, { root: 1, type: 'dom7' }, { root: 0, type: 'maj7' }],
  },
  {
    id: 'borrowed-chords', title: 'Borrowed chords', cat: 'Harmony',
    tags: 'modal interchange parallel minor mixture flat six flat seven',
    body: `<p>A major key can borrow chords from its parallel minor (and vice versa). In C major, borrowing from C minor gives you Fm, A♭, B♭, E♭, Ddim — colors that feel bittersweet or cinematic because they carry the minor key's ♭3, ♭6, ♭7.</p>
<p>The most common borrowings: <b>iv</b> (Fm in C — the "Creep" chord), <b>♭VII</b> (B♭ — rock's favorite), <b>♭VI</b> (A♭), and <b>♭III</b>. When one appears, your note choices shift with it: over the iv chord, C natural minor or C Dorian suddenly fits where C major didn't.</p>`,
    prog: [{ root: 0, type: 'maj' }, { root: 5, type: 'min' }, { root: 0, type: 'maj' }, { root: 10, type: 'maj' }],
  },
  {
    id: 'ii-V-I', title: 'The ii–V–I', cat: 'Progressions',
    tags: 'jazz cadence two five one standard turnaround',
    body: `<p>Jazz's fundamental sentence. In C: Dm7 → G7 → Cmaj7. The roots fall in 5ths, and the guide tones resolve by half step or common tone: F (♭3 of Dm7) becomes the ♭7 of G7, then B (3 of G7) melts into C's major 7.</p>
<p>One scale — C major — covers all three chords, which makes it the perfect laboratory: play C major but <i>target</i> each chord's 3rd and 7th as it arrives. Then start substituting: altered or half–whole diminished over the G7, melodic-minor colors over the Dm7.</p>
<p>The minor version is iiø–V7♭9–i: Dm7♭5 → G7♭9 → Cm.</p>`,
    prog: [{ root: 2, type: 'min7' }, { root: 7, type: 'dom7' }, { root: 0, type: 'maj7' }],
  },
  {
    id: 'jazz-blues', title: 'Jazz blues (12-bar)', cat: 'Progressions',
    tags: 'blues changes turnaround quick four jazz form',
    body: `<p>The jazz blues dresses the 12-bar form with substitutions: a quick IV in bar 2, a ♯IV diminished passing chord in bar 6, a ii–V into bar 9, and a I–VI–ii–V turnaround. In F:</p>
<p class="mono">F7 · B♭7 · F7 · F7 | B♭7 · B°7 · F7 · D7 | Gm7 · C7 · F7–D7 · Gm7–C7</p>
<p>Each chord is a dominant or passing color, so the blues scale coexists with chord-by-chord Mixolydian playing — the friction between those two approaches <i>is</i> the jazz-blues sound.</p>`,
    prog: [{ root: 5, type: 'dom7' }, { root: 10, type: 'dom7' }, { root: 5, type: 'dom7' }, { root: 2, type: 'dom7' }, { root: 7, type: 'min7' }, { root: 0, type: 'dom7' }],
  },
  {
    id: 'rhythm-changes', title: 'Rhythm changes', cat: 'Progressions',
    tags: 'gershwin I got rhythm bridge AABA jazz standard',
    body: `<p>After the blues, the most-played form in jazz — from Gershwin's "I Got Rhythm". The A section cycles home fast: I–vi–ii–V (B♭–Gm7–Cm7–F7) with endless substitution options. The bridge is a chain of dominants falling in 5ths: D7 → G7 → C7 → F7, two bars each.</p>
<p>It's a masterclass in cycling harmony: the A sections teach you to navigate fast tonic-based turnarounds; the bridge teaches long dominant colors — each chord a chance for Mixolydian, Lydian dominant, or altered playing.</p>`,
    prog: [{ root: 10, type: 'maj6' }, { root: 7, type: 'min7' }, { root: 0, type: 'min7' }, { root: 5, type: 'dom7' }],
  },
  {
    id: 'twelve-bar', title: '12-bar blues (basic)', cat: 'Progressions',
    tags: 'blues I IV V shuffle three chords',
    body: `<p>Three chords, twelve bars, a century of music: four bars of I7, two of IV7, two of I7, then V7–IV7–I7–V7. All three chords are dominant 7ths — which technically "clash" with a single major scale, and that clash is the blues.</p>
<p>The minor pentatonic/blues scale of the key works over everything (the gloriously "wrong" ♭3 against major chords is the blue note). For more finesse, switch to each chord's Mixolydian, or mix the major and minor blues scales of the key.</p>`,
    prog: [{ root: 9, type: 'dom7' }, { root: 2, type: 'dom7' }, { root: 9, type: 'dom7' }, { root: 4, type: 'dom7' }],
  },
  {
    id: 'pop-loops', title: 'Pop loops: I–V–vi–IV and friends', cat: 'Progressions',
    tags: 'four chords axis pop rock vi IV I V doo wop 50s',
    body: `<p>Modern pop turns on a handful of four-chord loops. The "Axis" progression I–V–vi–IV (C–G–Am–F) powers hundreds of hits; start it from vi and you get the moodier vi–IV–I–V. The 50s doo-wop loop is I–vi–IV–V (C–Am–F–G).</p>
<p>All are fully diatonic — one major scale (or its relative-minor framing) covers the whole loop, which is why the major pentatonic and the full major scale both sing over them. The art is in <i>targeting</i>: land on chord tones as each chord passes, especially the 3rds.</p>`,
    prog: [{ root: 0, type: 'maj' }, { root: 7, type: 'maj' }, { root: 9, type: 'min' }, { root: 5, type: 'maj' }],
  },
  {
    id: 'andalusian', title: 'Andalusian & rock minor: i–♭VII–♭VI–V', cat: 'Progressions',
    tags: 'flamenco phrygian descent minor rock stairway',
    body: `<p>The Andalusian cadence walks down from the minor tonic: Am–G–F–E(7). The first three chords are pure A natural minor; the final E7 borrows the raised 7 (G♯) from A harmonic minor — that's the flamenco sting.</p>
<p>Rock's favorite cousin drops the V: i–♭VII–♭VI (Am–G–F, "All Along the Watchtower", "Stairway"'s solo section) stays entirely in natural minor / Aeolian. Solo with A minor pentatonic or Aeolian; when the E7 appears, switch to A harmonic minor (or E Phrygian dominant — same notes) to catch the G♯.</p>`,
    prog: [{ root: 9, type: 'min' }, { root: 7, type: 'maj' }, { root: 5, type: 'maj' }, { root: 4, type: 'dom7' }],
  },
  {
    id: 'caged', title: 'The CAGED system', cat: 'Technique',
    tags: 'positions shapes chord forms fretboard navigation',
    body: `<p>Every chord (and scale) on the guitar lives inside one of five open-chord shapes — C, A, G, E, D — moved up the neck with a barre. The five shapes tile the fretboard: play a C chord as C shape (open), A shape (3rd fret), G shape (5th), E shape (8th), D shape (10th), and you've covered the neck.</p>
<p>Scales attach to the same five regions: each CAGED position is a ~4–5 fret window where the scale sits comfortably under the hand, with the chord shape embedded inside it — so your solo lines always know where the chord tones are. Use the <b>CAGED view</b> on the fretboard to step through the five windows.</p>`,
  },
  {
    id: 'three-nps', title: 'Three-notes-per-string', cat: 'Technique',
    tags: '3nps shapes legato speed picking patterns seven',
    body: `<p>An alternative to CAGED for 7-note scales: put exactly three scale notes on every string. The payoff is symmetry — every string gets the same picking gesture, which is why 3NPS is the backbone of legato and economy-picking vocabulary (Satriani, Petrucci, Gilbert).</p>
<p>Seven patterns exist, one starting on each scale degree; they overlap and tile the whole neck. The stretch is wider than CAGED, but the patterns are faster to memorize because only three interval shapes occur on a string: whole–whole, whole–half, and half–whole. Use the <b>3NPS view</b> to cycle all seven.</p>`,
  },
  {
    id: 'guide-tones', title: 'Guide tones & voice leading', cat: 'Technique',
    tags: 'third seventh resolution lines connecting chords smooth',
    body: `<p>The 3rd and 7th define a chord's quality — root and 5th are generic. A <b>guide-tone line</b> connects these defining notes through a progression by common tone or half step: over Dm7–G7–Cmaj7, follow F→F→E, or C→B→B.</p>
<p>Practice: play <i>only</i> 3rds and 7ths through your progression, one or two notes per chord. It sounds instantly like jazz because you're voicing the harmony's skeleton. Then build solo lines that <i>arrive</i> on a guide tone as each chord changes — the Voice-leading panel in the Studio computes these moves for any progression.</p>`,
  },
  {
    id: 'avoid-notes', title: 'Avoid notes & tensions', cat: 'Technique',
    tags: 'tension resolution color available tensions b9 rub',
    body: `<p>An "avoid note" is a scale tone a half step above a chord tone — it makes a ♭9 rub that blurs the harmony. The textbook case: F over Cmaj7 (a half step over the 3rd, E). Avoid notes aren't forbidden — they're <i>passing</i> notes; just don't sit on them.</p>
<p>Everything else non-chordal is an <b>available tension</b> (9, ♯11, 13...) — color you can sustain. Dominant chords are special: their job is tension, so even the harsh ♭9/♯9/♭13 rubs are welcome there. The Studio's note map classifies every scale note against every chord for exactly this reason.</p>`,
  },
];
