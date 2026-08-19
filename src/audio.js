/* ============================================================
   Fretwork — audio engine (Web Audio, no samples)
   A filtered saw with a fast decay reads convincingly as a
   plucked string at guitar register.
   ============================================================ */

const Audio_ = {
  ctx: null,
  get() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  pluck(midi, when = 0, dur = 1.1, vel = 0.9) {
    const ctx = this.get();
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filt = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc2.type = 'triangle';
    osc.frequency.value = this.midiToFreq(midi);
    osc2.frequency.value = this.midiToFreq(midi);
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(2600, t);
    filt.frequency.exponentialRampToValueAtTime(700, t + dur);
    filt.Q.value = 0.7;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.32 * vel, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    osc.connect(filt); osc2.connect(filt);
    filt.connect(gain); gain.connect(this.master);
    osc.start(t); osc2.start(t);
    osc.stop(t + dur + 0.05); osc2.stop(t + dur + 0.05);
  },

  // Voice a chord in guitar register: root around E3–D4, strum feel
  chordMidis(chord) {
    const root = 48 + mod12(chord.root - 0); // C3-based
    const base = root > 55 ? root - 12 : root;
    const ivs = CHORD_TYPES[chord.type].degrees.map((d) => DEG_SEMITONES[d]);
    return ivs.map((iv, i) => base + iv + (iv < ivs[0] ? 12 : 0) + (i > 0 && iv <= 2 ? 12 : 0));
  },

  playChord(chord, when = 0, dur = 1.5) {
    this.chordMidis(chord).forEach((m, i) => this.pluck(m, when + i * 0.035, dur, 0.85));
  },

  playProgression(chords, secPerChord = 1.15) {
    chords.forEach((c, i) => this.playChord(c, i * secPerChord, secPerChord * 1.25));
  },

  playScale(rootPc, scaleKey) {
    const base = 48 + rootPc; // around C3–B3
    const start = base > 55 ? base - 12 : base;
    const offs = SCALES[scaleKey].degrees.map((d) => DEG_SEMITONES[d]);
    const seq = [...offs.map((o) => start + o), start + 12];
    seq.forEach((m, i) => this.pluck(m, i * 0.22, 0.6, 0.8));
  },

  playFret(sIdx, fret) {
    this.pluck(OPEN_MIDI[sIdx] + fret, 0, 1.0, 0.9);
  },
};
