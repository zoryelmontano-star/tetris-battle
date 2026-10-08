// v46: PC-key-inspired mobile controls with event-driven visibility and tutorial action bridge.
(() => {
  const touchCapable = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window || !!window.matchMedia?.('(pointer: coarse)').matches;
  if (!touchCapable) return;

  const $ = id => document.getElementById(id);
  const controls = document.createElement('div');
  controls.id = 'pcStyleTouchControls';
  controls.innerHTML = `
    <div class="pc-touch-utility">
      <button type="button" data-touch-action="pause">Ⅱ <span>PAUSE</span></button>
      <button type="button" class="quit" data-touch-action="quit">× <span>QUIT</span></button>
    </div>

    <button type="button" class="pc-touch-space" data-touch-action="drop" aria-label="Hard drop">HARD DROP</button>

    <div class="pc-touch-arrows" aria-label="Movement controls">
      <button type="button" class="rotate" data-touch-action="rotate" aria-label="Rotate">⟳</button>
      <button type="button" class="left" data-touch-action="left" aria-label="Move left">◀</button>
      <button type="button" class="down" data-touch-action="down" aria-label="Soft drop">▼</button>
      <button type="button" class="right" data-touch-action="right" aria-label="Move right">▶</button>
    </div>`;
  document.body.appendChild(controls);

  const style = document.createElement('style');
  style.textContent = `
    #pcStyleTouchControls{display:none;position:fixed;inset:0;z-index:65000;pointer-events:none;font-family:inherit}
    #pcStyleTouchControls button{pointer-events:auto;touch-action:none;-webkit-user-select:none;user-select:none;color:#fff;font-family:inherit}

    .pc-touch-utility{position:absolute;top:max(7px,env(safe-area-inset-top));right:max(9px,env(safe-area-inset-right));display:flex;gap:6px}
    .pc-touch-utility button{height:34px;border-radius:10px;padding:0 10px;font-size:12px;font-weight:900;background:rgba(16,20,52,.95);border:1px solid rgba(111,228,255,.58);box-shadow:0 5px 14px rgba(0,0,0,.35)}
    .pc-touch-utility .quit{border-color:rgba(255,112,135,.66);background:rgba(75,20,39,.94)}
    .pc-touch-utility span{font-size:8px;letter-spacing:.06em;margin-left:3px}

    .pc-touch-space{position:absolute;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));width:min(44vw,220px);height:54px;border-radius:15px;padding:0 18px;font-size:13px;font-weight:1000;letter-spacing:.06em;background:linear-gradient(180deg,rgba(65,75,132,.98),rgba(24,29,69,.98));border:2px solid rgba(105,224,255,.72);box-shadow:inset 0 2px 0 rgba(255,255,255,.17),0 8px 22px rgba(0,0,0,.46)}

    .pc-touch-arrows{position:absolute;right:max(12px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));width:176px;height:124px}
    .pc-touch-arrows button{position:absolute;width:54px;height:54px;border-radius:15px;padding:0;font-size:22px;font-weight:1000;background:linear-gradient(180deg,rgba(54,61,112,.98),rgba(22,27,65,.98));border:2px solid rgba(105,224,255,.72);box-shadow:inset 0 2px 0 rgba(255,255,255,.17),0 8px 22px rgba(0,0,0,.46)}
    .pc-touch-arrows .rotate{left:61px;top:0;background:linear-gradient(180deg,#876ed8,#51439c)}
    .pc-touch-arrows .left{left:0;top:61px}
    .pc-touch-arrows .down{left:61px;top:61px}
    .pc-touch-arrows .right{left:122px;top:61px}

    #pcStyleTouchControls button.pressed,#pcStyleTouchControls button:active{filter:brightness(1.28);transform:scale(.93)}

    body.tb-touch-fit .hold-panel{cursor:pointer!important;touch-action:manipulation!important;position:relative}
    body.tb-touch-fit .hold-panel::after{content:'TAP';position:absolute;right:4px;bottom:3px;font-size:5px;font-weight:1000;letter-spacing:.08em;color:rgba(255,255,255,.42);pointer-events:none}

    @media(max-width:430px){
      .pc-touch-space{width:min(42vw,170px);height:50px;font-size:11px}
      .pc-touch-arrows{width:154px;height:110px}
      .pc-touch-arrows button{width:47px;height:47px;border-radius:13px;font-size:19px}
      .pc-touch-arrows .rotate{left:53px}.pc-touch-arrows .left{top:54px}.pc-touch-arrows .down{left:53px;top:54px}.pc-touch-arrows .right{left:106px;top:54px}
    }
    @media(max-height:430px){
      .pc-touch-space{height:46px;width:min(38vw,190px);bottom:max(7px,env(safe-area-inset-bottom))}
      .pc-touch-arrows{transform:scale(.86);transform-origin:right bottom;bottom:max(5px,env(safe-area-inset-bottom))}
      .pc-touch-utility button{height:30px;padding:0 8px}.pc-touch-utility span{font-size:7px}
    }
  `;
  document.head.appendChild(style);

  const repeaters = new Map();
  const running = () => typeof gameRunning !== 'undefined' && !!gameRunning;
  const isPaused = () => typeof paused !== 'undefined' && !!paused;

  function advanceTutorial(action){
    if (!window.TBTutorialActive) return;
    const title = ($('tutorialCoachTitle')?.textContent || '').trim();
    const expected = {
      'Move your piece':['left','right'],
      'Rotate':['rotate'],
      'Soft Drop':['down'],
      'Hard Drop':['drop'],
      'Use HOLD':['hold'],
      'Pause safely':['pause']
    }[title] || [];
    if (!expected.includes(action)) return;
    // tutorial-name-v32 keeps its step state privately. Its Next handler advances that same state,
    // so clicking the hidden Next button is a safe bridge for the newer touch controls.
    setTimeout(() => $('tutorialNextBtn')?.click(), 0);
  }

  function act(action){
    try {
      if (action === 'left' && typeof move === 'function') move(-1);
      else if (action === 'right' && typeof move === 'function') move(1);
      else if (action === 'down' && typeof softDrop === 'function') softDrop();
      else if (action === 'rotate' && typeof rotate === 'function') rotate();
      else if (action === 'drop' && typeof hardDrop === 'function') hardDrop();
      if (typeof draw === 'function') draw();
      advanceTutorial(action);
    } catch (err) { console.error('Touch action failed', action, err); }
  }

  function stopRepeat(btn){
    const r = repeaters.get(btn);
    if (r) {
      clearTimeout(r.timeout);
      clearInterval(r.interval);
      repeaters.delete(btn);
    }
    btn?.classList.remove('pressed');
  }

  function stopAllRepeats(){
    [...repeaters.keys()].forEach(stopRepeat);
  }

  function startRepeat(btn, action){
    stopRepeat(btn);
    btn.classList.add('pressed');
    act(action);
    const r = {};
    r.timeout = setTimeout(() => {
      r.interval = setInterval(() => act(action), action === 'down' ? 55 : 72);
    }, action === 'down' ? 120 : 155);
    repeaters.set(btn,r);
  }

  controls.addEventListener('pointerdown', event => {
    const btn = event.target.closest('button[data-touch-action]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    const action = btn.dataset.touchAction;

    if (action === 'pause') {
      advanceTutorial('pause');
      try { if (typeof pauseGame === 'function') pauseGame(); else $('pauseBtn')?.click(); } catch {}
      return;
    }
    if (action === 'quit') {
      stopAllRepeats();
      try { if (typeof quitGame === 'function') quitGame(); else $('quitBtn')?.click(); } catch {}
      return;
    }
    if (!running() || isPaused()) {
      // Tutorial lessons should still respond to the displayed touch controls even before
      // the practice board is marked as running.
      if (window.TBTutorialActive && !isPaused()) advanceTutorial(action);
      return;
    }

    if (['left','right','down'].includes(action)) startRepeat(btn,action);
    else {
      btn.classList.add('pressed');
      act(action);
    }
    try { btn.setPointerCapture(event.pointerId); } catch {}
  }, {passive:false});

  ['pointerup','pointercancel','pointerleave'].forEach(type => controls.addEventListener(type,event => {
    const btn = event.target.closest?.('button[data-touch-action]');
    if (btn) stopRepeat(btn);
  }, {passive:false}));

  // HOLD is the HOLD box itself. No separate HOLD control is shown.
  document.addEventListener('pointerdown', event => {
    const panel = event.target?.closest?.('.hold-panel');
    if (!panel || event.target?.closest?.('#holdBtn')) return;
    const gameEl = $('game');
    if (!gameEl || gameEl.classList.contains('hidden') || !running() || isPaused()) return;
    event.preventDefault();
    event.stopPropagation();
    const holdBtn = $('holdBtn');
    if (!holdBtn || holdBtn.disabled) return;
    advanceTutorial('hold');
    try {
      holdBtn.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'touch',isPrimary:true}));
    } catch {
      holdBtn.click();
    }
  }, {passive:false});

  function gameVisible(){
    const gameEl = $('game');
    return !!gameEl && !gameEl.classList.contains('hidden') && getComputedStyle(gameEl).display !== 'none';
  }
  function refresh(){
    const show = gameVisible();
    controls.style.setProperty('display',show?'block':'none','important');
    controls.style.setProperty('visibility',show?'visible':'hidden','important');
    controls.style.setProperty('opacity',show?'1':'0','important');
    if (!show) stopAllRepeats();
  }

  const gameEl = $('game');
  if (gameEl) new MutationObserver(refresh).observe(gameEl,{attributes:true,attributeFilter:['class','style']});
  window.addEventListener('resize',refresh,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(refresh,80),{passive:true});
  window.visualViewport?.addEventListener('resize',refresh,{passive:true});
  document.addEventListener('visibilitychange',()=>{ if (document.hidden) stopAllRepeats(); refresh(); },{passive:true});
  refresh();
})();
