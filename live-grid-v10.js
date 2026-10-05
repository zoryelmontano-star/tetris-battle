// Tetris Battle v10: full live board stage for 1v1 and 2–8 player Party.
(() => {
  const $ = id => document.getElementById(id);
  const gameEl = $('game');
  const arena = $('arenaCard');
  const stage = arena?.querySelector('.play-stage');
  if (!gameEl || !arena || !stage || $('liveArenaGrid')) return;

  const remotes = new Map();
  let liveSyncTimer = null;

  const grid = document.createElement('div');
  grid.id = 'liveArenaGrid';
  grid.className = 'live-arena-grid duel';

  const localTile = document.createElement('section');
  localTile.id = 'localLiveTile';
  localTile.className = 'live-player-tile local-live-tile';
  localTile.innerHTML = `
    <div class="live-player-head">
      <span class="live-place" id="localPlace">YOU</span>
      <div><strong id="localLiveName">YOU</strong><small id="localLiveMeta">0 pts</small></div>
      <b id="localLiveKO" class="live-ko">0 / 5 KO</b>
    </div>`;
  localTile.appendChild(stage);
  grid.appendChild(localTile);
  arena.insertBefore(grid, arena.querySelector('.touch-controls'));

  const style = document.createElement('style');
  style.textContent = `
    #game.live-stage-mode{grid-template-columns:1fr!important}
    #game.live-stage-mode>.side-card{display:none!important}
    .live-arena-grid{display:grid;gap:12px;align-items:start;margin:2px 0 14px}
    .live-arena-grid.duel{grid-template-columns:repeat(2,minmax(0,1fr))}
    .live-arena-grid.party{grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}
    .live-player-tile{min-width:0;padding:9px;border-radius:18px;background:linear-gradient(180deg,#241e24,#171418);border:1px solid #413740;box-shadow:0 13px 30px rgba(0,0,0,.22)}
    .live-player-tile.local-live-tile{border-color:#8e6a72;box-shadow:0 0 0 1px rgba(217,168,90,.08),0 15px 34px rgba(0,0,0,.25)}
    .live-player-head{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:8px;align-items:center;margin-bottom:8px;min-height:36px}
    .live-player-head strong,.live-player-head small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.live-player-head strong{font-size:12px}.live-player-head small{font-size:9px;color:#8e8189;margin-top:2px}
    .live-place{min-width:30px;height:29px;padding:0 5px;display:grid;place-items:center;border-radius:9px;background:#171317;border:1px solid #40363f;color:#e7c77f;font-size:9px;font-weight:1000}
    .live-ko{font-size:10px;color:#e7c77f;white-space:nowrap}.live-arena-grid.party .live-ko{display:none}
    .remote-board-shell{position:relative;width:min(100%,300px);margin:0 auto;aspect-ratio:1/2;padding:7px;border-radius:16px;background:linear-gradient(180deg,#5a5357,#2d292e 8%,#100e11 8.5%);box-shadow:0 12px 28px rgba(0,0,0,.28)}
    .remote-board-shell canvas{width:100%;height:100%;display:block;border-radius:10px;background:#09080a;image-rendering:pixelated}
    .remote-waiting{position:absolute;inset:7px;display:grid;place-items:center;text-align:center;padding:12px;border-radius:10px;background:rgba(12,10,13,.82);color:#93858e;font-size:11px;font-weight:800}
    .remote-status-row{display:flex;justify-content:space-between;gap:6px;margin-top:7px;color:#8c7f87;font-size:9px}.remote-status-row b{color:#e6c27d}
    .ready-chip{font-size:8px!important;font-weight:900;color:#8d8189}.ready-chip.ready{color:#9dcc8c}
    .live-arena-grid.duel .local-live-tile .play-stage{grid-template-columns:90px minmax(0,300px) 90px!important;gap:7px!important;margin:0!important}
    .live-arena-grid.duel .local-live-tile .hold-panel,.live-arena-grid.duel .local-live-tile .next-panel{width:90px!important}
    .live-arena-grid.duel .local-live-tile .board-shell{width:min(100%,300px)!important}
    .live-arena-grid.party .local-live-tile .play-stage{grid-template-columns:46px minmax(0,188px) 46px!important;gap:4px!important;margin:0!important}
    .live-arena-grid.party .local-live-tile .hold-panel,.live-arena-grid.party .local-live-tile .next-panel{width:46px!important;padding:4px!important}
    .live-arena-grid.party .local-live-tile .hold-panel small,.live-arena-grid.party .local-live-tile .streak-box{display:none!important}
    .live-arena-grid.party .local-live-tile .hold-touch-btn{font-size:7px;padding:5px 1px}.live-arena-grid.party .local-live-tile .board-shell{width:min(100%,188px)!important}
    .live-arena-grid.party .local-live-tile .next-card span,.live-arena-grid.party .local-live-tile .hold-card>span{display:none}
    .live-arena-grid.party .live-player-tile{padding:6px}.live-arena-grid.party .live-player-head{grid-template-columns:27px minmax(0,1fr);margin-bottom:5px}.live-arena-grid.party .remote-board-shell{max-width:188px}
    @media(max-width:1050px){.live-arena-grid.party{grid-template-columns:repeat(3,minmax(0,1fr))}.live-arena-grid.duel .local-live-tile .play-stage{grid-template-columns:62px minmax(0,260px) 62px!important}.live-arena-grid.duel .local-live-tile .hold-panel,.live-arena-grid.duel .local-live-tile .next-panel{width:62px!important}.live-arena-grid.duel .local-live-tile .board-shell{max-width:260px!important}}
    @media(max-width:720px){.live-arena-grid.duel{grid-template-columns:1fr 1fr;gap:6px}.live-arena-grid.party{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.live-player-tile{padding:5px}.live-player-head{grid-template-columns:24px minmax(0,1fr);gap:5px}.live-ko{grid-column:1/-1;text-align:center}.live-arena-grid.duel .local-live-tile .play-stage{grid-template-columns:minmax(0,1fr)!important}.live-arena-grid.duel .local-live-tile .hold-panel,.live-arena-grid.duel .local-live-tile .next-panel{display:none!important}.live-arena-grid.duel .local-live-tile .board-shell{width:100%!important}.remote-board-shell{padding:4px;border-radius:12px}}
  `;
  document.head.appendChild(style);

  function drawRemote(canvas, bd) {
    if (!canvas || !Array.isArray(bd)) return;
    const c = canvas.getContext('2d');
    const w = canvas.width / 10, h = canvas.height / 20;
    c.clearRect(0, 0, canvas.width, canvas.height);
    const bg = c.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#151117'); bg.addColorStop(1, '#09080a'); c.fillStyle = bg; c.fillRect(0, 0, canvas.width, canvas.height);
    c.strokeStyle = 'rgba(255,255,255,.04)'; c.lineWidth = .7;
    for (let x = 0; x <= 10; x++) { c.beginPath(); c.moveTo(x*w,0); c.lineTo(x*w,canvas.height); c.stroke(); }
    for (let y = 0; y <= 20; y++) { c.beginPath(); c.moveTo(0,y*h); c.lineTo(canvas.width,y*h); c.stroke(); }
    bd.forEach((row,y) => row.forEach((v,x) => {
      if (!v) return;
      const color = v === 'G' ? '#777177' : (window.COLORS?.[v] || '#b978aa');
      const px=x*w, py=y*h, g=c.createLinearGradient(px,py,px+w,py+h);
      const light = typeof adjust === 'function' ? adjust(color,28) : color;
      const dark = typeof adjust === 'function' ? adjust(color,-28) : color;
      g.addColorStop(0,light); g.addColorStop(.5,color); g.addColorStop(1,dark);
      c.fillStyle=g; c.fillRect(px+1,py+1,w-2,h-2);
      c.fillStyle='rgba(255,255,255,.2)'; c.fillRect(px+2.5,py+2.5,Math.max(2,w-5),2);
    }));
  }

  function ensureRemoteTile(id) {
    let tile = document.getElementById(`live-${id}`);
    if (tile) return tile;
    tile = document.createElement('section');
    tile.id = `live-${id}`;
    tile.className = 'live-player-tile remote-live-tile';
    tile.innerHTML = `<div class="live-player-head"><span class="live-place">—</span><div><strong>PLAYER</strong><small>0 pts · <span class="ready-chip">NOT READY</span></small></div><b class="live-ko">0 / 5 KO</b></div><div class="remote-board-shell"><canvas width="200" height="400"></canvas><div class="remote-waiting hidden">WAITING…</div></div><div class="remote-status-row"><span>LIVE</span><b>0 pts</b></div>`;
    grid.appendChild(tile);
    return tile;
  }

  function render() {
    const party = gameMode === 'party';
    gameEl.classList.add('live-stage-mode');
    grid.classList.toggle('party', party); grid.classList.toggle('duel', !party);
    $('localLiveName').textContent = ($('playerName')?.value || 'YOU').toUpperCase();
    $('localLiveMeta').innerHTML = `${Number(score || 0).toLocaleString()} pts · <span id="localReadyChip" class="ready-chip">NOT READY</span>`;
    const localKO = Number($('myKO')?.textContent || 0);
    $('localLiveKO').textContent = `${localKO} / 5 KO`;

    const now = Date.now();
    for (const [id,p] of remotes) if (now - p.seen > 7000) remotes.delete(id);
    const active = [...remotes.entries()].filter(([,p]) => p.mode === gameMode).sort((a,b) => (b[1].score||0) - (a[1].score||0));
    const visible = party ? active.slice(0,7) : active.slice(0,1);
    const keep = new Set(visible.map(([id]) => `live-${id}`));
    grid.querySelectorAll('.remote-live-tile').forEach(t => { if (!keep.has(t.id) && t.id !== 'live-waiting') t.remove(); });
    document.getElementById('live-waiting')?.remove();

    const ranking = [{id:'local',score:Number(score||0)}, ...visible.map(([id,p]) => ({id,score:Number(p.score||0)}))].sort((a,b) => b.score-a.score);
    const localPlace = ranking.findIndex(x => x.id === 'local') + 1;
    $('localPlace').textContent = party ? localPlace : 'YOU';
    localTile.style.order = party ? localPlace : 1;

    visible.forEach(([id,p]) => {
      const tile = ensureRemoteTile(id);
      const head = tile.querySelector('.live-player-head');
      const place = ranking.findIndex(x => x.id === id) + 1;
      head.querySelector('.live-place').textContent = party ? place : 'RIVAL';
      head.querySelector('strong').textContent = (p.name || 'PLAYER').toUpperCase();
      const readyChip = head.querySelector('.ready-chip');
      readyChip.textContent = p.ready ? 'READY' : 'NOT READY';
      readyChip.classList.toggle('ready', !!p.ready);
      head.querySelector('small').childNodes[0].textContent = `${Number(p.score||0).toLocaleString()} pts · `;
      head.querySelector('.live-ko').textContent = `${Number(p.ko||0)} / 5 KO`;
      tile.querySelector('.remote-status-row b').textContent = `${Number(p.score||0).toLocaleString()} pts`;
      drawRemote(tile.querySelector('canvas'), p.board);
      tile.style.order = party ? place : 2;
    });

    if (!party && !visible.length) {
      const tile = ensureRemoteTile('waiting');
      tile.style.order = 2;
      tile.querySelector('.live-player-head strong').textContent = 'WAITING FOR RIVAL';
      tile.querySelector('.live-player-head small').textContent = 'Join the same room in another tab';
      tile.querySelector('.live-ko').textContent = '0 / 5 KO';
      tile.querySelector('.remote-waiting').classList.remove('hidden');
      drawRemote(tile.querySelector('canvas'), Array.from({length:20},()=>Array(10).fill('')));
    }
  }

  function sendState() {
    if (!window.TBMultiplayer || !TBMultiplayer.room) return;
    TBMultiplayer.send('live_state', {
      name: $('playerName')?.value || 'Player', mode: gameMode, board, score: Number(score||0),
      ko: Number($('myKO')?.textContent || 0), timeLeft, sessionWins: Number(sessionWins||0),
      ready: !!window.TBReadyState?.localReady
    });
  }

  function startLiveSync() {
    clearInterval(liveSyncTimer);
    liveSyncTimer = setInterval(() => { sendState(); render(); }, 250);
  }

  if (window.TBMultiplayer) {
    TBMultiplayer.onMessage(msg => {
      const p = msg.payload || {};
      if (msg.type === 'hello' || msg.type === 'heartbeat') {
        const prior = remotes.get(msg.playerId) || {};
        remotes.set(msg.playerId, {...prior, name:p.name||prior.name||'Player', mode:p.mode||prior.mode||gameMode, seen:Date.now()});
      }
      if (msg.type === 'live_state') {
        remotes.set(msg.playerId, {
          name:p.name||'Player', mode:p.mode||'duel', board:Array.isArray(p.board)?p.board:Array.from({length:20},()=>Array(10).fill('')),
          score:Number(p.score||0), ko:Number(p.ko||0), timeLeft:Number(p.timeLeft||120), sessionWins:Number(p.sessionWins||0), ready:!!p.ready, seen:Date.now()
        });
      }
      if (msg.type === 'ready_state') {
        const prior = remotes.get(msg.playerId) || {board:Array.from({length:20},()=>Array(10).fill('')), score:0, ko:0, mode:p.mode||gameMode};
        remotes.set(msg.playerId, {...prior, name:p.name||prior.name||'Player', mode:p.mode||prior.mode, ready:!!p.ready, seen:Date.now()});
      }
      render();
    });
  }

  const oldOpen = openGame;
  openGame = function(code) {
    const r = oldOpen(code);
    setTimeout(() => { startLiveSync(); sendState(); render(); }, 0);
    return r;
  };

  document.querySelectorAll('.mode-card').forEach(btn => btn.addEventListener('click', () => setTimeout(() => { sendState(); render(); }, 20)));
  window.TBLiveGrid = { remotes, render, sendState };
  render();
})();
