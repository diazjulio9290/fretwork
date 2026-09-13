/* ============================================================
   Fretwork — transport
   Schedules strums, scale runs and licks on the audio clock (which
   never drifts) and mirrors each event to the UI with timers (which
   only need to be close). Looping schedules one chord at a time with
   a short lookahead, so tempo and progression edits take effect at
   the next chord instead of the next loop.
   ============================================================ */

const Player = {
  playing: false,
  mode: null,        // 'prog' | 'scale' | 'lick'
  bpm: 96,
  loop: true,
  beats: 4,          // beats per chord
  follow: true,      // focus follows the playing chord
  timers: [],
  chordIndex: -1,
  onChord: null,     // (index, seconds) => void
  onBeat: null,      // (beat, beats) => void
  onNote: null,      // ({ s, f, pc, midi }, seconds) => void
  onState: null,     // () => void  (playing changed)

  secPerBeat() { return 60 / this.bpm; },

  later(fn, atAudioTime) {
    const ctx = Audio_.get();
    const ms = Math.max(0, (atAudioTime - ctx.currentTime) * 1000);
    this.timers.push(setTimeout(fn, ms));
  },

  clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  },

  stop() {
    const was = this.playing;
    this.playing = false;
    this.mode = null;
    this.chordIndex = -1;
    this.clearTimers();
    Audio_.stopAll();
    if (was && this.onState) this.onState();
  },

  toggleProgression(chords) {
    if (this.playing && this.mode === 'prog') this.stop();
    else this.playProgression(chords);
  },

  // chords: () => array, read fresh each chord so edits mid-loop are heard
  playProgression(getChords) {
    const ctx = Audio_.get();
    this.stop();
    const chordsFn = typeof getChords === 'function' ? getChords : () => getChords;
    // Render every voice before the downbeat so the first strum is never late.
    chordsFn().forEach((c) => Audio_.chordMidis(c).forEach((m) => Audio_.bufferFor(m, 0.9)));
    this.playing = true;
    this.mode = 'prog';
    if (this.onState) this.onState();

    let i = 0;
    let t = ctx.currentTime + 0.12;
    const step = () => {
      if (!this.playing || this.mode !== 'prog') return;
      const chords = chordsFn();
      if (!chords.length) { this.stop(); return; }
      if (i >= chords.length) {
        if (!this.loop) { this.later(() => this.stop(), t); return; }
        i = 0;
      }
      const chord = chords[i];
      const spb = this.secPerBeat();
      const len = spb * this.beats;
      Audio_.playChord(chord, t, Math.min(len * 1.15, 2.6), { abs: true, vel: 0.92 });
      if (this.beats >= 4)
        Audio_.playChord(chord, t + 2 * spb, Math.min(len * 0.6, 2.2), { abs: true, vel: 0.62, up: true, gap: 0.026 });
      if (this.beats >= 8) {
        Audio_.playChord(chord, t + 4 * spb, Math.min(len * 0.6, 2.4), { abs: true, vel: 0.85 });
        Audio_.playChord(chord, t + 6 * spb, Math.min(len * 0.5, 2.2), { abs: true, vel: 0.6, up: true, gap: 0.026 });
      }

      const idx = i, at = t, beats = this.beats;
      this.later(() => { this.chordIndex = idx; if (this.onChord) this.onChord(idx, len); }, at);
      for (let b = 0; b < beats; b++)
        this.later(() => { if (this.onBeat) this.onBeat(b, beats); }, at + b * spb);

      i += 1;
      t += len;
      this.later(step, t - 0.3);
    };
    step();
  },

  // notes: [{ midi, s, f }] — a melodic line in order; stepBeats: length of each note in beats
  playLine(notes, mode, stepBeats = 0.5, lastHold = 2) {
    const ctx = Audio_.get();
    this.stop();
    notes.forEach((n) => Audio_.bufferFor(n.midi, 0.85));
    this.playing = true;
    this.mode = mode;
    if (this.onState) this.onState();
    const stepSec = this.secPerBeat() * stepBeats;
    const t0 = ctx.currentTime + 0.1;
    notes.forEach((n, k) => {
      const last = k === notes.length - 1;
      const at = t0 + k * stepSec;
      const dur = last ? stepSec * lastHold : stepSec * 1.35;
      const vel = last ? 0.95 : 0.78 + (k % 2 === 0 ? 0.08 : 0);
      Audio_.pluck(n.midi, at, dur, vel, { abs: true });
      this.later(() => { if (this.onNote) this.onNote(n, dur); }, at);
    });
    this.later(() => { if (this.playing && this.mode === mode) this.stop(); }, t0 + notes.length * stepSec + 0.4);
  },
};

/* Find a playable string/fret for each pitch of a scale run, staying in
   one hand position so the neck animation looks like real fingering. */
function positionScaleRun(rootPc, scaleKey) {
  const midis = Audio_.scaleMidis(rootPc, scaleKey);
  const win = cagedWindows(rootPc)[0];
  const lo = win.lo, hi = win.hi + 1;
  return midis.map((midi) => {
    let best = null;
    for (let s = 5; s >= 0; s--) {
      const f = midi - OPEN_MIDI[s];
      if (f < 0 || f > 24) continue;
      const inPos = f >= lo && f <= hi;
      const cost = (inPos ? 0 : 100) + Math.abs(f - (lo + hi) / 2);
      if (!best || cost < best.cost) best = { s, f, cost };
    }
    if (!best) return { midi, s: 0, f: Math.max(0, Math.min(24, midi - OPEN_MIDI[0])), pc: mod12(midi) };
    return { midi, s: best.s, f: best.f, pc: mod12(midi) };
  });
}
