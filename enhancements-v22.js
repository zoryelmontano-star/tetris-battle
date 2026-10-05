// v22: solo no-cap presentation, in-arena matchmaking, optional AI duel, Party focus board, and share invites.
(() => {
  const $ = id => document.getElementById(id);
  let searchToken = 0;
  window.TBAIMode = false;

  function nameNow(){ return ($('playerName')?.value || '').trim().slice(0,16); }
  function setStatus(text){ if ($('roomStatus')) $('roomStatus').textContent = text; }
  function removeRetry(){ $('retryMatchBtn')?.remove(); }

  function enterArenaPreview(name, title, text){
    gameMode = 'duel';
    localStorage.setItem('tb_mode','duel');
    if ($('playerLabel')) $('playerLabel').textContent = name || 'Player';
    if ($('modePill')) $('modePill').textContent = title;
    if ($('roomCodeDisplay')) $('roomCodeDisplay').textContent = '—';
    document.querySelector('.room-pill')?.classList.add('hidden');
    lobby.classList.add('hidden');
    game.classList.remove('hidden');
    document.body.classList.add('in-game');
    if ($('playerState')) $('playerState').textContent = text;
    if ($('overlayTitle')) $('overlayTitle').textContent = title;
    if ($('overlayText')) $('overlayText').textContent = text;
    overlay.classList.remove('hidden');
    try { resetQueue(); updateHud(); draw(); renderHistory(); } catch {}
    TBLiveGrid?.render?.();
  }

  function showRetry(message){
    if ($('overlayText')) $('overlayText').textContent = message;
    if ($('playerState')) $('playerState').textContent = 'No rival found';
    removeRetry();
    const b = document.createElement('button');
    b.id = 'retryMatchBtn';
    b.className = 'match-retry-btn';
    b.type = 'button';
    b.textContent = 'Search Again';
    overlay.appendChild(b);
    b.addEventListener('click', findOnlineOpponent);
  }

  async function findOnlineOpponent(){
    const name = nameNow();
    if (!name) {
      lobby.classList.remove('hidden'); game.classList.add('hidden'); document.body.classList.remove('in-game');
      TBModeFlow?.showSetup?.('duel', false); $('playerName')?.focus(); return;
    }
    const token = ++searchToken;
    window.TBAIMode = false;
    removeRetry();
    enterArenaPreview(name, 'FINDING RIVAL', 'Searching for an online opponent. You can stay on the Tetris screen while matchmaking runs.');
    const ready = $('readyBtn');
    if (ready) ready.disabled = true;
    try {
      const match = await TBMultiplayer.findDuel(name);
      if (token !== searchToken) return;
      if (!match?.ok) {
        showRetry(match?.reason === 'timeout' ? 'No opponent found yet. Search again when you are ready.' : 'Matchmaking could not start. Try again.');
        return;
      }
      if ($('playerState')) $('playerState').textContent = `Rival found: ${match.opponentName || 'Player'}`;
      const connected = await TBMultiplayer.connect(match.room, name, {mode:'duel'});
      if (token !== searchToken) return;
      if (!connected) { showRetry('A rival was found, but the battle room could not connect. Try again.'); return; }
      // Use the normal arena initializer once a real room exists so live-board sync starts.
      openGame(match.room);
      document.querySelector('.room-pill')?.classList.add('hidden');
      if ($('playerState')) $('playerState').textContent = `Matched with ${match.opponentName || 'Rival'}`;
      if ($('overlayTitle')) $('overlayTitle').textContent = 'RIVAL FOUND';
      if ($('overlayText')) $('overlayText').textContent = 'Both players press READY. First to 5 KOs wins.';
      if (ready) ready.disabled = false;
      TBLiveGrid?.sendState?.();
      TBLiveGrid?.render?.();
    } catch (err) {
      if (token !== searchToken) return;
      const msg = String(err?.message || err || '');
      showRetry(/permission|PERMISSION_DENIED/i.test(msg)
        ? 'Firebase Database Rules are blocking matchmaking.'
        : 'Could not connect to matchmaking. Try again.');
    }
  }

  function setupDuelButtons(){
    const oldFind = $('find2PBtn');
    const panel = $('duelQuickPanel');
    if (!oldFind || !panel || $('battleAIBtn')) return;
    const freshFind = oldFind.cloneNode(true);
    oldFind.replaceWith(freshFind);
    freshFind.textContent = 'Find Online Opponent';
    const row = document.createElement('div');
    row.className = 'duel-action-row';
    freshFind.before(row);
    row.appendChild(freshFind);
    const ai = document.createElement('button');
    ai.id = 'battleAIBtn';
    ai.type = 'button';
    ai.textContent = 'Battle AI';
    row.appendChild(ai);
    freshFind.addEventListener('click', findOnlineOpponent);
    ai.addEventListener('click', async () => {
      const name = nameNow();
      if (!name) { $('playerName')?.focus(); return; }
      searchToken++;
      window.TBAIMode = true;
      try { await TBMultiplayer?.disconnect?.(); } catch {}
      enterArenaPreview(name, '2P BATTLE · VS AI', 'AI Rival ready. First to 5 KOs wins.');
      if ($('readyBtn')) $('readyBtn').classList.add('hidden');
      if ($('readyPanel')) $('readyPanel').classList.add('hidden');
      if ($('overlayTitle')) $('overlayTitle').textContent = 'VS AI';
      if ($('overlayText')) $('overlayText').textContent = 'First to 5 KOs wins. Get ready!';
      setTimeout(() => $('startBtn')?.click(), 180);
    });
  }

  function applySoloPresentation(){
    const type = localStorage.getItem('tb_solo_type') || 'sprint';
    const timerBox = $('timer')?.closest('.hud-box');
    if (timerBox?.querySelector('span')) timerBox.querySelector('span').textContent = 'ELAPSED';
    if ($('timer') && !gameRunning) $('timer').textContent = '00:00';
    if ($('modePill')) $('modePill').textContent = type === 'sprint' ? 'SOLO · CLEAR 40 LINES' : 'SOLO · MARATHON 15 LEVELS';
    if ($('overlayText')) $('overlayText').textContent = type === 'sprint'
      ? 'No time limit. Clear 40 lines as fast as you can.'
      : 'No two-minute cap. Complete all 15 Marathon levels.';
  }

  function restoreBattleHeaders(){
    const timerBox = $('timer')?.closest('.hud-box');
    if (timerBox?.querySelector('span')) timerBox.querySelector('span').textContent = 'TIME';
  }

  function enforceSoloCard(){
    const small = document.querySelector('.mode-card[data-mode="solo"] small');
    if (small) small.textContent = '';
  }

  function setupSoloHooks(){
    enforceSoloCard();
    document.querySelectorAll('.solo-choice').forEach(btn => btn.addEventListener('click', () => setTimeout(applySoloPresentation, 0)));
    $('startSoloBtn')?.addEventListener('click', () => setTimeout(applySoloPresentation, 30));
    document.querySelector('.mode-card[data-mode="solo"]')?.addEventListener('click', () => setTimeout(() => { enforceSoloCard(); applySoloPresentation(); }, 170));
    document.querySelectorAll('.mode-card[data-mode="duel"],.mode-card[data-mode="party"]').forEach(btn => btn.addEventListener('click', () => setTimeout(restoreBattleHeaders, 160)));

    const priorStart = startGame;
    startGame = function(){
      const result = priorStart();
      if (gameMode === 'solo') applySoloPresentation();
      else restoreBattleHeaders();
      return result;
    };
  }

  function currentPartyCode(){
    return String(TBMultiplayer?.room || $('roomCodeDisplay')?.textContent || $('roomCode')?.value || '').trim().toUpperCase();
  }

  async function shareParty(){
    const code = currentPartyCode();
    if (!code || code === '—' || code === '------') return;
    const url = new URL(location.href);
    url.hash = '';
    url.search = '';
    url.searchParams.set('party', code);
    const session = ($('roomName')?.value || 'Tetris Battle Party').trim();
    const text = `Join my ${session} on Tetris Battle. Room code: ${code}`;
    try {
      if (navigator.share) {
        await navigator.share({title:'Tetris Battle Party', text, url:url.href});
      } else {
        await navigator.clipboard.writeText(`${text}\n${url.href}`);
        if (typeof toast === 'function') toast('INVITE COPIED', 'Send the link to your friends');
      }
    } catch (err) {
      if (err?.name !== 'AbortError' && typeof toast === 'function') toast('SHARE FAILED', 'Copy the room code and try again');
    }
  }

  function setupShare(){
    const actions = document.querySelector('.bottom-actions');
    if (!actions || $('sharePartyBtn')) return;
    const b = document.createElement('button');
    b.id = 'sharePartyBtn';
    b.type = 'button';
    b.className = 'hidden';
    b.textContent = '↗ Share Invite';
    actions.insertBefore(b, $('quitBtn'));
    b.addEventListener('click', shareParty);
  }

  function syncShare(){ $('sharePartyBtn')?.classList.toggle('hidden', gameMode !== 'party' || game.classList.contains('hidden')); }

  const priorOpenGame = openGame;
  openGame = function(code){
    const result = priorOpenGame(code);
    if (window.TBAIMode) {
      $('readyBtn')?.classList.add('hidden');
      $('readyPanel')?.classList.add('hidden');
    } else {
      $('readyBtn')?.classList.remove('hidden');
      $('readyPanel')?.classList.remove('hidden');
    }
    syncShare();
    if (gameMode === 'solo') setTimeout(applySoloPresentation, 0);
    return result;
  };

  const priorQuit = quitGame;
  quitGame = function(){
    searchToken++;
    window.TBAIMode = false;
    const result = priorQuit();
    $('readyBtn')?.classList.remove('hidden');
    $('readyPanel')?.classList.remove('hidden');
    syncShare();
    restoreBattleHeaders();
    return result;
  };

  function openPartyInvite(){
    const raw = new URLSearchParams(location.search).get('party');
    const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,12);
    if (!code) return;
    setTimeout(() => {
      TBModeFlow?.showSetup?.('party', false);
      if ($('roomCode')) $('roomCode').value = code;
      setStatus(`Invite received · Room ${code}. Enter your player name, then tap Join Party.`);
    }, 250);
  }

  setupDuelButtons();
  setupSoloHooks();
  setupShare();
  openPartyInvite();
  syncShare();
})();
