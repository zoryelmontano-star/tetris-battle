// Tetris Battle v6: original high-energy arcade battle music + celebratory SFX, no voice.
(() => {
  // Remove any old voice control left over by cached v5 code.
  const oldVoice = document.getElementById('voiceBtn');
  if (oldVoice) oldVoice.remove();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  localStorage.setItem('tb_voice', 'off');

  let musicTimer = null;
  let musicGeneration = 0;
  let musicStep = 0;

  const BPM = 148;
  const STEP_MS = (60000 / BPM) / 4; // 16th notes

  // Original progression designed for a competitive arcade feel.
  // Roots: E, C, G, D. Melody/arps stay original rather than copying any referenced track.
  const ROOTS = [82.41, 65.41, 98.00, 73.42];
  const ARPS = [
    [329.63, 392.00, 493.88, 659.25],
    [261.63, 329.63, 392.00, 523.25],
    [392.00, 493.88, 587.33, 783.99],
    [293.66, 369.99, 440.00, 587.33]
  ];
  const LEAD = [
    659.25, 783.99, 739.99, 659.25,
    587.33, 659.25, 493.88, 587.33,
    523.25, 659.25, 587.33, 523.25,
    493.88, 587.33, 440.00, 493.88
  ];

  function ac() {
    return typeof audio === 'function' ? audio() : null;
  }

  function osc(freq, dur, type='sawtooth', vol=.02, delay=0, cutoff=null) {
    if (!musicOn) return;
    const c = ac();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    let destination = g;

    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .008);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);

    if (cutoff) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(cutoff, t);
      o.connect(f); f.connect(g);
    } else {
      o.connect(g);
    }
    destination.connect(c.destination);
    o.start(t);
    o.stop(t + dur + .03);
  }

  function kick(vol=.075) {
    if (!musicOn) return;
    const c = ac(); if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(44, t + .12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + .14);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + .15);
  }

  function noiseBurst(dur=.035, vol=.018, highpass=5000) {
    if (!musicOn) return;
    const c = ac(); if (!c) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const b = c.createBuffer(1, len, c.sampleRate);
    const data = b.getChannelData(0);
    for (let i=0;i<len;i++) data[i] = (Math.random()*2-1) * (1-i/len);
    const src = c.createBufferSource();
    const hp = c.createBiquadFilter();
    const g = c.createGain();
    hp.type = 'highpass'; hp.frequency.value = highpass;
    g.gain.value = vol;
    src.buffer = b; src.connect(hp); hp.connect(g); g.connect(c.destination);
    src.start();
  }

  function clap(vol=.028) {
    if (!musicOn) return;
    noiseBurst(.06, vol, 1300);
    setTimeout(() => noiseBurst(.045, vol*.65, 1700), 26);
  }

  function chord(root, delay=0, vol=.008) {
    [1, 1.25, 1.5, 2].forEach((r,i) => osc(root*2*r, .16, i%2 ? 'triangle' : 'sine', vol, delay+i*.004, 1800));
  }

  function musicTick(gen) {
    if (gen !== musicGeneration || !musicOn || !gameRunning || paused) return;

    const panic = !!panicMode;
    const s = musicStep % 16;
    const bar = Math.floor(musicStep / 16);
    const chordIndex = bar % ROOTS.length;
    const root = ROOTS[chordIndex];
    const arp = ARPS[chordIndex];

    // Four-on-the-floor drive.
    if (s % 4 === 0) kick(panic ? .09 : .073);
    // Claps on beats 2 and 4.
    if (s === 4 || s === 12) clap(panic ? .035 : .026);
    // Hi-hat pulse, denser in final 10 seconds.
    if (s % 2 === 0 || panic) noiseBurst(.02, panic ? .014 : .009, 6500);

    // Off-beat bass for a bouncy battle feel.
    if (s === 2 || s === 6 || s === 10 || s === 14) {
      osc(root, .13, 'square', panic ? .035 : .028, 0, 700);
      osc(root*2, .08, 'triangle', .009, .01, 1200);
    }

    // Bright 16th-note arpeggio.
    const arpNote = arp[s % 4];
    osc(arpNote, panic ? .065 : .08, 'square', panic ? .019 : .014, 0, 2700);
    osc(arpNote*2, .045, 'triangle', panic ? .008 : .005, .012, 4200);

    // Short chord stabs at start/end of each half bar.
    if (s === 0 || s === 8) chord(root, 0, panic ? .011 : .008);

    // Hook enters every second bar so the loop feels like music, not a metronome.
    if (bar % 2 === 1 && s % 2 === 0) {
      const leadNote = LEAD[s];
      osc(leadNote, panic ? .09 : .12, 'sawtooth', panic ? .021 : .015, 0, 3200);
      osc(leadNote/2, .10, 'triangle', .006, .005, 1800);
    }

    // Extra tension in final 10: higher octave pulses and shorter step spacing.
    if (panic && s % 4 === 3) {
      osc(arpNote*2, .045, 'square', .012, 0, 5000);
    }

    musicStep++;
    musicTimer = setTimeout(() => musicTick(gen), panic ? STEP_MS * .78 : STEP_MS);
  }

  function battleStartMusic() {
    clearTimeout(musicTimer);
    musicGeneration++;
    musicStep = 0;
    if (!musicOn || !gameRunning || paused) return;
    musicTick(musicGeneration);
  }

  function battleStopMusic() {
    musicGeneration++;
    clearTimeout(musicTimer);
    musicTimer = null;
  }

  startMusic = battleStartMusic;
  stopMusic = battleStopMusic;
  restartMusic = function () {
    battleStopMusic();
    if (gameRunning && !paused && musicOn) battleStartMusic();
  };

  // More celebratory SFX, still controlled by the SFX toggle.
  function fxTone(freq, dur=.10, type='triangle', vol=.04, delay=0) {
    if (!sfxOn || typeof tone !== 'function') return;
    tone(freq, dur, type, vol, delay);
  }

  function fanfare(notes, spacing=.045, vol=.045) {
    notes.forEach((f,i) => fxTone(f, .12 + i*.012, i%2 ? 'sine' : 'triangle', vol, i*spacing));
  }

  clearSfx = function(lines, comboCount, perfect) {
    if (!sfxOn) return;

    if (perfect) {
      fanfare([523.25,659.25,783.99,1046.50,1318.51,1567.98], .048, .057);
      fxTone(261.63,.30,'sawtooth',.025,0);
      fxTone(523.25,.28,'triangle',.035,.08);
      fxTone(1046.50,.22,'sine',.035,.16);
      return;
    }

    if (lines === 4) {
      fanfare([392,523.25,659.25,783.99,1046.50], .045, .052);
      fxTone(196,.22,'sawtooth',.022,0);
    } else if (lines === 3) {
      fanfare([349.23,440,523.25,698.46], .046, .047);
    } else if (lines === 2) {
      fanfare([329.63,440,587.33], .05, .041);
    } else {
      fanfare([329.63,392], .04, .033);
    }

    if (comboCount > 0) {
      const base = 520 + Math.min(comboCount,10)*30;
      fanfare([base, base+120, base+240], .035, Math.min(.058,.038+comboCount*.002));
      if (comboCount >= 5) fxTone(base*2,.16,'sawtooth',.025,.11);
    }
  };

  countdownSfx = function(n) {
    if (!sfxOn) return;
    const f = n <= 3 ? 950 : 630;
    fxTone(f, n <= 3 ? .11 : .065, 'square', n <= 3 ? .055 : .034);
    if (n <= 3) fxTone(f*1.5,.07,'triangle',.025,.028);
  };

  sfxWin = function() {
    if (!sfxOn) return;
    fanfare([392,523.25,659.25,783.99,1046.50,1318.51], .055, .058);
    fxTone(196,.35,'sawtooth',.024,0);
  };

  sfxLose = function() {
    if (!sfxOn) return;
    [293.66,246.94,196,146.83].forEach((f,i) => fxTone(f,.17,'triangle',.029,i*.07));
  };

  sfxEnd = function() {
    if (!sfxOn) return;
    fanfare([330,392,440],.055,.035);
  };
})();
