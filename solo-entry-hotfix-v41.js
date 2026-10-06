// v42: Solo opens and starts immediately after Start Solo; no Ready step.
(() => {
  const $ = id => document.getElementById(id);
  let autoStartArmed = false;

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
    $('startSoloGameBtn')?.classList.add('hidden');
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
    if ($('playerState')) $('playerState').textContent = (typeof gameRunning !== 'undefined' && gameRunning) ? 'Playing' : 'Solo';
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

  function beginSoloNow(){
    if (!autoStartArmed) return;
    if (!openSoloIfNeeded()) return;
    try {
      if (typeof gameRunning === 'undefined' || !gameRunning) startGame();
      autoStartArmed = false;
      normalizeSoloGameUI();
      $('overlay')?.classList.add('hidden');
      if ($('playerState')) $('playerState').textContent = 'Playing';
    } catch (err) {
      console.error('Solo auto-start failed', err);
    }
  }

  document.addEventListener('click', event => {
    const soloCard = event.target?.closest?.('#soloModeCard,.mode-card[data-mode="solo"]');
    if (soloCard) {
      prepareSoloUI();
      setTimeout(() => {
        prepareSoloUI();
        window.TBModeFlow?.showSetup?.('solo', false);
      }, 150);
      return;
    }

    const start = event.target?.closest?.('#startSoloBtn');
    if (start) {
      autoStartArmed = true;
      prepareSoloUI();
      // Original Solo handler chooses the selected Sprint/Marathon and opens the board.
      // We then start that board automatically, removing the second Ready/Start step.
      [0,60,140,260].forEach(delay => setTimeout(beginSoloNow, delay));
    }
  }, false);

  new MutationObserver(() => {
    if (!autoStartArmed) return;
    const gameEl = $('game');
    if (!gameEl || gameEl.classList.contains('hidden')) return;
    if (typeof gameMode === 'undefined' || gameMode !== 'solo') return;
    beginSoloNow();
  }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
})();
