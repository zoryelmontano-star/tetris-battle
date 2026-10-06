// v40: Force reliable tactical thumb controls on touch battle screens.
(() => {
  const touchCapable = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window || !!window.matchMedia?.('(pointer: coarse)').matches;
  if (!touchCapable) return;

  const $ = id => document.getElementById(id);
  const isGameVisible = () => {
    const game = $('game');
    return !!game && !game.classList.contains('hidden') && getComputedStyle(game).display !== 'none';
  };
  const gateOpen = () => {
    const gate = $('multiplayerScreenGate');
    return !!gate && !gate.classList.contains('hidden');
  };

  function dispatchLegacy(action) {
    const btn = document.querySelector(`.touch-controls [data-action="${action}"]`);
    if (btn) {
      try {
        btn.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles:true, cancelable:true, pointerType:'touch', isPrimary:true
        }));
        return;
      } catch {}
    }
    try {
      if (action === 'left' && typeof move === 'function') move(-1);
      else if (action === 'right' && typeof move === 'function') move(1);
      else if (action === 'down' && typeof softDrop === 'function') softDrop();
      else if (action === 'rotate' && typeof rotate === 'function') rotate();
      else if (action === 'drop' && typeof hardDrop === 'function') hardDrop();
      if (typeof draw === 'function') draw();
    } catch {}
  }

  function holdAction() {
    const btn = $('holdBtn');
    if (btn) {
      try { btn.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true,cancelable:true,pointerType:'touch',isPrimary:true})); }
      catch { btn.click(); }
    }
  }

  function ensureControls() {
    let controls = $('tacticalTouchControls');
    if (!controls) {
      controls = document.createElement('div');
      controls.id = 'tacticalTouchControls';
      controls.className = 'tactical-touch-controls';
      controls.innerHTML = `
        <div class="tactical-left" aria-label="Movement controls">
          <button type="button" data-tactical="left" aria-label="Move left">◀</button>
          <button type="button" data-tactical="down" aria-label="Soft drop">▼</button>
          <button type="button" data-tactical="right" aria-label="Move right">▶</button>
        </div>
        <button type="button" class="tactical-pause" data-tactical="pause" aria-label="Pause">Ⅱ</button>
        <div class="tactical-right" aria-label="Action controls">
          <button type="button" class="tactical-hold" data-tactical="hold"><small>HOLD</small><b>H</b></button>
          <button type="button" class="tactical-a" data-tactical="rotate"><small>ROTATE</small><b>A</b></button>
          <button type="button" class="tactical-b" data-tactical="drop"><small>DROP</small><b>B</b></button>
        </div>`;
      document.body.appendChild(controls);
    }
    return controls;
  }

  const style = document.createElement('style');
  style.textContent = `
    #tacticalTouchControls{position:fixed!important;inset:0!important;z-index:50000!important;pointer-events:none!important;font-family:inherit!important}
    #tacticalTouchControls .tactical-left,#tacticalTouchControls .tactical-right,#tacticalTouchControls .tactical-pause{position:absolute!important;pointer-events:auto!important}
    #tacticalTouchControls .tactical-left{left:max(10px,env(safe-area-inset-left))!important;bottom:max(8px,env(safe-area-inset-bottom))!important;display:grid!important;grid-template-columns:repeat(3,58px)!important;gap:7px!important;align-items:end!important}
    #tacticalTouchControls .tactical-left button{width:58px!important;height:58px!important;border-radius:17px!important;padding:0!important;font-size:24px!important;font-weight:1000!important;background:linear-gradient(180deg,rgba(54,61,112,.97),rgba(22,27,65,.97))!important;color:#fff!important;border:2px solid rgba(105,224,255,.72)!important;box-shadow:inset 0 2px 0 rgba(255,255,255,.17),0 8px 22px rgba(0,0,0,.46)!important;touch-action:none!important;-webkit-user-select:none!important;user-select:none!important}
    #tacticalTouchControls .tactical-left button[data-tactical="down"]{transform:translateY(8px)!important}
    #tacticalTouchControls .tactical-right{right:max(10px,env(safe-area-inset-right))!important;bottom:max(7px,env(safe-area-inset-bottom))!important;width:185px!important;height:96px!important}
    #tacticalTouchControls .tactical-right button{position:absolute!important;border-radius:50%!important;padding:0!important;display:grid!important;place-items:center!important;align-content:center!important;color:#fff!important;border:2px solid rgba(255,255,255,.42)!important;box-shadow:inset 0 3px 0 rgba(255,255,255,.18),0 8px 22px rgba(0,0,0,.45)!important;touch-action:none!important;-webkit-user-select:none!important;user-select:none!important}
    #tacticalTouchControls .tactical-right small{font-size:6px!important;line-height:1!important;letter-spacing:.08em!important;opacity:.82!important}#tacticalTouchControls .tactical-right b{font-size:18px!important;line-height:1.05!important}
    #tacticalTouchControls .tactical-a{width:66px!important;height:66px!important;right:0!important;top:0!important;background:linear-gradient(180deg,#ff8d9d,#b93462)!important}
    #tacticalTouchControls .tactical-b{width:66px!important;height:66px!important;right:72px!important;top:27px!important;background:linear-gradient(180deg,#68cfff,#2465c7)!important}
    #tacticalTouchControls .tactical-hold{width:48px!important;height:48px!important;left:0!important;top:1px!important;background:linear-gradient(180deg,#8d82d8,#4a408b)!important}
    #tacticalTouchControls .tactical-hold b{font-size:13px!important}#tacticalTouchControls .tactical-hold small{font-size:5px!important}
    #tacticalTouchControls .tactical-pause{top:max(7px,env(safe-area-inset-top))!important;right:max(9px,env(safe-area-inset-right))!important;width:38px!important;height:38px!important;border-radius:12px!important;padding:0!important;font-size:16px!important;color:#fff!important;background:rgba(16,20,52,.92)!important;border:1px solid rgba(111,228,255,.62)!important;box-shadow:0 5px 14px rgba(0,0,0,.35)!important}
    #tacticalTouchControls button:active,#tacticalTouchControls button.pressed{filter:brightness(1.3)!important}
    @media(max-height:430px){
      #tacticalTouchControls .tactical-left{grid-template-columns:repeat(3,50px)!important;gap:6px!important}
      #tacticalTouchControls .tactical-left button{width:50px!important;height:50px!important;border-radius:15px!important;font-size:21px!important}
      #tacticalTouchControls .tactical-right{transform:scale(.88)!important;transform-origin:right bottom!important}
      #tacticalTouchControls .tactical-pause{width:34px!important;height:34px!important}
    }
  `;
  document.head.appendChild(style);

  const controls = ensureControls();
  const repeaters = new Map();

  function stop(btn) {
    const timers = repeaters.get(btn);
    if (timers) {
      clearTimeout(timers.timeout);
      clearInterval(timers.interval);
      repeaters.delete(btn);
    }
    btn?.classList.remove('pressed');
  }

  function startRepeat(btn, action) {
    stop(btn);
    btn.classList.add('pressed');
    dispatchLegacy(action);
    const timers = {};
    timers.timeout = setTimeout(() => {
      timers.interval = setInterval(() => dispatchLegacy(action), action === 'down' ? 55 : 72);
    }, action === 'down' ? 120 : 155);
    repeaters.set(btn, timers);
  }

  if (!controls.dataset.v40Bound) {
    controls.dataset.v40Bound = '1';
    controls.addEventListener('pointerdown', event => {
      const btn = event.target.closest('[data-tactical]');
      if (!btn) return;
      event.preventDefault();
      event.stopPropagation();
      const action = btn.dataset.tactical;
      if (['left','right','down'].includes(action)) startRepeat(btn, action);
      else {
        btn.classList.add('pressed');
        if (action === 'rotate') dispatchLegacy('rotate');
        else if (action === 'drop') dispatchLegacy('drop');
        else if (action === 'hold') holdAction();
        else if (action === 'pause') $('pauseBtn')?.click();
      }
    }, {passive:false});
    ['pointerup','pointercancel','pointerleave'].forEach(type => controls.addEventListener(type, event => {
      const btn = event.target.closest?.('[data-tactical]');
      if (btn) stop(btn);
    }, {passive:false}));
  }

  function refresh() {
    const active = isGameVisible() && !gateOpen();
    controls.style.setProperty('display', active ? 'block' : 'none', 'important');
    controls.style.setProperty('visibility', active ? 'visible' : 'hidden', 'important');
    controls.style.setProperty('opacity', active ? '1' : '0', 'important');
    controls.style.setProperty('z-index', '50000', 'important');
    document.body.classList.toggle('tb-touch-battle', active);
  }

  new MutationObserver(refresh).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  window.addEventListener('resize', refresh, {passive:true});
  window.addEventListener('orientationchange', () => [0,120,300,600].forEach(d => setTimeout(refresh,d)), {passive:true});
  window.visualViewport?.addEventListener('resize', refresh, {passive:true});
  setInterval(refresh,400);
  refresh();
})();
