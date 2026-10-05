// Tetris Battle v18: approved landing UX and strict mode-specific lobby controls.
(() => {
  const $ = id => document.getElementById(id);
  const lobby = $('lobby');
  if (!lobby) return;

  const validModes = new Set(['duel','party','solo']);
  if (!validModes.has(gameMode)) gameMode = 'duel';

  function safeRecent() {
    try { return JSON.parse(localStorage.getItem('tb_recent_rooms') || '[]'); }
    catch { return []; }
  }

  function renderRecentRooms() {
    const wrap = $('recentRoomPills');
    if (!wrap) return;
    const rooms = safeRecent().slice(0,3);
    wrap.innerHTML = rooms.length
      ? rooms.map(r => `<button class="recent-room-pill" type="button" data-code="${String(r.code||'').replace(/[^A-Z0-9]/gi,'')}" data-name="${String(r.name||'Party').replace(/["<>]/g,'')}">${String(r.name||'Party')} · ${String(r.code||'')}</button>`).join('')
      : '<span class="muted">Your recent Party rooms will appear here.</span>';
    wrap.querySelectorAll('.recent-room-pill').forEach(btn => btn.addEventListener('click', () => {
      setMode('party');
      if ($('roomName')) $('roomName').value = btn.dataset.name || '';
      if ($('roomCode')) $('roomCode').value = btn.dataset.code || '';
    }));
  }

  function setMode(mode) {
    if (!validModes.has(mode)) return;
    gameMode = mode;
    localStorage.setItem('tb_mode', mode);
    lobby.classList.remove('mode-duel','mode-party','mode-solo');
    lobby.classList.add(`mode-${mode}`);
    document.querySelectorAll('.mode-card').forEach(card => card.classList.toggle('active', card.dataset.mode === mode));

    const status = $('roomStatus');
    if (status && game.classList.contains('hidden')) {
      if (mode === 'duel') status.textContent = 'Enter your player name, then find an opponent.';
      if (mode === 'party') status.textContent = 'Create a named Party or join one with its code.';
      if (mode === 'solo') status.textContent = '';
    }

    const pill = $('modePill');
    if (pill) {
      if (mode === 'duel') pill.textContent = '2P BATTLE · FIRST TO 5 KO';
      if (mode === 'party') pill.textContent = 'PARTY · MAX 6P';
    }
    renderRecentRooms();
  }

  // Ensure old scripts cannot bring room-code controls back into 2P.
  const codeLabel = $('roomCode')?.closest('label');
  if (codeLabel) codeLabel.classList.add('party-only','room-code-field');
  const roomNameLabel = $('roomName')?.closest('label');
  if (roomNameLabel) roomNameLabel.classList.add('party-only','room-name-field');
  document.querySelector('.lobby .actions')?.classList.add('party-only');

  document.querySelectorAll('.mode-card').forEach(card => card.addEventListener('click', () => {
    const mode = card.dataset.mode;
    // Run after legacy mode listeners so this state always wins.
    setTimeout(() => setMode(mode), 120);
  }));

  // Keep body state correct for the landing/game transition.
  const oldOpenGame = openGame;
  openGame = function(code) {
    const out = oldOpenGame(code);
    document.body.classList.add('in-game');
    if (gameMode === 'duel') document.querySelector('.room-pill')?.classList.add('hidden');
    return out;
  };

  const oldQuitGame = quitGame;
  quitGame = function() {
    const out = oldQuitGame();
    setTimeout(() => {
      document.body.classList.remove('in-game');
      setMode(gameMode);
    }, 0);
    return out;
  };

  // Make the approved labels deterministic even if legacy scripts ran first.
  const duelCard = document.querySelector('.mode-card[data-mode="duel"]');
  const partyCard = document.querySelector('.mode-card[data-mode="party"]');
  const soloCard = document.querySelector('.mode-card[data-mode="solo"]');
  if (duelCard) {
    duelCard.querySelector('strong').textContent = '2P Battle';
    duelCard.querySelector('small').textContent = 'Exactly 2 players · first to 5 knockouts wins';
  }
  if (partyCard) {
    partyCard.querySelector('strong').textContent = 'Party Session';
    partyCard.querySelector('small').textContent = '2–6 players · 2-minute score race · no attacks';
  }
  if (soloCard) {
    soloCard.querySelector('strong').textContent = 'Solo Session';
    soloCard.querySelector('small').textContent = 'Sprint 40L or Marathon';
  }

  setMode(gameMode || 'duel');
  renderRecentRooms();
  window.TBLobby = { setMode, renderRecentRooms };
})();
