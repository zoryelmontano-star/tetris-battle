// Tetris Battle v8: interactive battle presentation + attack-free Party mode.
(() => {
  const $i = id => document.getElementById(id);
  const boardShell = document.querySelector('.board-shell');
  const attackBox = $i('attack')?.closest('.hud-box');
  const attackLabel = attackBox?.querySelector('span');
  const rankCard = $i('rankCard');
  const sideCard = document.querySelector('.side-card');
  let partyLines = 0;
  let countdownRunning = false;
  let lastShownScore = -1;

  // Extra FX layer over the board.
  if (boardShell && !$i('fxLayer')) {
    const fx = document.createElement('div');
    fx.id = 'fxLayer';
    fx.className = 'fx-layer';
    boardShell.appendChild(fx);
  }

  // Party standings card. Real opponents will populate this when realtime backend is connected.
  if (sideCard && !$i('partyStandings')) {
    const panel = document.createElement('div');
    panel.id = 'partyStandings';
    panel.className = 'party-standings hidden';
    panel.innerHTML = `
      <div class="party-head"><span>PARTY STANDINGS</span><b>2:00 SCORE RACE</b></div>
      <div class="party-me"><span class="party-place">1</span><div><strong id="partyName">You</strong><small><b id="partyLines">0</b> lines</small></div><b id="partyScore">0</b></div>
      <div class="party-waiting">Waiting for the other players…</div>
      <div class="party-session"><span>SESSION WINS</span><strong id="partyWins">0</strong></div>
    `;
    const queue = sideCard.querySelector('.queue-card');
    if (queue) queue.insertAdjacentElement('afterend', panel);
    else sideCard.prepend(panel);
  }

  const style = document.createElement('style');
  style.textContent = `
    .fx-layer{position:absolute;inset:0;overflow:hidden;border-radius:18px;pointer-events:none;z-index:3}
    .score-burst{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);font-size:28px;font-weight:1000;color:#f6e2ac;text-shadow:0 3px 14px rgba(0,0,0,.7);animation:scoreBurst .9s ease-out forwards;white-space:nowrap}
    @keyframes scoreBurst{0%{opacity:0;transform:translate(-50%,-20%) scale(.7)}18%{opacity:1;transform:translate(-50%,-50%) scale(1.16)}70%{opacity:1}100%{opacity:0;transform:translate(-50%,-115%) scale(.95)}}
    .fx-particle{position:absolute;left:50%;top:50%;width:7px;height:7px;border-radius:2px;background:var(--p);box-shadow:0 0 10px color-mix(in srgb,var(--p),transparent 35%);animation:particleFly .82s ease-out forwards}
    @keyframes particleFly{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) rotate(var(--r)) scale(.2)}}
    .clear-flash::after{content:'';position:absolute;inset:0;border-radius:18px;background:rgba(255,255,255,.16);animation:clearFlash .34s ease-out;pointer-events:none;z-index:2}
    @keyframes clearFlash{from{opacity:1}to{opacity:0}}
    .impact{animation:arenaImpact .28s ease-out}@keyframes arenaImpact{25%{transform:translateX(-3px)}50%{transform:translateX(3px)}75%{transform:translateX(-1px)}100%{transform:translateX(0)}}
    .hud-box.score-pulse{animation:scorePulse .35s ease}@keyframes scorePulse{50%{transform:scale(1.08);border-color:#b98b6a;box-shadow:0 0 18px rgba(217,168,90,.18)}}
    .party-standings{margin:14px 0 2px;padding:13px;border-radius:15px;background:linear-gradient(180deg,#211b21,#171418);border:1px solid #423741}
    .party-head{display:flex;justify-content:space-between;gap:8px;color:#9b8e97;font-size:9px;font-weight:900;letter-spacing:.08em;margin-bottom:10px}.party-head b{color:#e0bd7b}
    .party-me{display:grid;grid-template-columns:25px 1fr auto;align-items:center;gap:8px;padding:9px;border-radius:11px;background:#141116;border:1px solid #372e36}.party-place{width:24px;height:24px;display:grid;place-items:center;border-radius:8px;background:linear-gradient(145deg,#b96b86,#d9a85a);font-weight:1000}.party-me strong,.party-me small{display:block}.party-me small{color:#8f828b;font-size:9px;margin-top:2px}.party-me>b{font-size:17px;color:#f1d29a}.party-waiting{padding:9px 3px;color:#756a72;font-size:10px;text-align:center}.party-session{display:flex;justify-content:space-between;align-items:center;padding-top:9px;border-top:1px solid #382f36;color:#8f828b;font-size:9px;font-weight:900;letter-spacing:.08em}.party-session strong{font-size:18px;color:#d8a765}
    .countdown-big{font-size:72px!important;font-weight:1000;letter-spacing:-.05em;text-shadow:0 10px 30px rgba(0,0,0,.45);animation:countPop .48s ease both}@keyframes countPop{0%{opacity:0;transform:scale(.4)}35%{opacity:1;transform:scale(1.18)}100%{opacity:1;transform:scale(1)}}
    .go-text{color:#e7c77f!important}
  `;
  document.head.appendChild(style);

  function partyMode() { return gameMode === 'party'; }

  function updateModeUI() {
    const party = partyMode();
    if (attackLabel) attackLabel.textContent = party ? 'LINES' : 'ATTACK';
    if ($i('attack') && party) $i('attack').textContent = partyLines;
    if (rankCard) rankCard.classList.toggle('hidden', party);
    $i('partyStandings')?.classList.toggle('hidden', !party);
    if ($i('partyName')) $i('partyName').textContent = $i('playerName')?.value.trim() || 'You';
    if ($i('partyLines')) $i('partyLines').textContent = partyLines;
    if ($i('partyScore')) $i('partyScore').textContent = Number(score || 0).toLocaleString();
    if ($i('partyWins')) $i('partyWins').textContent = Number(sessionWins || 0);
  }

  // Party mode never displays garbage/attack messaging.
  const originalToast = toast;
  toast = function(title, sub = '') {
    if (partyMode()) {
      sub = sub
        .replace(/Board zero\s*[·•]\s*\+\d+ garbage attack/i, 'Board cleared completely!')
        .replace(/\+\d+ attack\s*[·•]\s*/i, '')
        .replace(/\+\d+ garbage attack/i, 'Perfect clear!');
    }
    return originalToast(title, sub);
  };

  function emitBurst(lines, gained, perfect) {
    if (!boardShell) return;
    boardShell.classList.remove('clear-flash');
    void boardShell.offsetWidth;
    boardShell.classList.add('clear-flash');
    setTimeout(() => boardShell.classList.remove('clear-flash'), 360);

    const layer = $i('fxLayer');
    if (!layer) return;
    const burst = document.createElement('div');
    burst.className = 'score-burst';
    burst.textContent = perfect ? `PERFECT! +${gained.toLocaleString()}` : `+${gained.toLocaleString()}`;
    layer.appendChild(burst);
    setTimeout(() => burst.remove(), 950);

    const count = perfect ? 30 : lines === 4 ? 22 : 8 + lines * 4;
    const colors = ['#d9a85a','#b96b86','#79b99e','#d9896a','#a386bd','#e6d28b'];
    for (let n = 0; n < count; n++) {
      const p = document.createElement('i');
      p.className = 'fx-particle';
      p.style.setProperty('--p', colors[n % colors.length]);
      p.style.setProperty('--x', `${Math.round((Math.random()-.5)*250)}px`);
      p.style.setProperty('--y', `${Math.round((Math.random()-.72)*260)}px`);
      p.style.setProperty('--r', `${Math.round((Math.random()-.5)*480)}deg`);
      layer.appendChild(p);
      setTimeout(() => p.remove(), 900);
    }

    if (lines >= 3 || perfect) {
      arenaCard.classList.remove('impact');
      void arenaCard.offsetWidth;
      arenaCard.classList.add('impact');
      setTimeout(() => arenaCard.classList.remove('impact'), 320);
    }
  }

  const originalClearLines = clearLines;
  clearLines = function() {
    const lines = board.reduce((n, row) => n + (row.every(Boolean) ? 1 : 0), 0);
    const before = score;
    originalClearLines();
    if (lines > 0) {
      if (partyMode()) partyLines += lines;
      const gained = Math.max(0, score - before);
      const perfect = typeof emptyBoard === 'function' && emptyBoard();
      emitBurst(lines, gained, perfect);
      updateModeUI();
    }
  };

  const originalUpdateHud = updateHud;
  updateHud = function() {
    originalUpdateHud();
    if (partyMode() && $i('attack')) $i('attack').textContent = partyLines;
    updateModeUI();
    if (score !== lastShownScore) {
      const scoreBox = $i('score')?.closest('.hud-box');
      if (scoreBox && lastShownScore >= 0) {
        scoreBox.classList.remove('score-pulse');
        void scoreBox.offsetWidth;
        scoreBox.classList.add('score-pulse');
      }
      lastShownScore = score;
    }
  };

  const originalOpenGame = openGame;
  openGame = function(code) {
    partyLines = 0;
    const result = originalOpenGame(code);
    updateModeUI();
    return result;
  };

  // Replace Start listener so every round gets an arcade 3-2-1-GO intro.
  const oldStart = $i('startBtn');
  if (oldStart) {
    const fresh = oldStart.cloneNode(true);
    oldStart.replaceWith(fresh);
    fresh.addEventListener('click', async () => {
      if (countdownRunning) return;
      countdownRunning = true;
      partyLines = 0;
      lastShownScore = -1;
      if (gameRunning) {
        paused = true;
        if (typeof stopMusic === 'function') stopMusic();
      }
      overlay.classList.remove('hidden');
      const title = $i('overlayTitle');
      const text = $i('overlayText');
      text.textContent = partyMode() ? 'Highest score after 2 minutes wins the round.' : 'Build combos, send pressure, and survive.';
      for (const word of ['3','2','1','GO!']) {
        title.textContent = word;
        title.className = `countdown-big ${word === 'GO!' ? 'go-text' : ''}`;
        if (sfxOn && typeof tone === 'function') tone(word === 'GO!' ? 880 : 520, word === 'GO!' ? .14 : .07, 'square', word === 'GO!' ? .055 : .035);
        await new Promise(r => setTimeout(r, word === 'GO!' ? 380 : 480));
      }
      title.className = '';
      countdownRunning = false;
      startGame();
      updateModeUI();
    });
  }

  // Mode buttons immediately reshape the HUD and side panels.
  document.querySelectorAll('.mode-card').forEach(btn => btn.addEventListener('click', () => setTimeout(updateModeUI, 0)));

  updateModeUI();
})();