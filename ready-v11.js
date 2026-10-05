// Tetris Battle v11: all players must be ready before a synchronized round starts.
(() => {
  const $ = id => document.getElementById(id);
  const actions = document.querySelector('.bottom-actions');
  const startBtn = $('startBtn');
  if (!actions || !startBtn || $('readyBtn')) return;

  let localReady = false;
  let roundLive = false;
  let scheduledToken = '';
  let readyTicker = null;

  window.TBReadyState = {
    get localReady() { return localReady; },
    reset() { setLocalReady(false, false); }
  };

  startBtn.classList.add('hidden');

  const readyBtn = document.createElement('button');
  readyBtn.id = 'readyBtn';
  readyBtn.className = 'primary ready-main-btn';
  readyBtn.textContent = 'READY';
  actions.insertBefore(readyBtn, startBtn);

  const panel = document.createElement('div');
  panel.id = 'readyPanel';
  panel.className = 'ready-panel';
  panel.innerHTML = `<div class="ready-summary"><span>ROOM READY</span><strong id="readyCount">1 / 2</strong></div><p id="readyMessage">Waiting for another player…</p>`;
  actions.parentElement.insertBefore(panel, actions);

  const style = document.createElement('style');
  style.textContent = `
    .ready-panel{width:min(100%,620px);margin:12px auto 0;padding:10px 12px;border-radius:14px;background:#171419;border:1px solid #3e353d;text-align:center}
    .ready-summary{display:flex;justify-content:center;gap:10px;align-items:center;color:#8f838b;font-size:9px;font-weight:900;letter-spacing:.1em}.ready-summary strong{color:#e4bd77;font-size:13px}
    .ready-panel p{margin:4px 0 0;color:#9d9098;font-size:10px}.ready-main-btn.is-ready{background:linear-gradient(180deg,#7ea96e,#4d7445);border-color:#8daf7d}.ready-main-btn:disabled{opacity:.55;cursor:not-allowed}
    .local-live-tile.ready-now{border-color:#739c68!important;box-shadow:0 0 0 1px rgba(126,169,110,.28),0 15px 34px rgba(0,0,0,.25)!important}
  `;
  document.head.appendChild(style);

  function activeRemotes() {
    if (!window.TBLiveGrid?.remotes) return [];
    const now = Date.now();
    return [...TBLiveGrid.remotes.entries()]
      .filter(([,p]) => p.mode === gameMode && now - Number(p.seen || 0) < 7000)
      .sort((a,b) => String(a[0]).localeCompare(String(b[0])));
  }

  function requiredPlayers() {
    const remotes = activeRemotes();
    if (gameMode === 'duel') return remotes.slice(0,1);
    return remotes.slice(0,7);
  }

  function everyoneReady() {
    const remotes = requiredPlayers();
    if (!localReady || remotes.length < 1) return false;
    return remotes.every(([,p]) => !!p.ready);
  }

  function leaderId() {
    const ids = [String(TBMultiplayer?.playerId || 'local'), ...requiredPlayers().map(([id]) => String(id))].sort();
    return ids[0];
  }

  function setLocalReady(value, broadcast = true) {
    if (roundLive) return;
    localReady = !!value;
    readyBtn.textContent = localReady ? 'READY ✓' : 'READY';
    readyBtn.classList.toggle('is-ready', localReady);
    document.getElementById('localLiveTile')?.classList.toggle('ready-now', localReady);
    if (broadcast && window.TBMultiplayer?.room) {
      TBMultiplayer.send('ready_state', {
        ready: localReady,
        name: $('playerName')?.value || 'Player',
        mode: gameMode
      });
      TBLiveGrid?.sendState?.();
    }
    renderReady();
  }

  function renderReady() {
    const remotes = requiredPlayers();
    const total = 1 + remotes.length;
    const readyTotal = (localReady ? 1 : 0) + remotes.filter(([,p]) => p.ready).length;
    $('readyCount').textContent = `${readyTotal} / ${Math.max(2,total)}`;

    const localChip = $('localReadyChip');
    if (localChip) {
      localChip.textContent = localReady ? 'READY' : 'NOT READY';
      localChip.classList.toggle('ready', localReady);
    }

    if (roundLive) {
      $('readyMessage').textContent = 'Round in progress';
      readyBtn.disabled = true;
      return;
    }
    readyBtn.disabled = false;

    if (remotes.length < 1) {
      $('readyMessage').textContent = gameMode === 'duel' ? 'Waiting for your rival to join…' : 'Waiting for at least one more player…';
    } else if (everyoneReady()) {
      $('readyMessage').textContent = 'Everyone is ready. Starting together…';
    } else {
      const waiting = remotes.filter(([,p]) => !p.ready).map(([,p]) => p.name || 'Player');
      if (!localReady) waiting.unshift('You');
      $('readyMessage').textContent = `Not ready: ${waiting.join(', ')}`;
    }
  }

  function scheduleRound(token, startAt) {
    if (!token || scheduledToken === token || roundLive) return;
    scheduledToken = token;
    const delay = Math.max(0, Number(startAt || Date.now()) - Date.now());
    $('readyMessage').textContent = 'Everyone ready. Get set…';
    setTimeout(() => {
      if (roundLive) return;
      roundLive = true;
      localReady = false;
      readyBtn.classList.remove('is-ready');
      document.getElementById('localLiveTile')?.classList.remove('ready-now');
      // Use the existing arcade 3-2-1-GO flow, but trigger it on every client together.
      startBtn.classList.remove('hidden');
      startBtn.click();
      startBtn.classList.add('hidden');
      renderReady();
    }, delay);
  }

  function maybeStart() {
    renderReady();
    if (!everyoneReady() || roundLive || !window.TBMultiplayer?.room) return;
    if (String(TBMultiplayer.playerId) !== leaderId()) return;
    const token = `${TBMultiplayer.room}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const startAt = Date.now() + 650;
    TBMultiplayer.send('round_start', { token, startAt, mode: gameMode });
    scheduleRound(token, startAt);
  }

  readyBtn.addEventListener('click', () => {
    if (roundLive) return;
    setLocalReady(!localReady, true);
    setTimeout(maybeStart, 40);
  });

  if (window.TBMultiplayer) {
    TBMultiplayer.onMessage(msg => {
      const p = msg.payload || {};
      if (msg.type === 'ready_state') {
        setTimeout(() => { renderReady(); maybeStart(); }, 25);
      }
      if (msg.type === 'round_start' && p.mode === gameMode) {
        scheduleRound(p.token, p.startAt);
      }
      if (msg.type === 'round_reset') {
        roundLive = false;
        scheduledToken = '';
        setLocalReady(false, false);
      }
    });
  }

  const originalEnd = endGame;
  endGame = function(reason) {
    const result = originalEnd(reason);
    if (gameRunning === false) {
      roundLive = false;
      scheduledToken = '';
      setLocalReady(false, false);
      if (window.TBMultiplayer?.room) TBMultiplayer.send('round_reset', { mode: gameMode });
    }
    return result;
  };

  document.querySelectorAll('.mode-card').forEach(btn => btn.addEventListener('click', () => {
    setTimeout(() => {
      roundLive = false;
      scheduledToken = '';
      setLocalReady(false, true);
      renderReady();
    }, 30);
  }));

  readyTicker = setInterval(() => { renderReady(); maybeStart(); }, 300);
  renderReady();
})();
