// Tetris Battle v13: Solo Session with classic Tetris Battle Sprint + Marathon goals.
(() => {
  const $ = id => document.getElementById(id);
  const modeGrid = document.querySelector('.mode-grid');
  if (!modeGrid || $('soloModeCard')) return;

  let soloType = localStorage.getItem('tb_solo_type') || 'sprint';
  let soloLines = 0;
  let soloElapsed = 0;
  let marathonLevel = 1;
  let marathonProgress = 0;
  let soloFinished = false;

  const soloCard = document.createElement('button');
  soloCard.id = 'soloModeCard';
  soloCard.className = 'mode-card';
  soloCard.dataset.mode = 'solo';
  soloCard.innerHTML = `<span class="mode-icon">◆</span><strong>Solo Session</strong><small>Play Sprint 40 Lines or the original 15-level Marathon without a room or opponents.</small>`;
  modeGrid.appendChild(soloCard);

  const soloOptions = document.createElement('div');
  soloOptions.id = 'soloOptions';
  soloOptions.className = 'solo-options hidden';
  soloOptions.innerHTML = `
    <div class="solo-choice-row">
      <button class="solo-choice" data-solo="sprint"><b>Sprint 40L</b><span>Clear 40 lines as fast as possible.</span></button>
      <button class="solo-choice" data-solo="marathon"><b>Marathon</b><span>15 levels with increasing line goals.</span></button>
    </div>
    <button id="startSoloBtn" class="primary solo-start">Start Solo</button>
  `;
  modeGrid.insertAdjacentElement('afterend', soloOptions);

  const arena = $('arenaCard');
  if (arena && !$('soloStatus')) {
    const status = document.createElement('div');
    status.id = 'soloStatus';
    status.className = 'solo-status hidden';
    status.innerHTML = `<span id="soloModeName">SPRINT 40L</span><strong id="soloGoalText">0 / 40 LINES</strong><b id="soloTimeText">00:00</b>`;
    arena.insertBefore(status, arena.querySelector('.hud'));
  }

  const style = document.createElement('style');
  style.textContent = `
    .mode-grid{grid-template-columns:repeat(3,minmax(0,1fr))}
    .solo-options{margin:0 0 18px;padding:14px;border-radius:16px;background:#19151a;border:1px solid #3e343d}
    .solo-choice-row{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:10px}.solo-choice{text-align:left;padding:13px}.solo-choice b,.solo-choice span{display:block}.solo-choice span{margin-top:4px;color:#9b8e97;font-size:11px;line-height:1.4}.solo-choice.active{border-color:#b7896c;background:linear-gradient(180deg,rgba(217,168,90,.13),rgba(185,107,134,.08))}.solo-start{width:100%}
    .solo-status{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;margin:0 0 11px;padding:10px 12px;border-radius:13px;background:linear-gradient(90deg,rgba(185,107,134,.12),rgba(217,168,90,.08));border:1px solid #443842}.solo-status span{font-size:10px;font-weight:1000;letter-spacing:.11em;color:#c89aac}.solo-status strong{font-size:12px;color:#f0d197}.solo-status b{font-size:18px;color:#f5eee8}
    #game.solo-live-mode{grid-template-columns:minmax(0,1fr) 250px!important}#game.solo-live-mode>.side-card{display:block!important}.live-arena-grid.solo{grid-template-columns:minmax(0,1fr)!important;max-width:600px;margin-left:auto;margin-right:auto}.live-arena-grid.solo .local-live-tile .play-stage{grid-template-columns:105px minmax(0,330px) 105px!important}.live-arena-grid.solo .local-live-tile .hold-panel,.live-arena-grid.solo .local-live-tile .next-panel{width:105px!important}.live-arena-grid.solo .local-live-tile .board-shell{width:min(100%,330px)!important}.live-arena-grid.solo .live-ko{display:none!important}
    @media(max-width:800px){.mode-grid{grid-template-columns:1fr}.solo-choice-row{grid-template-columns:1fr}.solo-status{grid-template-columns:1fr;text-align:center}#game.solo-live-mode{grid-template-columns:1fr!important}#game.solo-live-mode>.side-card{display:none!important}.live-arena-grid.solo .local-live-tile .play-stage{grid-template-columns:65px minmax(0,1fr) 65px!important}.live-arena-grid.solo .local-live-tile .hold-panel,.live-arena-grid.solo .local-live-tile .next-panel{width:65px!important}}
  `;
  document.head.appendChild(style);

  function isSolo() { return gameMode === 'solo'; }
  function marathonGoal(level = marathonLevel) { return level <= 5 ? 5 : level <= 10 ? 10 : 15; }
  function formatElapsed(s) { return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; }

  function updateSoloChoiceUI() {
    document.querySelectorAll('.solo-choice').forEach(b => b.classList.toggle('active', b.dataset.solo === soloType));
  }

  function updateSoloStatus() {
    if (!$('soloStatus')) return;
    $('soloStatus').classList.toggle('hidden', !isSolo());
    if (!isSolo()) return;
    if (soloType === 'sprint') {
      $('soloModeName').textContent = 'SPRINT 40L';
      $('soloGoalText').textContent = `${Math.min(40,soloLines)} / 40 LINES`;
    } else {
      $('soloModeName').textContent = `MARATHON · LEVEL ${marathonLevel} / 15`;
      $('soloGoalText').textContent = `${marathonProgress} / ${marathonGoal()} GOAL LINES`;
    }
    $('soloTimeText').textContent = formatElapsed(soloElapsed);
  }

  function setLobbyModeUI() {
    const solo = isSolo();
    $('soloOptions').classList.toggle('hidden', !solo);
    document.querySelectorAll('.room-name-field,.room-code-field,.room-code-help').forEach(el => el.classList.toggle('hidden', solo));
    document.querySelector('.lobby .actions')?.classList.toggle('hidden', solo);
    $('roomStatus')?.classList.toggle('hidden', solo);
    document.querySelectorAll('.mode-card').forEach(card => card.classList.toggle('active', card.dataset.mode === gameMode));
  }

  function setGameModeUI() {
    const solo = isSolo();
    document.querySelector('.room-pill')?.classList.toggle('hidden', solo);
    $('duelMonitor')?.classList.toggle('hidden', solo || gameMode !== 'duel');
    $('partyStandings')?.classList.toggle('hidden', solo || gameMode !== 'party');
    $('rankCard')?.classList.toggle('hidden', solo || gameMode === 'party');
    $('readyBtn')?.classList.toggle('hidden', solo);
    $('readyPanel')?.classList.toggle('hidden', solo);
    $('startSoloGameBtn')?.classList.toggle('hidden', !solo);
    const liveGrid = $('liveArenaGrid');
    if (liveGrid) {
      liveGrid.classList.toggle('solo', solo);
      if (solo) { liveGrid.classList.remove('duel','party'); liveGrid.querySelectorAll('.remote-live-tile').forEach(x=>x.remove()); }
    }
    $('game')?.classList.toggle('solo-live-mode', solo);
    updateSoloStatus();
  }

  soloCard.addEventListener('click', () => {
    gameMode = 'solo';
    localStorage.setItem('tb_mode','solo');
    setLobbyModeUI();
  });
  document.querySelectorAll('.mode-card:not(#soloModeCard)').forEach(card => card.addEventListener('click', () => setTimeout(setLobbyModeUI,0)));

  document.querySelectorAll('.solo-choice').forEach(btn => btn.addEventListener('click', () => {
    soloType = btn.dataset.solo;
    localStorage.setItem('tb_solo_type',soloType);
    updateSoloChoiceUI();
  }));

  function openSolo() {
    gameMode = 'solo';
    localStorage.setItem('tb_mode','solo');
    openGame('SOLO');
    window.TBMultiplayer?.disconnect();
    $('roomCodeDisplay').textContent = 'SOLO';
    $('modePill').textContent = soloType === 'sprint' ? 'SOLO SPRINT 40L' : 'SOLO MARATHON';
    $('playerState').textContent = 'Solo';
    setGameModeUI();
    setTimeout(() => $('startSoloGameBtn')?.focus(), 50);
  }

  $('startSoloBtn').addEventListener('click', openSolo);

  const bottomActions = document.querySelector('.bottom-actions');
  if (bottomActions && !$('startSoloGameBtn')) {
    const b = document.createElement('button');
    b.id = 'startSoloGameBtn';
    b.className = 'primary hidden';
    b.textContent = 'Start Solo';
    bottomActions.insertBefore(b, $('quitBtn'));
    b.addEventListener('click', () => {
      soloLines = 0; soloElapsed = 0; marathonLevel = 1; marathonProgress = 0; soloFinished = false;
      updateSoloStatus();
      const hiddenStart = $('startBtn');
      hiddenStart?.classList.remove('hidden');
      hiddenStart?.click();
      hiddenStart?.classList.add('hidden');
    });
  }

  const priorStartGame = startGame;
  startGame = function() {
    const result = priorStartGame();
    if (!isSolo()) return result;
    clearInterval(timerInterval);
    timeLeft = 0;
    soloElapsed = 0;
    soloFinished = false;
    setPanic(false);
    timerInterval = setInterval(() => {
      if (!gameRunning || paused || soloFinished) return;
      soloElapsed++;
      timeLeft = soloElapsed;
      updateSoloStatus();
    },1000);
    setGameModeUI();
    updateSoloStatus();
    return result;
  };

  function finishSolo(title, detail) {
    if (soloFinished) return;
    soloFinished = true;
    gameRunning = false;
    paused = false;
    clearInterval(timerInterval);
    cancelAnimationFrame(animationId);
    if (typeof stopMusic === 'function') stopMusic();
    if (typeof setPanic === 'function') setPanic(false);
    const bestKey = soloType === 'sprint' ? 'tb_sprint_best_ms' : 'tb_marathon_best_ms';
    const elapsedMs = soloElapsed * 1000;
    const oldBest = Number(localStorage.getItem(bestKey) || 0);
    if (!oldBest || elapsedMs < oldBest) localStorage.setItem(bestKey,String(elapsedMs));
    if (typeof saveSession === 'function') saveSession(title);
    $('playerState').textContent = 'Finished';
    $('overlayTitle').textContent = title;
    $('overlayText').textContent = detail;
    overlay.classList.remove('hidden');
    updateSoloStatus();
  }

  const priorClearLines = clearLines;
  clearLines = function() {
    if (!isSolo()) return priorClearLines();
    const cleared = board.reduce((n,row) => n + (row.every(Boolean) ? 1 : 0), 0);
    const result = priorClearLines();
    if (cleared > 0 && gameRunning && !soloFinished) {
      soloLines += cleared;
      if (soloType === 'sprint') {
        if (soloLines >= 40) finishSolo('SPRINT COMPLETE!', `40 lines in ${formatElapsed(soloElapsed)} · Score ${Number(score).toLocaleString()}`);
      } else {
        marathonProgress += cleared;
        const goal = marathonGoal();
        if (marathonProgress >= goal) {
          if (marathonLevel >= 15) {
            finishSolo('MARATHON COMPLETE!', `Level 15 cleared in ${formatElapsed(soloElapsed)} · Score ${Number(score).toLocaleString()}`);
          } else {
            marathonLevel++;
            marathonProgress = 0; // excess lines intentionally do not carry to the next level.
            if (typeof toast === 'function') toast(`LEVEL ${marathonLevel}`, `${marathonGoal()} lines to advance`);
          }
        }
      }
      updateSoloStatus();
    }
    return result;
  };

  const priorEndGame = endGame;
  endGame = function(reason) {
    if (!isSolo()) return priorEndGame(reason);
    if (reason === 'lose') {
      const result = priorEndGame(reason);
      $('overlayTitle').textContent = 'TOP OUT';
      $('overlayText').textContent = `${soloType === 'sprint' ? `${soloLines} / 40 lines` : `Level ${marathonLevel} · ${marathonProgress} / ${marathonGoal()} goal`} · ${formatElapsed(soloElapsed)}`;
      return result;
    }
    return priorEndGame(reason);
  };

  const priorRenderHistory = renderHistory;
  renderHistory = function() {
    const list = $('historyList');
    const h = JSON.parse(localStorage.getItem('tb_sessions') || '[]');
    if (!list || !h.length) return priorRenderHistory();
    list.innerHTML = h.slice(0,5).map(x => {
      const label = x.mode === 'duel' ? '1v1' : x.mode === 'party' ? 'Party' : 'Solo';
      return `<div class="history-item"><b>${label}</b> · ${Number(x.score).toLocaleString()} pts<br><span>${x.result} · ${x.date}</span></div>`;
    }).join('');
  };

  document.querySelectorAll('.mode-card').forEach(card => card.addEventListener('click', () => setTimeout(() => { setLobbyModeUI(); setGameModeUI(); },20)));
  updateSoloChoiceUI();
  setLobbyModeUI();
})();
