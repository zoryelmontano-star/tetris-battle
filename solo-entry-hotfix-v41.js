// v41: make Solo entry deterministic and auto-start the selected Solo run on touch/desktop.
(() => {
  const $ = id => document.getElementById(id);

  function prepareSoloUI() {
    try { gameMode = 'solo'; } catch {}
    try { localStorage.setItem('tb_mode','solo'); } catch {}
    const opts = $('soloOptions');
    if (opts) opts.classList.remove('hidden');
    document.querySelectorAll('.mode-card').forEach(card => card.classList.toggle('active', card.dataset.mode === 'solo'));
  }

  function normalizeSoloGameUI() {
    const gameEl = $('game');
    if (!gameEl || gameEl.classList.contains('hidden')) return false;
    gameEl.classList.add('solo-live-mode');
    document.querySelector('.room-pill')?.classList.add('hidden');
    $('readyBtn')?.classList.add('hidden');
    $('readyPanel')?.classList.add('hidden');
    $('duelMonitor')?.classList.add('hidden');
    $('partyStandings')?.classList.add('hidden');
    const grid = $('liveArenaGrid');
    if (grid) {
      grid.classList.add('solo');
      grid.classList.remove('duel','party');
      grid.querySelectorAll('.remote-live-tile').forEach(x => x.remove());
    }
    $('soloStatus')?.classList.remove('hidden');
    $('roomCodeDisplay') && ($('roomCodeDisplay').textContent = 'SOLO');
    $('playerState') && ($('playerState').textContent = 'Solo');
    return true;
  }

  function forceOpenSolo() {
    prepareSoloUI();
    const gameEl = $('game');
    if (gameEl?.classList.contains('hidden')) {
      try { openGame('SOLO'); } catch (err) { console.error('Solo open fallback failed', err); return; }
    }
    try { window.TBMultiplayer?.disconnect?.(); } catch {}
    normalizeSoloGameUI();
  }

  function startSoloIfNeeded() {
    forceOpenSolo();
    if (typeof gameRunning !== 'undefined' && gameRunning) return;
    try { startGame(); } catch (err) { console.error('Solo start fallback failed', err); }
    normalizeSoloGameUI();
  }

  // Keep the Solo card/setup flow working even if later lobby wrappers override older listeners.
  document.addEventListener('click', event => {
    const soloCard = event.target?.closest?.('#soloModeCard,.mode-card[data-mode="solo"]');
    if (soloCard) {
      prepareSoloUI();
      setTimeout(() => {
        prepareSoloUI();
        window.TBModeFlow?.showSetup?.('solo', false);
      }, 160);
      return;
    }

    const start = event.target?.closest?.('#startSoloBtn');
    if (start) {
      prepareSoloUI();
      // Let the original Solo handler run first; then repair/open/start only if needed.
      setTimeout(() => {
        forceOpenSolo();
        setTimeout(startSoloIfNeeded, 90);
      }, 120);
    }
  }, false);

  // If Solo was opened but the old mobile action row is hidden, start it automatically.
  const observer = new MutationObserver(() => {
    const gameEl = $('game');
    if (!gameEl || gameEl.classList.contains('hidden')) return;
    if (typeof gameMode === 'undefined' || gameMode !== 'solo') return;
    normalizeSoloGameUI();
  });
  observer.observe(document.body, {subtree:true, attributes:true, attributeFilter:['class']});
})();
