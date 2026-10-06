// v43: Solo has no Ready button. Start Solo opens the board, runs READY? 3-2-1-GO, then starts automatically.
(() => {
  const $ = id => document.getElementById(id);
  let countdownToken = 0;
  let soloStarting = false;

  function prepareSoloUI(){
    try { gameMode = 'solo'; } catch {}
    try { localStorage.setItem('tb_mode','solo'); } catch {}
    $('soloOptions')?.classList.remove('hidden');
    document.querySelectorAll('.mode-card').forEach(card => card.classList.toggle('active', card.dataset.mode === 'solo'));
  }

  function normalizeSoloGameUI(){
    const gameEl = $('game');
    if (!gameEl || gameEl.classList.contains('hidden')) return false;
    gameEl.classList.add('solo-live-mode');
    document.querySelector('.room-pill')?.classList.add('hidden');
    $('readyBtn')?.classList.add('hidden');
    $('readyPanel')?.classList.add('hidden');
    $('hostStartBtn')?.classList.add('hidden');
    $('startSoloGameBtn')?.classList.add('hidden');
    $('startBtn')?.classList.add('hidden');
    $('duelMonitor')?.classList.add('hidden');
    $('partyStandings')?.classList.add('hidden');
    const grid = $('liveArenaGrid');
    if (grid) {
      grid.classList.add('solo');
      grid.classList.remove('duel','party');
      grid.querySelectorAll('.remote-live-tile').forEach(x => x.remove());
    }
    $('soloStatus')?.classList.remove('hidden');
    if ($('roomCodeDisplay')) $('roomCodeDisplay').textContent = 'SOLO';
    if ($('playerState')) $('playerState').textContent = (typeof gameRunning !== 'undefined' && gameRunning) ? 'Playing' : (soloStarting ? 'Starting' : 'Solo');
    return true;
  }

  function openSoloIfNeeded(){
    prepareSoloUI();
    const gameEl = $('game');
    if (gameEl?.classList.contains('hidden')) {
      try { openGame('SOLO'); } catch (err) { console.error('Solo open failed', err); return false; }
    }
    try { window.TBMultiplayer?.disconnect?.(); } catch {}
    normalizeSoloGameUI();
    return true;
  }

  function pulseOverlay(title, text='Get ready for your solo run.'){
    const ov = $('overlay');
    const t = $('overlayTitle');
    const p = $('overlayText');
    if (!ov || !t || !p) return;
    t.textContent = title;
    p.textContent = text;
    ov.classList.remove('hidden');
    t.style.animation = 'none';
    void t.offsetWidth;
    t.style.animation = '';
  }

  function wait(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

  async function runSoloCountdown(){
    const token = ++countdownToken;
    soloStarting = true;
    if (!openSoloIfNeeded()) { soloStarting = false; return; }
    normalizeSoloGameUI();

    try {
      // Make sure no prior run is active while the countdown is showing.
      if (typeof gameRunning !== 'undefined' && gameRunning) {
        gameRunning = false;
        try { clearInterval(timerInterval); } catch {}
        try { cancelAnimationFrame(animationId); } catch {}
        try { if (typeof stopMusic === 'function') stopMusic(); } catch {}
      }
    } catch {}

    pulseOverlay('READY?','Your solo run starts automatically.');
    await wait(550);
    if (token !== countdownToken || gameMode !== 'solo') return;

    for (const n of ['3','2','1']) {
      pulseOverlay(n,'Get ready…');
      await wait(1000);
      if (token !== countdownToken || gameMode !== 'solo') return;
    }

    pulseOverlay('GO!','');
    await wait(500);
    if (token !== countdownToken || gameMode !== 'solo') return;

    try {
      startGame();
      soloStarting = false;
      normalizeSoloGameUI();
      $('overlay')?.classList.add('hidden');
      if ($('playerState')) $('playerState').textContent = 'Playing';
    } catch (err) {
      soloStarting = false;
      console.error('Solo auto-start failed', err);
    }
  }

  document.addEventListener('click', event => {
    const soloCard = event.target?.closest?.('#soloModeCard,.mode-card[data-mode="solo"]');
    if (soloCard) {
      countdownToken++;
      soloStarting = false;
      prepareSoloUI();
      setTimeout(() => {
        prepareSoloUI();
        window.TBModeFlow?.showSetup?.('solo', false);
      }, 150);
      return;
    }

    const start = event.target?.closest?.('#startSoloBtn');
    if (start) {
      prepareSoloUI();
      // Let Solo's original click handler select/open Sprint or Marathon first.
      setTimeout(runSoloCountdown, 40);
      return;
    }

    if (event.target?.closest?.('#quitBtn,[data-touch-action="quit"]')) {
      countdownToken++;
      soloStarting = false;
    }
  }, false);

  new MutationObserver(() => {
    if (typeof gameMode === 'undefined' || gameMode !== 'solo') return;
    const gameEl = $('game');
    if (!gameEl || gameEl.classList.contains('hidden')) return;
    normalizeSoloGameUI();
  }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
})();
