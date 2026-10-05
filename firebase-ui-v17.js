// Tetris Battle v17: real Firebase-backed landing actions for 2P and Party.
(() => {
  const $ = id => document.getElementById(id);
  const status = message => { if ($('roomStatus')) $('roomStatus').textContent = message; };
  const playerName = () => ($('playerName')?.value || '').trim().slice(0,16);

  function firebaseError(err) {
    const msg = String(err?.message || err || 'Unknown Firebase error');
    console.error('Tetris Battle Firebase action failed', err);
    if (/permission|PERMISSION_DENIED/i.test(msg)) return 'Firebase is connected, but Database Rules still need to be published.';
    if (/auth|anonymous/i.test(msg)) return 'Firebase Authentication is not ready. Make sure Anonymous sign-in is enabled.';
    return `Could not connect: ${msg}`;
  }

  async function findOpponent() {
    const name = playerName();
    if (!name) { $('playerName')?.focus(); return; }
    const btn = $('find2PBtn');
    if (!btn || btn.dataset.busy === '1') return;
    btn.dataset.busy = '1'; btn.disabled = true; btn.textContent = 'Finding opponent…';
    try {
      gameMode = 'duel'; localStorage.setItem('tb_mode','duel');
      status('Searching for another 2P player…');
      const match = await window.TBMultiplayer?.findDuel?.(name);
      if (!match?.ok) {
        status(match?.reason === 'timeout' ? 'No opponent found yet. Tap Find Opponent to search again.' : 'Could not start matchmaking.');
        return;
      }
      btn.textContent = 'Opponent found!';
      const connected = await TBMultiplayer.connect(match.room, name, {mode:'duel'});
      if (!connected) { status('Match found, but the room connection failed. Try again.'); return; }
      openGame(match.room);
      document.querySelector('.room-pill')?.classList.add('hidden');
      if ($('playerState')) $('playerState').textContent = `Matched with ${match.opponentName || 'Rival'}`;
      if ($('overlayText')) $('overlayText').textContent = 'Knock out your opponent! First to 5 KOs wins.';
    } catch (err) {
      status(firebaseError(err));
    } finally {
      btn.dataset.busy = '0'; btn.disabled = false; btn.textContent = 'Find Opponent';
    }
  }

  async function createParty() {
    const name = playerName();
    if (!name) { $('playerName')?.focus(); return; }
    const btn = $('createRoomBtn');
    if (!btn || btn.dataset.busy === '1') return;
    const sessionName = ($('roomName')?.value || '').trim().slice(0,30) || 'Party Session';
    const code = ($('roomCode')?.value || '').trim();
    btn.dataset.busy = '1'; btn.disabled = true; btn.textContent = 'Creating…';
    try {
      gameMode = 'party'; localStorage.setItem('tb_mode','party');
      const result = await TBMultiplayer.createParty(code, name, sessionName);
      if (!result?.ok) {
        status(result?.reason === 'code-taken' ? 'That room code is already in use. Pick another one.' : 'Could not create the Party room.');
        return;
      }
      if ($('roomCode')) $('roomCode').value = result.room;
      openGame(result.room);
      window.TBRoom?.showRoomTitle?.(result.roomName || sessionName, result.room);
      status(`${result.roomName || sessionName} · Code ${result.room}`);
    } catch (err) {
      status(firebaseError(err));
    } finally {
      btn.dataset.busy = '0'; btn.disabled = false; btn.textContent = 'Create Party';
    }
  }

  async function joinParty() {
    const name = playerName();
    if (!name) { $('playerName')?.focus(); return; }
    const code = ($('roomCode')?.value || '').trim().toUpperCase();
    if (code.length < 4) { status('Enter the Party room code first.'); $('roomCode')?.focus(); return; }
    const btn = $('joinRoomBtn');
    if (!btn || btn.dataset.busy === '1') return;
    btn.dataset.busy = '1'; btn.disabled = true; btn.textContent = 'Joining…';
    try {
      gameMode = 'party'; localStorage.setItem('tb_mode','party');
      const result = await TBMultiplayer.joinParty(code, name);
      if (!result?.ok) {
        status(result?.reason === 'not-found' ? 'Party room not found. Check the code.' : 'Could not join the Party room.');
        return;
      }
      openGame(result.room);
      window.TBRoom?.showRoomTitle?.(result.roomName || `Room ${result.room}`, result.room);
    } catch (err) {
      status(firebaseError(err));
    } finally {
      btn.dataset.busy = '0'; btn.disabled = false; btn.textContent = 'Join Party';
    }
  }

  // landing-v15 and room-v12 already attached local handlers. Clone the buttons once here
  // so only the Firebase-backed handlers remain active.
  const oldFind = $('find2PBtn');
  if (oldFind) { const fresh = oldFind.cloneNode(true); oldFind.replaceWith(fresh); fresh.addEventListener('click', findOpponent); }
  const oldCreate = $('createRoomBtn');
  if (oldCreate) { const fresh = oldCreate.cloneNode(true); oldCreate.replaceWith(fresh); fresh.textContent = 'Create Party'; fresh.addEventListener('click', createParty); }
  const oldJoin = $('joinRoomBtn');
  if (oldJoin) { const fresh = oldJoin.cloneNode(true); oldJoin.replaceWith(fresh); fresh.textContent = 'Join Party'; fresh.addEventListener('click', joinParty); }

  window.TBFirebaseUI = { findOpponent, createParty, joinParty };
})();
