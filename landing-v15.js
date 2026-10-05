// Tetris Battle v15: approved Tetris-style landing page + name-only 2P matchmaking flow.
(() => {
  const $ = id => document.getElementById(id);
  const lobby = $('lobby');
  const modeGrid = lobby?.querySelector('.mode-grid');
  const lobbyGrid = lobby?.querySelector('.lobby-grid');
  if (!lobby || !modeGrid || !lobbyGrid || $('landingHero')) return;

  // Hero: unmistakably block-puzzle / arcade without copying copyrighted art assets.
  const hero = document.createElement('div');
  hero.id = 'landingHero';
  hero.className = 'landing-hero';
  hero.innerHTML = `
    <div class="falling-blocks" aria-hidden="true">
      <i class="tet t1"></i><i class="tet t2"></i><i class="tet t3"></i><i class="tet t4"></i><i class="tet t5"></i>
    </div>
    <div class="block-logo" aria-label="Tetris Battle">
      <span class="logo-row logo-top"><b>T</b><b>E</b><b>T</b><b>R</b><b>I</b><b>S</b></span>
      <span class="logo-row logo-bottom"><b>B</b><b>A</b><b>T</b><b>T</b><b>L</b><b>E</b></span>
    </div>
    <p>Battle, Party, or Play Solo</p>
  `;
  lobby.prepend(hero);
  lobby.querySelector('.lobby-head')?.classList.add('landing-old-head');

  // Re-label the three large mode buttons.
  const duelCard = modeGrid.querySelector('[data-mode="duel"]');
  const partyCard = modeGrid.querySelector('[data-mode="party"]');
  const soloCard = modeGrid.querySelector('[data-mode="solo"]');
  if (duelCard) {
    duelCard.innerHTML = `<span class="landing-mode-icon two-p">▦▦</span><span class="landing-mode-copy"><strong>2P Battle</strong><small>First to 5 knockouts wins</small></span><span class="landing-chevron">›</span>`;
  }
  if (partyCard) {
    partyCard.innerHTML = `<span class="landing-mode-icon party-p">✦</span><span class="landing-mode-copy"><strong>Party Session</strong><small>2–6 players · 2-minute score race</small></span><span class="landing-chevron">›</span>`;
  }
  if (soloCard) {
    soloCard.innerHTML = `<span class="landing-mode-icon solo-p">◆</span><span class="landing-mode-copy"><strong>Solo Session</strong><small>Sprint 40L or Marathon</small></span><span class="landing-chevron">›</span>`;
  }

  // Name-only 2P flow. No code is shown or requested.
  const duelPanel = document.createElement('div');
  duelPanel.id = 'duelQuickPanel';
  duelPanel.className = 'landing-action-panel';
  duelPanel.innerHTML = `
    <div class="landing-panel-title"><span>⚔</span><div><strong>Find a 2P Opponent</strong><small>Set your player name, then enter matchmaking.</small></div></div>
    <button id="find2PBtn" class="landing-enter-btn duel-enter">Find Opponent</button>
    <p class="landing-panel-note">Exactly 2 players · both players must be Ready before the round starts.</p>
  `;
  lobbyGrid.insertAdjacentElement('afterend', duelPanel);

  // Recent rooms, matching the approved concept. Party rooms only.
  const recentPanel = document.createElement('div');
  recentPanel.id = 'recentRoomsPanel';
  recentPanel.className = 'recent-rooms-panel';
  recentPanel.innerHTML = `<div class="recent-head"><strong>Recent Party Rooms</strong><span>saved on this device</span></div><div id="recentRoomPills" class="recent-room-pills"></div>`;
  lobby.appendChild(recentPanel);

  const style = document.createElement('style');
  style.textContent = `
    body:not(.in-game){background:
      radial-gradient(circle at 50% 8%,rgba(201,172,99,.18),transparent 24%),
      radial-gradient(circle at 15% 28%,rgba(199,134,144,.16),transparent 22%),
      radial-gradient(circle at 86% 34%,rgba(142,125,166,.18),transparent 24%),
      linear-gradient(180deg,#211a23,#151217 64%,#0f0d10)}
    #lobby.landing-v15{position:relative;overflow:hidden;max-width:780px;margin:0 auto;padding:24px 22px 26px;background:linear-gradient(180deg,rgba(35,28,37,.97),rgba(24,20,26,.98));border-color:rgba(255,255,255,.1)}
    #lobby.landing-v15:before,#lobby.landing-v15:after{content:'';position:absolute;pointer-events:none;opacity:.18;background-image:linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px);background-size:28px 28px}
    #lobby.landing-v15:before{inset:0 65% 0 0}#lobby.landing-v15:after{inset:0 0 0 65%}
    .landing-old-head{display:none!important}.landing-hero{position:relative;z-index:1;text-align:center;padding:8px 0 22px}.landing-hero p{margin:13px 0 0;color:#e3d2bd;font-weight:800;letter-spacing:.04em}
    .block-logo{display:inline-grid;gap:5px;filter:drop-shadow(0 12px 20px rgba(0,0,0,.38))}.logo-row{display:flex;justify-content:center;gap:4px}.logo-row b{width:40px;height:40px;display:grid;place-items:center;border-radius:8px;font-size:24px;font-weight:1000;color:#1a1519;border:1px solid rgba(255,255,255,.34);box-shadow:inset 0 4px 0 rgba(255,255,255,.22),inset 0 -5px 0 rgba(0,0,0,.18),0 5px 0 rgba(0,0,0,.28)}
    .logo-row b:nth-child(1){background:#d88975}.logo-row b:nth-child(2){background:#d5b85d}.logo-row b:nth-child(3){background:#70b39a}.logo-row b:nth-child(4){background:#a184b6}.logo-row b:nth-child(5){background:#c47e9f}.logo-row b:nth-child(6){background:#7eaa71}.logo-bottom b:nth-child(odd){background:#8e7da6}.logo-bottom b:nth-child(even){background:#c78690}.logo-bottom b:nth-child(3){background:#d9b957}.logo-bottom b:nth-child(5){background:#79a98c}
    .falling-blocks i{position:absolute;display:block;opacity:.55;filter:drop-shadow(0 8px 7px rgba(0,0,0,.25))}.tet:before,.tet:after{content:'';position:absolute;width:13px;height:13px;border-radius:3px;box-shadow:14px 0 currentColor,28px 0 currentColor}.tet{width:13px;height:13px;background:currentColor;border-radius:3px}.tet:before{background:currentColor;left:0;top:14px}.tet:after{background:currentColor;left:14px;top:14px}.t1{color:#c78690;left:5%;top:15px;transform:rotate(18deg)}.t2{color:#d9b957;right:8%;top:32px;transform:rotate(-20deg)}.t3{color:#79a98c;left:13%;top:112px;transform:rotate(45deg)}.t4{color:#9a82bd;right:13%;top:128px;transform:rotate(-8deg)}.t5{color:#de8b62;right:3%;top:176px;transform:rotate(22deg)}
    #lobby.landing-v15 .mode-grid{position:relative;z-index:1;display:grid!important;grid-template-columns:1fr!important;gap:13px;max-width:620px;margin:0 auto 17px}
    #lobby.landing-v15 .mode-card{min-height:92px;display:grid!important;grid-template-columns:58px minmax(0,1fr) 30px;align-items:center;gap:13px;padding:15px 18px!important;border-radius:22px!important;text-align:left!important;transform:none!important;transition:transform .16s ease,filter .16s ease,box-shadow .16s ease}
    #lobby.landing-v15 .mode-card:hover{transform:translateY(-2px)!important;filter:brightness(1.05)}#lobby.landing-v15 .mode-card[data-mode=duel]{background:linear-gradient(180deg,#bd737e,#8b4e59)!important;border-color:#c98c91!important}#lobby.landing-v15 .mode-card[data-mode=party]{background:linear-gradient(180deg,#8975a3,#625278)!important;border-color:#a48bb6!important}#lobby.landing-v15 .mode-card[data-mode=solo]{background:linear-gradient(180deg,#79a277,#52734f)!important;border-color:#8fb28b!important}
    #lobby.landing-v15 .mode-card.active{box-shadow:0 0 0 3px rgba(241,211,151,.24),inset 0 2px 0 rgba(255,255,255,.18),0 13px 25px rgba(0,0,0,.28)!important}.landing-mode-icon{width:52px;height:52px;display:grid;place-items:center;border-radius:16px;background:rgba(20,15,21,.2);border:1px solid rgba(255,255,255,.16);font-size:23px;font-weight:1000}.landing-mode-copy strong{display:block;font-size:21px}.landing-mode-copy small{display:block;margin-top:4px;color:rgba(255,255,255,.75)!important;font-size:11px}.landing-chevron{font-size:36px;color:rgba(255,255,255,.74)}
    #lobby.landing-v15 .lobby-grid{position:relative;z-index:1;max-width:620px;margin:0 auto 12px}.landing-action-panel,#lobby.landing-v15 .actions,#lobby.landing-v15 .status,#lobby.landing-v15 .solo-options{position:relative;z-index:1;max-width:620px;margin-left:auto!important;margin-right:auto!important}.landing-action-panel{padding:16px;border:1px solid #493d48;border-radius:20px;background:linear-gradient(180deg,rgba(38,30,40,.98),rgba(25,21,27,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}.landing-panel-title{display:flex;gap:11px;align-items:center;margin-bottom:12px}.landing-panel-title>span{width:39px;height:39px;display:grid;place-items:center;border-radius:12px;background:#2d252f;color:#dcbf82}.landing-panel-title strong,.landing-panel-title small{display:block}.landing-panel-title small{color:#9f929a;font-size:10px;margin-top:2px}.landing-enter-btn{width:100%;min-height:58px;font-size:18px;background:linear-gradient(180deg,#e0ba69,#b5843d)!important;border-color:#e6c886!important;color:#261b12!important}.duel-enter{background:linear-gradient(180deg,#d48691,#a25563)!important;border-color:#dfa0a8!important;color:#fff!important}.landing-panel-note{margin:10px 0 0;text-align:center;color:#8f838b;font-size:10px}
    #lobby.landing-v15 .actions button{min-height:54px;flex:1;font-size:16px}#lobby.landing-v15 .fineprint{position:relative;z-index:1;max-width:620px;margin:12px auto 0;text-align:center}.recent-rooms-panel{position:relative;z-index:1;max-width:620px;margin:15px auto 0;padding:14px;border-radius:18px;background:#171419;border:1px solid #3e353d}.recent-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.recent-head span{font-size:9px;color:#83777f}.recent-room-pills{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.recent-room-pill{padding:8px 10px;border-radius:11px;background:#241e25;border:1px solid #413640;color:#d9ccca;font-size:10px;font-weight:800}
    #lobby.landing-v15.mode-duel .room-name-field,#lobby.landing-v15.mode-duel .room-code-field,#lobby.landing-v15.mode-duel .room-code-help,#lobby.landing-v15.mode-duel>.actions,#lobby.landing-v15.mode-duel>#roomStatus,#lobby.landing-v15.mode-duel #recentRoomsPanel,#lobby.landing-v15.mode-duel #soloOptions{display:none!important}
    #lobby.landing-v15.mode-party #duelQuickPanel,#lobby.landing-v15.mode-party #soloOptions{display:none!important}
    #lobby.landing-v15.mode-solo #duelQuickPanel,#lobby.landing-v15.mode-solo .room-name-field,#lobby.landing-v15.mode-solo .room-code-field,#lobby.landing-v15.mode-solo .room-code-help,#lobby.landing-v15.mode-solo>.actions,#lobby.landing-v15.mode-solo>#roomStatus,#lobby.landing-v15.mode-solo #recentRoomsPanel{display:none!important}
    #lobby.landing-v15.mode-party #duelQuickPanel{display:none!important}#lobby.landing-v15.mode-duel #duelQuickPanel{display:block!important}
    @media(max-width:650px){#lobby.landing-v15{padding:18px 12px 22px;border-radius:18px}.logo-row b{width:32px;height:32px;font-size:19px}.landing-hero{padding-top:2px}.landing-mode-copy strong{font-size:19px}#lobby.landing-v15 .mode-card{min-height:84px;grid-template-columns:50px minmax(0,1fr) 24px;padding:12px 14px!important}.landing-mode-icon{width:46px;height:46px}.falling-blocks{opacity:.65}}
  `;
  document.head.appendChild(style);

  function renderRecentRooms() {
    const wrap = $('recentRoomPills');
    if (!wrap) return;
    const rooms = JSON.parse(localStorage.getItem('tb_recent_rooms') || '[]').slice(0,3);
    wrap.innerHTML = rooms.length
      ? rooms.map(r => `<button class="recent-room-pill" data-code="${String(r.code||'').replace(/[^A-Z0-9]/gi,'')}" data-name="${String(r.name||'Party').replace(/["<>]/g,'')}">${String(r.name||'Party')} · ${String(r.code||'')}</button>`).join('')
      : `<span class="landing-panel-note">Your Party rooms will appear here after you create or join one.</span>`;
    wrap.querySelectorAll('.recent-room-pill').forEach(btn => btn.addEventListener('click', () => {
      gameMode = 'party'; localStorage.setItem('tb_mode','party');
      if ($('roomName')) $('roomName').value = btn.dataset.name || '';
      if ($('roomCode')) $('roomCode').value = btn.dataset.code || '';
      refreshLandingMode();
    }));
  }

  function refreshLandingMode() {
    lobby.classList.add('landing-v15');
    lobby.classList.remove('mode-duel','mode-party','mode-solo');
    lobby.classList.add(`mode-${gameMode}`);
    document.body.classList.toggle('in-game', !game.classList.contains('hidden'));
    const playerLabel = $('playerName')?.closest('label');
    if (playerLabel) {
      playerLabel.classList.remove('hidden');
      playerLabel.style.gridColumn = '1 / -1';
      playerLabel.querySelector('input').placeholder = gameMode === 'duel' ? 'Your battle name' : 'Player name';
    }
    const create = $('createRoomBtn'), join = $('joinRoomBtn');
    if (gameMode === 'party') {
      if (create) create.textContent = 'Create Party';
      if (join) join.textContent = 'Join Party';
      if ($('roomStatus') && !game.classList.contains('hidden')) $('roomStatus').textContent = 'Party supports up to 6 players.';
    }
    renderRecentRooms();
  }

  // Large cards select the mode; the actual 2P action is Find Opponent.
  modeGrid.querySelectorAll('.mode-card').forEach(card => card.addEventListener('click', () => setTimeout(refreshLandingMode, 10)));

  $('find2PBtn')?.addEventListener('click', () => {
    const name = $('playerName')?.value.trim();
    if (!name) { $('playerName')?.focus(); return; }
    gameMode = 'duel'; localStorage.setItem('tb_mode','duel');
    // Current local transport uses one shared matchmaking channel. Firebase adapter will replace this with actual online queue matchmaking.
    openGame('2P-MATCH');
    document.querySelector('.room-pill')?.classList.add('hidden');
    if ($('playerState')) $('playerState').textContent = 'Finding opponent…';
  });

  const oldOpen = openGame;
  openGame = function(code) {
    const out = oldOpen(code);
    document.body.classList.add('in-game');
    if (gameMode === 'duel') document.querySelector('.room-pill')?.classList.add('hidden');
    return out;
  };

  const oldQuit = quitGame;
  quitGame = function() {
    const out = oldQuit();
    setTimeout(() => { document.body.classList.remove('in-game'); refreshLandingMode(); }, 0);
    return out;
  };

  refreshLandingMode();
})();