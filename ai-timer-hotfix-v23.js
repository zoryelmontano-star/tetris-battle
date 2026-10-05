// v23: visible AI rival tile and hard-reset timed rounds before restart.
(() => {
  const $ = id => document.getElementById(id);

  function resetTimedRoundClock() {
    if (gameMode === 'solo') return;
    try { clearInterval(timerInterval); } catch {}
    timeLeft = ROUND_TIME;
    try { setPanic(false); } catch {}
    try { updateHud(); } catch {}
    if ($('timer')) $('timer').textContent = typeof formatTime === 'function' ? formatTime(ROUND_TIME) : '02:00';
  }

  $('startBtn')?.addEventListener('click', resetTimedRoundClock, true);

  const priorStartGame = startGame;
  startGame = function() {
    if (gameMode !== 'solo') resetTimedRoundClock();
    const out = priorStartGame();
    if (window.TBAIMode) {
      const start = $('startBtn');
      if (start) {
        start.classList.remove('hidden');
        start.textContent = 'New AI Game';
      }
    }
    return out;
  };

  function ensureAITile() {
    const grid = $('liveArenaGrid');
    if (!grid) return null;
    let tile = $('live-ai-rival');
    if (tile) return tile;

    tile = document.createElement('section');
    tile.id = 'live-ai-rival';
    tile.className = 'live-player-tile ai-live-tile';
    tile.style.order = '2';
    tile.innerHTML = `
      <div class="live-player-head">
        <span class="live-place">AI</span>
        <div><strong>AI RIVAL</strong><small>CPU · LIVE</small></div>
        <b class="live-ko">0 / 5 KO</b>
      </div>
      <div class="remote-board-shell ai-board-shell">
        <canvas width="200" height="400" aria-label="AI rival board"></canvas>
      </div>
      <div class="remote-status-row"><span>AI OPPONENT</span><b>ACTIVE</b></div>`;
    grid.appendChild(tile);
    return tile;
  }

  function showAITile() {
    const active = !!window.TBAIMode && gameMode === 'duel' && !game.classList.contains('hidden');
    const existing = $('live-ai-rival');
    if (!active) {
      existing?.remove();
      return;
    }

    const grid = $('liveArenaGrid');
    if (!grid) return;
    grid.classList.remove('party');
    grid.classList.add('duel');
    $('live-waiting')?.remove();

    const tile = ensureAITile();
    if (!tile) return;
    const ko = Number($('rivalKO')?.textContent || 0);
    tile.querySelector('.live-ko').textContent = `${ko} / 5 KO`;
    tile.querySelector('strong').textContent = ($('rivalName')?.textContent || 'AI RIVAL').toUpperCase();

    const start = $('startBtn');
    if (start) {
      start.classList.remove('hidden');
      start.textContent = gameRunning ? 'New AI Game' : 'Start AI Battle';
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    .ai-live-tile{border-color:#9b7a58!important;box-shadow:0 0 0 1px rgba(217,168,90,.16),0 15px 34px rgba(0,0,0,.28)!important}
    .ai-live-tile .live-place{color:#23190e;background:linear-gradient(145deg,#e3c27c,#b98645);border-color:#e6ca90}
    .ai-live-tile .remote-status-row b{color:#a9d093}
    .live-arena-grid.duel .ai-live-tile .remote-board-shell{width:min(100%,300px);max-width:300px}
    @media(max-width:720px){.live-arena-grid.duel .ai-live-tile .remote-board-shell{width:100%;max-width:none}}
  `;
  document.head.appendChild(style);

  setInterval(showAITile, 100);

  $('battleAIBtn')?.addEventListener('click', () => {
    resetTimedRoundClock();
    setTimeout(showAITile, 30);
  });

  $('quitBtn')?.addEventListener('click', () => setTimeout(() => {
    $('live-ai-rival')?.remove();
    if (!window.TBAIMode && gameMode !== 'solo') $('startBtn')?.classList.add('hidden');
  }, 30));

  window.TBAIHotfix = { showAITile, resetTimedRoundClock };
})();
