// v46: mode UX, shared pause/resume, and event-driven board enforcement.
(() => {
  const $u = id => document.getElementById(id);
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // ---------------- Mode labels and lobby simplification ----------------
  const duelCard = document.querySelector('.mode-card[data-mode="duel"]');
  const partyCard = document.querySelector('.mode-card[data-mode="party"]');
  if (duelCard) {
    duelCard.querySelector('strong').textContent = '1v1 Battle';
    duelCard.querySelector('small').textContent = 'First to 5 KOs wins';
  }
  if (partyCard) {
    partyCard.querySelector('strong').textContent = 'Battle Arena';
    partyCard.querySelector('small').textContent = '2 to 6 players · Multiplayer knockout battle';
  }

  function refreshLobbyUX() {
    const solo = gameMode === 'solo';
    const duel = gameMode === 'duel';
    const create = $u('createRoomBtn');
    const join = $u('joinRoomBtn');
    const roomName = document.querySelector('.room-name-field');
    const help = document.querySelector('.room-code-help');
    const status = $u('roomStatus');

    if (create) create.classList.toggle('hidden', solo || duel);
    if (roomName) roomName.classList.toggle('hidden', solo || duel);
    if (join && !solo) join.textContent = duel ? 'Find Opponent' : 'Join Arena';

    if (help && !solo) {
      help.textContent = duel
        ? '1v1 uses automatic matchmaking. No room code needed.'
        : 'Battle Arena supports 2 to 6 players. Create a private room or join friends with the room code.';
    }
    if (status && !solo && lobby && !lobby.classList.contains('hidden')) {
      status.textContent = duel
        ? 'Enter your player name, then find an opponent.'
        : 'Create or join a private Battle Arena.';
    }
  }

  document.querySelectorAll('.mode-card').forEach(card => card.addEventListener('click', () => setTimeout(refreshLobbyUX, 80)));
  refreshLobbyUX();

  const oldOpenGame = openGame;
  openGame = function(code) {
    const result = oldOpenGame(code);
    if (gameMode === 'duel' && $u('modePill')) $u('modePill').textContent = '1V1 BATTLE · FIRST TO 5 KO';
    if (gameMode === 'party' && $u('modePill')) $u('modePill').textContent = 'BATTLE ARENA · MAX 6P';
    setTimeout(refreshLobbyUX, 20);
    return result;
  };

  // ---------------- Solo: exactly ONE local board ----------------
  const soloStyle = document.createElement('style');
  soloStyle.textContent = `
    #game.solo-live-mode #liveArenaGrid .remote-live-tile{display:none!important}
    #game.solo-live-mode #liveArenaGrid{grid-template-columns:minmax(0,1fr)!important;max-width:620px!important;margin-left:auto!important;margin-right:auto!important}
    #game.solo-live-mode #localLiveTile{grid-column:1!important;width:100%!important}
  `;
  document.head.appendChild(soloStyle);

  function enforceSoloSingleBoard() {
    if (gameMode !== 'solo') return;
    const grid = $u('liveArenaGrid');
    if (!grid) return;
    grid.classList.add('solo');
    grid.classList.remove('duel', 'party');
    grid.querySelectorAll('.remote-live-tile').forEach(tile => tile.remove());
  }

  // ---------------- Battle Arena max 6 total (local + 5 remotes) ----------------
  function enforcePartyCap() {
    if (gameMode !== 'party' || !window.TBLiveGrid?.remotes) return;
    const all = [...TBLiveGrid.remotes.entries()]
      .filter(([, p]) => p.mode === 'party')
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    const allowed = new Set(all.slice(0, 5).map(([id]) => id));
    for (const [id] of all) {
      const tile = document.getElementById(`live-${id}`);
      if (tile) tile.classList.toggle('hidden', !allowed.has(id));
    }
  }

  const liveGrid = $u('liveArenaGrid');
  if (liveGrid) {
    new MutationObserver(() => {
      enforceSoloSingleBoard();
      enforcePartyCap();
    }).observe(liveGrid,{childList:true,subtree:false});
  }
  document.querySelectorAll('.mode-card').forEach(card => card.addEventListener('click', () => setTimeout(() => {
    enforceSoloSingleBoard();
    enforcePartyCap();
  }, 120)));

  // ---------------- Battle instruction text ----------------
  function instructionText() {
    if (gameMode === 'duel') return 'Send garbage. Score KOs. Reach 5 first.';
    if (gameMode === 'party') return 'Clear lines to send garbage. Score the most KOs before time runs out.';
    return 'Clear the goal and beat your best run.';
  }

  const overlayTitle = $u('overlayTitle');
  const overlayText = $u('overlayText');
  if (overlayTitle && overlayText) {
    const observer = new MutationObserver(() => {
      const title = overlayTitle.textContent.trim().toUpperCase();
      if (['READY?','READY','3','2','1','GO!'].includes(title)) overlayText.textContent = instructionText();
    });
    observer.observe(overlayTitle, { childList: true, characterData: true, subtree: true });
  }

  // ---------------- Shared pause / resume ----------------
  let resumeBusy = false;
  let resumeToken = '';
  let lastPauseToken = '';

  function showPaused(by = '') {
    if (!gameRunning) return;
    paused = true;
    $u('pauseBtn').textContent = '▶ Resume';
    $u('overlayTitle').textContent = 'PAUSED';
    $u('overlayText').textContent = gameMode === 'solo'
      ? 'Game paused.'
      : `${by || 'A player'} paused the match. Anyone can resume.`;
    overlay.classList.remove('hidden');
    if (typeof stopMusic === 'function') stopMusic();
  }

  function broadcastPause(reason = 'manual') {
    if (gameMode === 'solo' || !window.TBMultiplayer?.room) return;
    const token = `pause-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    lastPauseToken = token;
    TBMultiplayer.send('shared_pause', {
      token,
      reason,
      name: $u('playerName')?.value || 'Player',
      mode: gameMode
    });
  }

  function requestPause(reason = 'manual', broadcast = true, by = '') {
    if (!gameRunning || paused || resumeBusy) return;
    showPaused(by || ($u('playerName')?.value || 'Player'));
    if (broadcast) broadcastPause(reason);
  }

  async function runResumeCountdown(token, startAt, by = '') {
    if (!gameRunning || !paused || resumeBusy) return;
    if (token && resumeToken === token) return;
    resumeToken = token || `local-${Date.now()}`;
    resumeBusy = true;

    const wait = Math.max(0, Number(startAt || Date.now()) - Date.now());
    if (wait) await sleep(wait);
    if (!gameRunning) { resumeBusy = false; return; }

    overlay.classList.remove('hidden');
    const sequence = ['READY', '3', '2', '1', 'GO!'];
    for (const word of sequence) {
      if (!gameRunning) break;
      $u('overlayTitle').textContent = word;
      $u('overlayText').textContent = instructionText();
      if (sfxOn && typeof tone === 'function') tone(word === 'GO!' ? 880 : 540, word === 'GO!' ? .13 : .07, 'square', word === 'GO!' ? .05 : .03);
      await sleep(word === 'READY' ? 650 : word === 'GO!' ? 450 : 1000);
    }

    if (gameRunning) {
      paused = false;
      overlay.classList.add('hidden');
      lastTime = performance.now();
      $u('pauseBtn').textContent = 'Ⅱ Pause';
      if (typeof startMusic === 'function') startMusic();
    }
    resumeBusy = false;
  }

  function broadcastResume() {
    const token = `resume-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const startAt = Date.now() + 250;
    if (gameMode !== 'solo' && window.TBMultiplayer?.room) {
      TBMultiplayer.send('shared_resume', {
        token,
        startAt,
        name: $u('playerName')?.value || 'Player',
        mode: gameMode
      });
    }
    runResumeCountdown(token, startAt, $u('playerName')?.value || 'Player');
  }

  function sharedPauseToggle() {
    if (!gameRunning || resumeBusy) return;
    if (!paused) requestPause('manual', true);
    else broadcastResume();
  }

  const oldPauseBtn = $u('pauseBtn');
  if (oldPauseBtn) {
    const freshPauseBtn = oldPauseBtn.cloneNode(true);
    oldPauseBtn.replaceWith(freshPauseBtn);
    freshPauseBtn.addEventListener('click', sharedPauseToggle);
  }
  pauseGame = sharedPauseToggle;

  if (window.TBMultiplayer) {
    TBMultiplayer.onMessage(msg => {
      const p = msg.payload || {};
      if (p.mode && p.mode !== gameMode) return;
      if (msg.type === 'shared_pause') {
        if (p.token && p.token === lastPauseToken) return;
        lastPauseToken = p.token || '';
        if (gameRunning && !paused) showPaused(p.name || 'A player');
      }
      if (msg.type === 'shared_resume' && gameRunning) {
        if (!paused) showPaused(p.name || 'A player');
        runResumeCountdown(p.token, p.startAt, p.name || 'A player');
      }
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameRunning && !paused) requestPause('screen-hidden', true);
  });
  window.addEventListener('pagehide', () => {
    if (gameRunning && !paused) requestPause('screen-exit', true);
  });

  const priorStartGame = startGame;
  startGame = function() {
    resumeBusy = false;
    resumeToken = '';
    const result = priorStartGame();
    if ($u('overlayText')) $u('overlayText').textContent = instructionText();
    enforceSoloSingleBoard();
    enforcePartyCap();
    return result;
  };

  refreshLobbyUX();
  enforceSoloSingleBoard();
  enforcePartyCap();
})();