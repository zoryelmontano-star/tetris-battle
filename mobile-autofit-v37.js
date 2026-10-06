// v39: Height-fit touch multiplayer layout with a dominant local board and smaller opponents.
(() => {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (!coarse) return;

  const $ = id => document.getElementById(id);
  const game = $('game');
  if (!game) return;

  const style = document.createElement('style');
  style.textContent = `
    body.tb-touch-fit{
      overflow:hidden!important;
      overscroll-behavior:none!important;
      width:100vw!important;
      height:var(--tb-vh,100dvh)!important;
      background:#07091d!important;
    }
    body.tb-touch-fit .topbar{display:none!important}
    body.tb-touch-fit .app-shell{width:100vw!important;max-width:none!important;margin:0!important;padding:0!important}
    body.tb-touch-fit #game{
      position:fixed!important;
      inset:0!important;
      z-index:12000!important;
      width:100vw!important;
      height:var(--tb-vh,100dvh)!important;
      min-height:0!important;
      max-height:none!important;
      margin:0!important;
      padding:3px 5px calc(var(--tb-control-h,84px) + max(4px,env(safe-area-inset-bottom)))!important;
      overflow:hidden!important;
      display:block!important;
      box-sizing:border-box!important;
    }
    body.tb-touch-fit #game>.arena-card{
      height:100%!important;
      min-height:0!important;
      width:100%!important;
      padding:3px 5px!important;
      margin:0!important;
      border-radius:13px!important;
      overflow:hidden!important;
      box-sizing:border-box!important;
      display:flex!important;
      flex-direction:column!important;
    }
    body.tb-touch-fit #game>.side-card{display:none!important}
    body.tb-touch-fit #game .battle-strip{min-height:25px!important;height:25px!important;margin:0 0 2px!important;padding:2px 5px!important;border-radius:8px!important}
    body.tb-touch-fit #game .battle-strip .avatar{width:22px!important;height:22px!important;font-size:8px!important}
    body.tb-touch-fit #game .battle-strip strong{font-size:9px!important}body.tb-touch-fit #game .battle-strip small{font-size:6px!important}
    body.tb-touch-fit #game .mode-pill,body.tb-touch-fit #game .room-pill{font-size:7px!important;padding:3px 6px!important}
    body.tb-touch-fit #game .hud{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:3px!important;margin:0 0 2px!important}
    body.tb-touch-fit #game .hud-box{min-height:28px!important;padding:3px 5px!important;border-radius:8px!important}
    body.tb-touch-fit #game .hud-box span{font-size:6px!important}body.tb-touch-fit #game .hud-box strong{font-size:13px!important}

    body.tb-touch-fit #liveArenaGrid{
      flex:1 1 auto!important;
      min-height:0!important;
      height:auto!important;
      margin:0!important;
      gap:5px!important;
      overflow:hidden!important;
      align-items:stretch!important;
    }
    body.tb-touch-fit #liveArenaGrid.duel{
      grid-template-columns:minmax(0,1.7fr) minmax(0,.72fr)!important;
    }
    body.tb-touch-fit #liveArenaGrid.party{
      grid-template-columns:minmax(0,1.45fr) repeat(3,minmax(0,.52fr))!important;
      grid-template-rows:repeat(2,minmax(0,1fr))!important;
    }
    body.tb-touch-fit #liveArenaGrid.party .local-live-tile{
      grid-column:1!important;
      grid-row:1 / span 2!important;
    }
    body.tb-touch-fit .live-player-tile{
      min-height:0!important;
      padding:4px!important;
      border-radius:11px!important;
      overflow:hidden!important;
      display:flex!important;
      flex-direction:column!important;
    }
    body.tb-touch-fit .live-player-head{min-height:22px!important;height:22px!important;margin:0 0 3px!important;grid-template-columns:22px minmax(0,1fr) auto!important;gap:4px!important}
    body.tb-touch-fit .live-player-head strong{font-size:8px!important}body.tb-touch-fit .live-player-head small{font-size:6px!important;margin-top:0!important}
    body.tb-touch-fit .live-place{min-width:20px!important;width:20px!important;height:20px!important;font-size:6px!important;border-radius:6px!important}
    body.tb-touch-fit .live-ko{font-size:7px!important}

    /* Your board owns the height. It remains the main object on screen. */
    body.tb-touch-fit .local-live-tile .play-stage{
      flex:1 1 auto!important;
      min-height:0!important;
      width:100%!important;
      height:100%!important;
      display:grid!important;
      grid-template-columns:52px minmax(0,auto) 52px!important;
      justify-content:center!important;
      align-items:center!important;
      gap:4px!important;
      margin:0!important;
    }
    body.tb-touch-fit .local-live-tile .board-shell{
      height:min(100%,calc(var(--tb-vh,100dvh) - var(--tb-control-h,84px) - 92px))!important;
      width:auto!important;
      max-width:none!important;
      aspect-ratio:1/2!important;
      margin:0 auto!important;
      padding:4px!important;
      box-sizing:border-box!important;
      border-radius:10px!important;
    }
    body.tb-touch-fit .local-live-tile #board{height:100%!important;width:100%!important;display:block!important}
    body.tb-touch-fit .local-live-tile .hold-panel,
    body.tb-touch-fit .local-live-tile .next-panel{
      width:52px!important;
      max-width:52px!important;
      padding:4px!important;
      border-radius:9px!important;
      align-self:center!important;
    }
    body.tb-touch-fit .local-live-tile .hold-panel>p,
    body.tb-touch-fit .local-live-tile .next-panel>p{font-size:7px!important;margin-bottom:3px!important}
    body.tb-touch-fit .local-live-tile .hold-card,
    body.tb-touch-fit .local-live-tile .next-card{min-height:48px!important;padding:1px!important;margin-bottom:3px!important;border-radius:7px!important}
    body.tb-touch-fit .local-live-tile .hold-card canvas,
    body.tb-touch-fit .local-live-tile .next-card canvas{width:100%!important;height:auto!important}
    body.tb-touch-fit .local-live-tile .hold-panel small,
    body.tb-touch-fit .local-live-tile .streak-box small{display:none!important}
    body.tb-touch-fit .local-live-tile .streak-box{padding:4px 2px!important;border-radius:7px!important}.local-live-tile .streak-box strong{font-size:11px!important}

    /* Rival / arena boards are intentionally secondary and smaller. */
    body.tb-touch-fit .remote-live-tile{align-self:center!important;justify-self:center!important;width:100%!important;max-width:170px!important;height:auto!important;max-height:100%!important}
    body.tb-touch-fit .remote-live-tile .live-player-head{grid-template-columns:18px minmax(0,1fr)!important;height:auto!important;min-height:20px!important}
    body.tb-touch-fit .remote-live-tile .live-ko{grid-column:1/-1!important;text-align:center!important;font-size:6px!important}
    body.tb-touch-fit .remote-board-shell{
      width:auto!important;
      height:min(46vh,calc(var(--tb-vh,100dvh) - var(--tb-control-h,84px) - 125px))!important;
      max-width:100%!important;
      aspect-ratio:1/2!important;
      padding:3px!important;
      margin:0 auto!important;
      border-radius:8px!important;
      flex:0 1 auto!important;
    }
    body.tb-touch-fit .remote-status-row{font-size:6px!important;margin-top:2px!important;gap:3px!important}
    body.tb-touch-fit #liveArenaGrid.party .remote-live-tile{max-width:115px!important;max-height:100%!important;padding:3px!important}
    body.tb-touch-fit #liveArenaGrid.party .remote-board-shell{height:min(30vh,calc((var(--tb-vh,100dvh) - var(--tb-control-h,84px) - 120px)/2))!important}
    body.tb-touch-fit #liveArenaGrid.party .remote-live-tile .live-player-head{min-height:16px!important;height:16px!important;margin-bottom:2px!important}
    body.tb-touch-fit #liveArenaGrid.party .remote-status-row{display:none!important}

    body.tb-touch-fit #game .bottom-actions,
    body.tb-touch-fit #game .controls-note,
    body.tb-touch-fit #game .gesture-hint{display:none!important}

    @media(max-height:430px){
      body.tb-touch-fit{--tb-control-h:72px}
      body.tb-touch-fit #game{padding-bottom:calc(72px + max(3px,env(safe-area-inset-bottom)))!important}
      body.tb-touch-fit .local-live-tile .play-stage{grid-template-columns:44px minmax(0,auto) 44px!important}
      body.tb-touch-fit .local-live-tile .hold-panel,body.tb-touch-fit .local-live-tile .next-panel{width:44px!important;max-width:44px!important}
      body.tb-touch-fit .remote-live-tile{max-width:140px!important}
    }
  `;
  document.head.appendChild(style);

  function viewportSize(){
    const vv = window.visualViewport;
    return {
      width:Math.max(1,Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 1)),
      height:Math.max(1,Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 1))
    };
  }
  function isLandscape(){
    const {width,height}=viewportSize();
    return !!window.matchMedia?.('(orientation: landscape)').matches || width>height;
  }
  function isMultiplayer(){ return typeof gameMode !== 'undefined' && (gameMode==='duel'||gameMode==='party'); }
  function isGameVisible(){ return !game.classList.contains('hidden') && getComputedStyle(game).display !== 'none'; }
  function gateOpen(){ const g=$('multiplayerScreenGate'); return !!g && !g.classList.contains('hidden'); }

  function refresh(){
    const {height}=viewportSize();
    document.documentElement.style.setProperty('--tb-vh',`${height}px`);
    const shouldFit=isGameVisible()&&isMultiplayer()&&isLandscape()&&!gateOpen();
    document.body.classList.toggle('tb-touch-fit',shouldFit);
    document.body.classList.toggle('tb-touch-battle',shouldFit);
  }

  window.addEventListener('resize',refresh,{passive:true});
  window.addEventListener('orientationchange',()=>[0,100,250,500,900].forEach(d=>setTimeout(refresh,d)),{passive:true});
  window.visualViewport?.addEventListener('resize',refresh,{passive:true});
  try{window.screen?.orientation?.addEventListener?.('change',refresh)}catch{}
  new MutationObserver(refresh).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  setInterval(refresh,700);
  refresh();
})();
