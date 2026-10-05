// Tetris Battle v5: upgraded arcade music, celebratory SFX, and voice callouts.
(() => {
  const $a = id => document.getElementById(id);
  let voiceOn = localStorage.getItem('tb_voice') !== 'off';
  let voiceBtn = $a('voiceBtn');

  if (!voiceBtn) {
    const audioControls = document.querySelector('.audio-controls');
    if (audioControls) {
      voiceBtn = document.createElement('button');
      voiceBtn.id = 'voiceBtn';
      voiceBtn.className = 'mini-btn';
      audioControls.insertBefore(voiceBtn, $a('installBtn') || null);
    }
  }

  function updateVoiceBtn() {
    if (voiceBtn) voiceBtn.textContent = voiceOn ? '◉ Voice On' : '◉ Voice Off';
  }

  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
      voiceOn = !voiceOn;
      localStorage.setItem('tb_voice', voiceOn ? 'on' : 'off');
      updateVoiceBtn();
      if (!voiceOn && 'speechSynthesis' in window) speechSynthesis.cancel();
      if (voiceOn) speak('Ready!', { rate: 1.18, pitch: 1.22, volume: .78, cancel: true });
    });
  }
  updateVoiceBtn();

  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const voices = speechSynthesis.getVoices();
    if (!voices.length) return null;
    return voices.find(v => /en-US/i.test(v.lang) && /Aria|Jenny|Samantha|Google|Zira|Female/i.test(v.name))
      || voices.find(v => /en-US/i.test(v.lang))
      || voices.find(v => /^en/i.test(v.lang))
      || voices[0];
  }

  function speak(text, opts = {}) {
    if (!voiceOn || !('speechSynthesis' in window)) return;
    if (opts.cancel) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = pickVoice();
    u.lang = u.voice?.lang || 'en-US';
    u.rate = opts.rate ?? 1.16;
    u.pitch = opts.pitch ?? 1.18;
    u.volume = opts.volume ?? .72;
    if (opts.delay) setTimeout(() => speechSynthesis.speak(u), opts.delay);
    else speechSynthesis.speak(u);
  }

  // --- Richer music engine ---
  let arcadeTimer = null;
  let step = 0;
  let musicGeneration = 0;
  const ARP = [
    261.63, 329.63, 392.00, 523.25,
    293.66, 369.99, 440.00, 587.33,
    246.94, 311.13, 392.00, 493.88,
    220.00, 277.18, 329.63, 440.00
  ];
  const BASS = [130.81, 146.83, 123.47, 110.00];

  function ac() {
    return typeof audio === 'function' ? audio() : null;
  }

  function synth(freq, dur, type, vol, when = 0, detune = 0) {
    if (!musicOn) return;
    const c = ac();
    if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.detune.setValueAtTime(detune, t);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .008);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + .03);
  }

  function kick(vol = .07) {
    if (!musicOn) return;
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + .12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + .14);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + .15);
  }

  function snare(vol = .022) {
    if (!musicOn) return;
    const c = ac();
    if (!c) return;
    const length = Math.floor(c.sampleRate * .08);
    const buffer = c.createBuffer(1, length, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    filter.type = 'highpass';
    filter.frequency.value = 1500;
    gain.gain.value = vol;
    src.buffer = buffer;
    src.connect(filter); filter.connect(gain); gain.connect(c.destination);
    src.start();
  }

  function musicTick(gen) {
    if (gen !== musicGeneration || !musicOn || !gameRunning || paused) return;
    const fast = !!panicMode;
    const interval = fast ? 82 : 112;
    const s = step % 16;
    const chord = Math.floor(step / 16) % 4;

    if (s === 0 || s === 8 || (fast && (s === 4 || s === 12))) kick(fast ? .075 : .06);
    if (s === 4 || s === 12) snare(fast ? .03 : .022);

    if (s % 4 === 0) {
      synth(BASS[chord], fast ? .12 : .16, 'triangle', fast ? .032 : .026);
      synth(BASS[chord] * 2, .08, 'sawtooth', .008, .01);
    }

    const note = ARP[(s + chord * 4) % ARP.length];
    synth(note, fast ? .065 : .08, 'square', fast ? .015 : .011);
    if (s % 2 === 1) synth(note * 2, .045, 'triangle', .006);

    if (s === 0) {
      [1, 1.25, 1.5].forEach((ratio, i) => synth(BASS[chord] * 2 * ratio, .20, 'sine', .008, i * .01));
    }

    step++;
    arcadeTimer = setTimeout(() => musicTick(gen), interval);
  }

  function arcadeStartMusic() {
    clearTimeout(arcadeTimer);
    musicGeneration++;
    step = 0;
    if (!musicOn || !gameRunning || paused) return;
    const gen = musicGeneration;
    musicTick(gen);
  }

  function arcadeStopMusic() {
    musicGeneration++;
    clearTimeout(arcadeTimer);
    arcadeTimer = null;
  }

  startMusic = arcadeStartMusic;
  stopMusic = arcadeStopMusic;
  restartMusic = function () {
    arcadeStopMusic();
    if (gameRunning && !paused && musicOn) arcadeStartMusic();
  };

  // --- Celebratory scoring SFX ---
  function chime(notes, spacing = .045, vol = .045) {
    notes.forEach((f, i) => {
      if (typeof tone === 'function') tone(f, .12 + i * .01, i % 2 ? 'sine' : 'triangle', vol, i * spacing);
    });
  }

  clearSfx = function (lines, comboCount, perfect) {
    if (!sfxOn) return;

    if (perfect) {
      chime([523.25,659.25,783.99,1046.50,1318.51], .055, .055);
      if (typeof tone === 'function') {
        tone(261.63, .32, 'sawtooth', .025, 0);
        tone(523.25, .30, 'triangle', .035, .08);
      }
      speak('Perfect clear!', { cancel: true, rate: 1.12, pitch: 1.32, volume: .9 });
      return;
    }

    if (lines === 4) {
      chime([392,523.25,659.25,783.99], .05, .05);
      speak('Tetris!', { cancel: true, rate: 1.14, pitch: 1.30, volume: .88 });
    } else if (lines === 3) {
      chime([349.23,440,523.25], .05, .045);
      speak('Triple!', { cancel: true, rate: 1.18, pitch: 1.24, volume: .8 });
    } else if (lines === 2) {
      chime([329.63,440], .055, .04);
      speak('Double!', { cancel: true, rate: 1.18, pitch: 1.20, volume: .76 });
    } else {
      chime([329.63,392], .04, .032);
      if (comboCount === 0 && Math.random() < .35) speak('Nice!', { cancel: true, rate: 1.20, pitch: 1.18, volume: .68 });
    }

    if (comboCount > 0) {
      const comboRoot = 520 + Math.min(comboCount, 10) * 28;
      chime([comboRoot, comboRoot + 120, comboRoot + 220], .035, Math.min(.055, .035 + comboCount * .002));
      const phrase = comboCount >= 5 ? `Amazing! Combo ${comboCount}!` : `Combo ${comboCount}!`;
      speak(phrase, { cancel: lines >= 4, delay: lines >= 2 ? 220 : 40, rate: 1.22, pitch: 1.26, volume: .82 });
    }
  };

  sfxWin = function () {
    if (sfxOn) chime([392,523.25,659.25,783.99,1046.50], .07, .055);
    speak('You win! Crown retained!', { cancel: true, rate: 1.10, pitch: 1.28, volume: .92 });
  };

  sfxLose = function () {
    if (sfxOn && typeof tone === 'function') {
      [260,220,180,145].forEach((f, i) => tone(f, .16, 'triangle', .028, i * .07));
    }
    speak('You lose.', { cancel: true, rate: 1.02, pitch: .88, volume: .78 });
  };

  sfxEnd = function () {
    if (sfxOn) chime([330,392,440], .06, .035);
    speak('Time!', { cancel: true, rate: 1.08, pitch: 1.05, volume: .72 });
  };

  countdownSfx = function (n) {
    if (sfxOn && typeof tone === 'function') {
      const f = n <= 3 ? 900 : 610;
      tone(f, n <= 3 ? .11 : .07, 'square', n <= 3 ? .055 : .035);
      if (n <= 3) tone(f * 1.5, .08, 'triangle', .025, .03);
    }
    if (voiceOn && n <= 3) speak(String(n), { cancel: true, rate: 1.28, pitch: 1.25, volume: .86 });
  };

  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => pickVoice();
})();
