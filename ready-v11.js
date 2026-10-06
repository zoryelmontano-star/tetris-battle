// v28-ready: 2P mutual ready; Party host-controlled start with 60s auto-start and full-battlefield countdown.
(() => {
  const $ = id => document.getElementById(id);
  const actions = document.querySelector('.bottom-actions');
  const startBtn = $('startBtn');
  if (!actions || !startBtn || $('readyBtn')) return;

  const HOST_ROOMS_KEY = 'tb_party_host_rooms';
  let localReady = false;
  let roundLive = false;
  let scheduledToken = '';
  let partyDeadline = 0;
  let deadlineBroadcasted = 0;
  let readyTicker = null;

  function hostRooms(){
    try { return new Set(JSON.parse(localStorage.getItem(HOST_ROOMS_KEY) || '[]').map(x=>String(x).toUpperCase())); }
    catch { return new Set(); }
  }
  function roomCode(){ return String(window.TBMultiplayer?.room || '').toUpperCase(); }
  function partyHost(){ return gameMode === 'party' && !!roomCode() && hostRooms().has(roomCode()); }

  window.TBReadyState = {
    get localReady() { return localReady; },
    get partyDeadline(){ return partyDeadline; },
    get isPartyHost(){ return partyHost(); },
    reset() { setLocalReady(false, false); }
  };

  startBtn.classList.add('hidden');

  const readyBtn = document.createElement('button');
  readyBtn.id = 'readyBtn';
  readyBtn.className = 'primary ready-main-btn';
  readyBtn.textContent = 'READY';
  actions.insertBefore(readyBtn, startBtn);

  const hostStartBtn = document.createElement('button');
  hostStartBtn.id = 'hostStartBtn';
  hostStartBtn.className = 'primary host-start-btn hidden';
  hostStartBtn.textContent = 'START GAME';
  actions.insertBefore(hostStartBtn, startBtn);

  const panel = document.createElement('div');
  panel.id = 'readyPanel';
  panel.className = 'ready-panel';
  panel.innerHTML = `
    <div class="ready-summary"><span>ROOM READY</span><strong id="readyCount">0 / 2</strong></div>
    <div id="partyAutoStart" class="party-auto-start hidden"><span>AUTO START</span><strong id="partyAutoClock">01:00</strong></div>
    <div id="readyRoster" class="ready-roster"></div>
    <p id="readyMessage">Waiting for another player…</p>`;
  actions.parentElement.insertBefore(panel, actions);

  const fieldCountdown = document.createElement('div');
  fieldCountdown.id = 'battlefieldCountdown';
  fieldCountdown.className = 'battlefield-countdown hidden';
  fieldCountdown.innerHTML = `<div class="battlefield-countdown-inner"><p id="fieldCountSub">GET READY</p><strong id="fieldCountValue">READY?</strong></div>`;
  arenaCard.appendChild(fieldCountdown);

  const style = document.createElement('style');
  style.textContent = `
    .ready-panel{width:min(100%,760px);margin:12px auto 0;padding:12px;border-radius:15px;background:linear-gradient(180deg,#201d51,#151536);border:1px solid #514b93;text-align:center;box-shadow:inset 0 1px rgba(255,255,255,.06)}
    .ready-summary{display:flex;justify-content:center;gap:10px;align-items:center;color:#a8a2d3;font-size:9px;font-weight:1000;letter-spacing:.1em}.ready-summary strong{color:#ffe36d;font-size:14px}
    .party-auto-start{display:flex;justify-content:center;gap:9px;align-items:center;margin:7px auto 4px;color:#8ce9ff;font-size:9px;font-weight:1000;letter-spacing:.09em}.party-auto-start strong{font-size:17px;color:#fff07b;text-shadow:0 0 12px rgba(255,222,82,.22)}.party-auto-start.hidden{display:none!important}
    .ready-roster{display:flex;justify-content:center;gap:6px;flex-wrap:wrap;margin:8px 0 4px}.ready-roster:empty{display:none}.ready-person{display:inline-flex;align-items:center;gap:5px;padding:6px 8px;border-radius:999px;background:#242154;border:1px solid #484386;color:#bcb6e3;font-size:8px;font-weight:1000}.ready-person.ready{background:#1f594f;border-color:#47b995;color:#a9f4db}.ready-person.host{background:#5d4722;border-color:#d4a64b;color:#ffe29a}.ready-dot{width:7px;height:7px;border-radius:50%;background:#7c759f}.ready-person.ready .ready-dot{background:#70efbb;box-shadow:0 0 7px rgba(112,239,187,.65)}
    .ready-panel p{margin:6px 0 0;color:#a39cc9;font-size:10px}.ready-main-btn.is-ready{background:linear-gradient(180deg,#63dfa4,#38956f)!important;border-color:#9af0c5!important;color:#12392c!important}.ready-main-btn:disabled,.host-start-btn:disabled{opacity:.5;cursor:not-allowed}
    .host-start-btn{background:linear-gradient(180deg,#ffe46d,#f2a642)!important;border-color:#fff0a3!important;color:#3b2440!important}.local-live-tile.ready-now{border-color:#62e1a3!important;box-shadow:0 0 0 2px rgba(98,225,163,.22),0 15px 34px rgba(0,0,0,.25)!important}
    .battlefield-countdown{position:absolute;inset:0;z-index:9000;display:grid;place-items:center;border-radius:inherit;background:radial-gradient(circle at center,rgba(74,65,171,.72),rgba(9,10,31,.93) 60%);backdrop-filter:blur(7px);overflow:hidden}.battlefield-countdown.hidden{display:none!important}
    .battlefield-countdown::before,.battlefield-countdown::after{content:'';position:absolute;width:58%;height:58%;border-radius:50%;filter:blur(60px);opacity:.35}.battlefield-countdown::before{left:-18%;top:-12%;background:#55e7ff}.battlefield-countdown::after{right:-18%;bottom:-18%;background:#ff63b6}
    .battlefield-countdown-inner{position:relative;z-index:2;text-align:center}.battlefield-countdown-inner p{margin:0 0 6px;color:#91efff;font-size:clamp(11px,2vw,18px);font-weight:1000;letter-spacing:.2em}.battlefield-countdown-inner strong{display:block;color:#fff;font-size:clamp(72px,16vw,190px);line-height:.88;font-weight:1000;letter-spacing:-.06em;text-shadow:0 8px 0 rgba(34,26,93,.65),0 0 35px rgba(92,224,255,.28);animation:fieldCountPop .7s ease both}.battlefield-countdown.go .battlefield-countdown-inner strong{color:#fff175;text-shadow:0 8px 0 rgba(112,58,57,.55),0 0 40px rgba(255,226,83,.42)}
    @keyframes fieldCountPop{0%{opacity:0;transform:scale(.5)}45%{opacity:1;transform:scale(1.14)}100%{opacity:1;transform:scale(1)}}
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
    return remotes.slice(0,5); // local + max 5 remotes = 6 total
  }

  function everyoneReady2P() {
    const remotes = requiredPlayers();
    return gameMode==='duel' && localReady && remotes.length===1 && remotes.every(([,p]) => !!p.ready);
  }

  function leaderId() {
    const ids = [String(TBMultiplayer?.playerId || 'local'), ...requiredPlayers().map(([id]) => String(id))].sort();
    return ids[0];
  }

  function setLocalReady(value, broadcast = true) {
    if (roundLive) return;
    // Party host never has a Ready state; host controls Start instead.
    localReady = gameMode==='party' && partyHost() ? false : !!value;
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

  function formatClock(ms){
    const sec=Math.max(0,Math.ceil(ms/1000));
    return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`;
  }

  function rosterHTML(){
    const remotes=requiredPlayers();
    const parts=[];
    if(gameMode==='party'){
      parts.push(`<span class="ready-person host"><i class="ready-dot"></i>${escapeHtml($('playerName')?.value||'Host')} · HOST</span>`);
      remotes.forEach(([,p])=>parts.push(`<span class="ready-person ${p.ready?'ready':''}"><i class="ready-dot"></i>${escapeHtml(p.name||'Player')} · ${p.ready?'READY':'NOT READY'}</span>`));
    } else {
      parts.push(`<span class="ready-person ${localReady?'ready':''}"><i class="ready-dot"></i>YOU · ${localReady?'READY':'NOT READY'}</span>`);
      remotes.forEach(([,p])=>parts.push(`<span class="ready-person ${p.ready?'ready':''}"><i class="ready-dot"></i>${escapeHtml(p.name||'Rival')} · ${p.ready?'READY':'NOT READY'}</span>`));
    }
    return parts.join('');
  }
  function escapeHtml(v){const d=document.createElement('div');d.textContent=String(v||'');return d.innerHTML;}

  function ensurePartyDeadline(){
    if(gameMode!=='party' || !partyHost() || roundLive) return;
    const remotes=requiredPlayers();
    if(remotes.length<1){ partyDeadline=0; deadlineBroadcasted=0; return; }
    if(!partyDeadline){
      partyDeadline=Date.now()+60000;
      deadlineBroadcasted=partyDeadline;
      TBMultiplayer?.send?.('party_lobby_deadline',{deadline:partyDeadline,mode:'party'});
    }
  }

  function renderReady() {
    const remotes = requiredPlayers();
    const host = gameMode==='party' && partyHost();
    const total = 1 + remotes.length;
    const readyGuests = remotes.filter(([,p]) => !!p.ready).length;
    const readyTotal = gameMode==='party' ? readyGuests : (localReady ? 1 : 0) + readyGuests;
    $('readyCount').textContent = gameMode==='party' ? `${readyGuests} / ${remotes.length} GUESTS` : `${readyTotal} / ${Math.max(2,total)}`;
    $('readyRoster').innerHTML=rosterHTML();

    readyBtn.classList.toggle('hidden', host || (window.TBAIMode===true));
    hostStartBtn.classList.toggle('hidden', !host || roundLive || remotes.length<1);
    hostStartBtn.disabled = roundLive || remotes.length<1;

    const autoBox=$('partyAutoStart');
    autoBox.classList.toggle('hidden',gameMode!=='party'||remotes.length<1||roundLive);
    if(gameMode==='party' && remotes.length>=1){
      if(host) ensurePartyDeadline();
      if(partyDeadline) $('partyAutoClock').textContent=formatClock(partyDeadline-Date.now());
      else $('partyAutoClock').textContent='01:00';
    }

    const localChip = $('localReadyChip');
    if (localChip) {
      if(host && gameMode==='party'){
        localChip.textContent='HOST'; localChip.classList.add('ready');
      } else {
        localChip.textContent = localReady ? 'READY' : 'NOT READY';
        localChip.classList.toggle('ready', localReady);
      }
    }

    if (roundLive) {
      $('readyMessage').textContent = 'Round in progress';
      readyBtn.disabled = true;
      hostStartBtn.disabled = true;
      return;
    }
    readyBtn.disabled = false;

    if (remotes.length < 1) {
      $('readyMessage').textContent = gameMode === 'duel' ? 'Waiting for your rival to join…' : 'Waiting for at least one player to join…';
    } else if (gameMode==='party') {
      if(host){
        const waiting=remotes.filter(([,p])=>!p.ready).map(([,p])=>p.name||'Player');
        $('readyMessage').textContent = waiting.length ? `Waiting on: ${waiting.join(', ')}. You can start anytime.` : 'Everyone is ready. Start anytime.';
      } else {
        $('readyMessage').textContent = localReady ? 'You are ready. Waiting for the host to start…' : 'Tap READY when you are set. Host can start anytime.';
      }
    } else if (everyoneReady2P()) {
      $('readyMessage').textContent = 'Both players ready. Starting together…';
    } else {
      const waiting = remotes.filter(([,p]) => !p.ready).map(([,p]) => p.name || 'Player');
      if (!localReady) waiting.unshift('You');
      $('readyMessage').textContent = `Not ready: ${waiting.join(', ')}`;
    }
  }

  function showFullFieldReady(){
    if(gameMode!=='party') return;
    fieldCountdown.classList.remove('hidden','go');
    $('fieldCountSub').textContent='GET READY';
    $('fieldCountValue').textContent='READY?';
    const value=$('fieldCountValue'); value.style.animation='none'; void value.offsetWidth; value.style.animation='';
  }

  function syncFullFieldCountdown(){
    if(gameMode!=='party' || fieldCountdown.classList.contains('hidden')) return;
    const word=String($('overlayTitle')?.textContent||'').trim().toUpperCase();
    if(!['3','2','1','GO!'].includes(word)) return;
    $('fieldCountValue').textContent=word;
    $('fieldCountSub').textContent=word==='GO!'?'BATTLE!':'GET READY';
    fieldCountdown.classList.toggle('go',word==='GO!');
    const value=$('fieldCountValue'); value.style.animation='none'; void value.offsetWidth; value.style.animation='';
    if(word==='GO!') setTimeout(()=>fieldCountdown.classList.add('hidden'),520);
  }
  new MutationObserver(syncFullFieldCountdown).observe($('overlayTitle'),{childList:true,characterData:true,subtree:true});

  function scheduleRound(token, startAt) {
    if (!token || scheduledToken === token || roundLive) return;
    scheduledToken = token;
    const delay = Math.max(0, Number(startAt || Date.now()) - Date.now());
    $('readyMessage').textContent = 'Starting together…';
    if(gameMode==='party') showFullFieldReady();
    setTimeout(() => {
      if (roundLive) return;
      roundLive = true;
      localReady = false;
      partyDeadline=0; deadlineBroadcasted=0;
      readyBtn.classList.remove('is-ready');
      document.getElementById('localLiveTile')?.classList.remove('ready-now');
      startBtn.classList.remove('hidden');
      startBtn.click();
      startBtn.classList.add('hidden');
      renderReady();
    }, delay);
  }

  function broadcastStart(reason='manual'){
    if(roundLive || !window.TBMultiplayer?.room || requiredPlayers().length<1) return;
    const token = `${TBMultiplayer.room}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const startAt = Date.now() + 750;
    TBMultiplayer.send('round_start', { token, startAt, mode: gameMode, reason });
    scheduleRound(token, startAt);
  }

  function maybeStart() {
    renderReady();
    if(roundLive || !window.TBMultiplayer?.room) return;
    if(gameMode==='duel'){
      if(!everyoneReady2P() || String(TBMultiplayer.playerId)!==leaderId()) return;
      broadcastStart('both-ready');
      return;
    }
    if(gameMode==='party' && partyHost()){
      ensurePartyDeadline();
      if(partyDeadline && Date.now()>=partyDeadline && requiredPlayers().length>=1) broadcastStart('auto-60s');
    }
  }

  readyBtn.addEventListener('click', () => {
    if (roundLive || (gameMode==='party'&&partyHost())) return;
    setLocalReady(!localReady, true);
    setTimeout(maybeStart, 40);
  });
  hostStartBtn.addEventListener('click',()=>{
    if(gameMode==='party'&&partyHost()) broadcastStart('host-start');
  });

  if (window.TBMultiplayer) {
    TBMultiplayer.onMessage(msg => {
      const p = msg.payload || {};
      if (msg.type === 'ready_state') setTimeout(() => { renderReady(); maybeStart(); }, 25);
      if (msg.type === 'party_lobby_deadline' && gameMode==='party') {
        partyDeadline=Number(p.deadline||0); renderReady();
      }
      if (msg.type === 'round_start' && p.mode === gameMode) scheduleRound(p.token, p.startAt);
      if (msg.type === 'round_reset') {
        roundLive = false; scheduledToken = ''; partyDeadline=0; deadlineBroadcasted=0;
        setLocalReady(false, false); fieldCountdown.classList.add('hidden');
      }
    });
  }

  const originalEnd = endGame;
  endGame = function(reason) {
    const result = originalEnd(reason);
    if (gameRunning === false) {
      roundLive = false; scheduledToken = ''; partyDeadline=0; deadlineBroadcasted=0;
      setLocalReady(false, false); fieldCountdown.classList.add('hidden');
      if (window.TBMultiplayer?.room) TBMultiplayer.send('round_reset', { mode: gameMode });
    }
    return result;
  };

  document.querySelectorAll('.mode-card').forEach(btn => btn.addEventListener('click', () => {
    setTimeout(() => {
      roundLive = false; scheduledToken = ''; partyDeadline=0; deadlineBroadcasted=0;
      setLocalReady(false, true); fieldCountdown.classList.add('hidden'); renderReady();
    }, 30);
  }));

  readyTicker = setInterval(() => { renderReady(); maybeStart(); }, 250);
  renderReady();
})();
