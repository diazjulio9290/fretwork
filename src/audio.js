/* ============================================================
   Fretwork — audio engine (Web Audio, no samples)

   Plucked strings are physically modeled with an extended
   Karplus–Strong loop: a short burst of filtered noise (the pick)
   is fed into a delay line one period long, and every trip round
   the loop passes through a gentle low-pass, so high harmonics die
   first — exactly what a real string does. Fractional delay keeps
   the tuning exact; a pick-position comb filter gives the hollow
   "plucked near the bridge" tone; lower strings are damped harder.

   Each note is rendered once into an AudioBuffer (cached, LRU) and
   played through a shared guitar "body": two resonant peaks near
   100 Hz and 210 Hz, a presence lift, a convolution room, and a
   compressor so six-string strums never clip.
   ============================================================ */

const Audio_ = {
  ctx: null,
  master: null,
  bodyIn: null,
  volume: 0.8,
  muted: false,
  cache: new Map(),
  CACHE_MAX: 72,
  active: new Set(),
  BUF_SECONDS: 2.8,

  get() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.buildGraph();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },

  buildGraph() {
    const ctx = this.ctx;
    const peak = (f, q, g) => {
      const n = ctx.createBiquadFilter();
      n.type = 'peaking'; n.frequency.value = f; n.Q.value = q; n.gain.value = g;
      return n;
    };
    this.bodyIn = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 62; hp.Q.value = 0.7;
    const air = peak(104, 3.2, 5.5);      // Helmholtz air resonance
    const top = peak(212, 2.6, 3.2);      // top-plate resonance
    const presence = peak(2600, 0.9, 1.8);
    const shelf = ctx.createBiquadFilter();
    shelf.type = 'highshelf'; shelf.frequency.value = 5200; shelf.gain.value = -3;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3.5;
    comp.attack.value = 0.004; comp.release.value = 0.18;

    const reverb = ctx.createConvolver();
    reverb.buffer = this.impulse(1.7, 3.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    const dry = ctx.createGain();
    dry.gain.value = 1.0;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;

    this.bodyIn.connect(hp); hp.connect(air); air.connect(top); top.connect(presence); presence.connect(shelf);
    shelf.connect(dry); dry.connect(comp);
    shelf.connect(reverb); reverb.connect(wet); wet.connect(comp);
    comp.connect(this.master); this.master.connect(ctx.destination);
  },

  // Synthetic stereo room: decorrelated noise with an exponential tail
  // and a touch of early-reflection density in the first 40 ms.
  impulse(seconds, decay) {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = Math.pow(1 - i / len, decay) * (t < 0.04 ? 0.55 + 11 * t : 1);
        lp += 0.35 * ((Math.random() * 2 - 1) - lp); // darken the tail
        d[i] = lp * env;
      }
    }
    return buf;
  },

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
  },
  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
  },

  midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); },

  /* ---- Karplus–Strong renderer (pure; also runs in Node) ---- */
  renderPluck(sr, freq, seconds, opts = {}) {
    const bright = opts.bright == null ? 0.65 : opts.bright;  // 0 dull … 1 sharp pick
    const pickPos = opts.pickPos == null ? 0.18 : opts.pickPos; // fraction of string length
    const t60 = opts.t60 == null ? 2.4 : opts.t60;               // seconds to −60 dB
    const period = sr / freq;
    const len = Math.ceil(sr * seconds);
    const out = new Float32Array(len);

    // Excitation: one period of noise, low-passed for pick softness,
    // comb-filtered for pick position, DC removed.
    const P = Math.ceil(period);
    const exc = new Float32Array(P);
    const a = 0.12 + 0.8 * bright;
    let lp = 0, mean = 0;
    for (let i = 0; i < P; i++) {
      lp += a * ((Math.random() * 2 - 1) - lp);
      exc[i] = lp;
    }
    const pd = Math.max(1, Math.round(pickPos * P));
    for (let i = P - 1; i >= pd; i--) exc[i] -= 0.9 * exc[i - pd];
    for (let i = 0; i < P; i++) mean += exc[i];
    mean /= P;
    for (let i = 0; i < P; i++) exc[i] -= mean;

    // Loop filter: y = g · ((1−c)·y[n−D] + c·y[n−D−1]).
    // c sets how fast highs decay (lower strings: more), g the overall
    // loss per period so the note reaches −60 dB at t60. The averaging
    // filter adds c samples of delay, so the read position is D = period − c.
    const c = 0.5 * (opts.damp == null ? 0.6 : opts.damp);
    const g = Math.pow(10, -3 * (period / sr) / t60);
    const D = period - c;
    const Di = Math.floor(D);
    const frac = D - Di;
    const k0 = g * (1 - c) * (1 - frac);   // weight of y[n-Di]
    const k1 = g * ((1 - c) * frac + c * (1 - frac)); // y[n-Di-1]
    const k2 = g * c * frac;               // y[n-Di-2]
    // First period: the delay line is still empty, so only the pick is heard.
    const head = Math.min(len, Di + 2);
    for (let n = 0; n < head; n++) {
      const i0 = n - Di;
      let acc = n < P ? exc[n] : 0;
      if (i0 >= 0) acc += k0 * out[i0];
      if (i0 - 1 >= 0) acc += k1 * out[i0 - 1];
      out[n] = acc;
    }
    for (let n = head; n < P; n++)
      out[n] = exc[n] + k0 * out[n - Di] + k1 * out[n - Di - 1] + k2 * out[n - Di - 2];
    for (let n = Math.max(head, P); n < len; n++)
      out[n] = k0 * out[n - Di] + k1 * out[n - Di - 1] + k2 * out[n - Di - 2];

    // Normalise to a consistent peak, then a short fade so the buffer end is silent.
    let peak = 0;
    for (let n = 0; n < len; n++) { const v = Math.abs(out[n]); if (v > peak) peak = v; }
    const norm = peak > 0 ? 0.5 / peak : 1;
    const fade = Math.min(len, Math.floor(sr * 0.08));
    for (let n = 0; n < len; n++) {
      let v = out[n] * norm;
      if (n > len - fade) v *= (len - n) / fade;
      out[n] = v;
    }
    return out;
  },

  // Per-pitch timbre: thick wound strings are darker and ring longer.
  timbreFor(midi, vel) {
    const lowness = Math.max(0, Math.min(1, (64 - midi) / 24)); // 0 at high e, 1 two octaves down
    return {
      bright: 0.42 + 0.5 * vel - 0.18 * lowness,
      damp: 0.28 + 0.5 * lowness,
      t60: 2.7 + 1.6 * lowness,
      pickPos: 0.14 + 0.08 * lowness,
    };
  },

  bufferFor(midi, vel) {
    const ctx = this.get();
    const vb = Math.round(vel * 3); // four brightness buckets
    const key = midi + ':' + vb;
    let buf = this.cache.get(key);
    if (buf) {
      this.cache.delete(key); this.cache.set(key, buf); // refresh LRU order
      return buf;
    }
    const data = this.renderPluck(ctx.sampleRate, this.midiToFreq(midi), this.BUF_SECONDS, this.timbreFor(midi, vb / 3));
    buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.copyToChannel(data, 0);
    this.cache.set(key, buf);
    if (this.cache.size > this.CACHE_MAX) this.cache.delete(this.cache.keys().next().value);
    return buf;
  },

  /* ---- Voices ---- */
  // when: seconds from now (or an absolute ctx time via opts.abs)
  // dur: how long the string rings before a soft release
  pluck(midi, when = 0, dur = 1.6, vel = 0.9, opts = {}) {
    const ctx = this.get();
    const t = opts.abs ? when : ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.bufferFor(midi, vel);
    const gain = ctx.createGain();
    const level = 0.35 + 0.65 * vel;
    gain.gain.setValueAtTime(level, t);
    const rel = Math.min(dur, this.BUF_SECONDS - 0.1);
    gain.gain.setTargetAtTime(0.0001, t + rel, 0.06);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = opts.pan == null ? ((midi - 52) / 40) * 0.5 : opts.pan;
    src.connect(gain);
    if (pan) { gain.connect(pan); pan.connect(this.bodyIn); } else gain.connect(this.bodyIn);
    src.start(t);
    src.stop(t + rel + 0.5);
    this.active.add(src);
    src.onended = () => this.active.delete(src);
    src._gain = gain;
    return src;
  },

  // Fade everything out in ~60 ms (used by the transport's Stop).
  stopAll() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const src of this.active) {
      try {
        src._gain.gain.cancelScheduledValues(t);
        src._gain.gain.setTargetAtTime(0.0001, t, 0.03);
        src.stop(t + 0.25);
      } catch (e) { /* already stopped */ }
    }
    this.active.clear();
  },

  /* ---- Chord voicing: how a guitarist would grab it ----
     Bass root in the low octave, the 5th above it, then the
     colour tones (3rd, 7th, tensions) in the octave above, and the
     root doubled on top for a ringing six-string shape. */
  chordMidis(chord) {
    const degs = CHORD_TYPES[chord.type].degrees;
    let bass = 40 + mod12(chord.root - 4); // E2 … D♯3
    const fifthDeg = degs.find((d) => ['5', '♭5', '♯5'].includes(d));
    const notes = [bass];
    if (fifthDeg) notes.push(bass + DEG_SEMITONES[fifthDeg]);
    const upper = degs.filter((d) => d !== '1' && d !== fifthDeg)
      .map((d) => { let m = bass + 12 + (DEG_SEMITONES[d] % 12); if (m < bass + 15) m += 12; return m; })
      .sort((a, b) => a - b);
    notes.push(...upper);
    if (notes.length < 5) notes.push(bass + 24);
    if (notes.length < 5 && fifthDeg) notes.push(bass + 24 + DEG_SEMITONES[fifthDeg]);
    return notes.slice(0, 6);
  },

  // Strum a list of pitches low→high (down) or high→low (up).
  strum(midis, when = 0, opts = {}) {
    const ctx = this.get();
    const t0 = opts.abs ? when : ctx.currentTime + when;
    const vel = opts.vel == null ? 0.9 : opts.vel;
    const dur = opts.dur == null ? 2.2 : opts.dur;
    const gap = opts.gap == null ? 0.034 : opts.gap;
    const order = opts.up ? [...midis].reverse() : midis;
    order.forEach((m, i) => {
      const jitter = (Math.random() - 0.5) * 0.008;
      const v = Math.max(0.2, vel - i * 0.045 + (Math.random() - 0.5) * 0.06);
      this.pluck(m, t0 + i * gap + jitter, dur, v, { abs: true, pan: ((i / Math.max(1, order.length - 1)) - 0.5) * 0.6 });
    });
    return t0;
  },

  playChord(chord, when = 0, dur = 2.2, opts = {}) {
    return this.strum(this.chordMidis(chord), when, { dur, ...opts });
  },

  // Convenience for one-off use (the transport does its own scheduling)
  playProgression(chords, secPerChord = 1.2) {
    chords.forEach((c, i) => this.playChord(c, i * secPerChord, secPerChord * 1.4));
  },

  // Scale as a run up and back down, one pitch per step.
  scaleMidis(rootPc, scaleKey) {
    let start = 40 + mod12(rootPc - 4); // from the low E string range
    if (start < 45) start += 12;         // keep runs out of the mud
    const offs = SCALES[scaleKey].degrees.map((d) => DEG_SEMITONES[d]);
    const up = [...offs.map((o) => start + o), start + 12];
    return [...up, ...up.slice(0, -1).reverse()];
  },

  playScale(rootPc, scaleKey, stepSec = 0.2) {
    this.scaleMidis(rootPc, scaleKey).forEach((m, i) => this.pluck(m, i * stepSec, 0.55, 0.8));
  },

  playFret(sIdx, fret, vel = 0.9) {
    this.pluck(OPEN_MIDI[sIdx] + fret, 0, 1.4, vel);
  },
};
