// v42: reliable tactical touch controls with direct actions plus visible Pause/Quit.
(() => {
  const touchCapable = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window || !!window.matchMedia?.('(pointer: coarse)').matches;
  if (!touchCapable) return;

  const $ = id => document.getElementById(id);
  const old = $('tacticalTouchControls');
  if (old) old.style.setProperty('display','none','important');

  const controls = document.createElement('div');
  controls.id = 'tacticalTouchControlsV42';
  controls.className = 'tactical-touch-controls-v42';
  controls.innerHTML = `
    <div class="t42-left" aria-label="Movement controls">
      <button type="button" data-action="left" aria-label="Move left">◀</button>
      <button type="button" data-action="down" aria-label="Soft drop">▼</button>
      <button type="button" data-action="right" aria-label="Move right">▶</button>
    </div>
    <div class="t42-utility">
      <button type="button" class="t42-pause" data-action="pause">Ⅱ <span>PAUSE</span></button>
      <button type="button" class="t42-quit" data-action="quit">× <span>QUIT</span></button>
    </div>
    <div class="t42-right" aria-label="Action controls">
      <button type="button" class="t42-hold" data-action="hold"><small>HOLD</small><b>H</b></button>
      <button type="button" class="t42-a" data-action="rotate"><small>ROTATE</small><b>A</b></button>
      <button type="button" class="t42-b" data-action="drop"><small>DROP</small><b>B</b></button>
    </div>`;
  document.body.appendChild(controls);

  const style = document.createElement('style');
  style.textContent = `
    #tacticalTouchControlsV42{display:none;position:fixed;inset:0;z-index:60000;pointer-events:none;font-family:inherit}
    #tacticalTouchControlsV42 button{pointer-events:auto;touch-action:none;-webkit-user-select:none;user-select:none;color:#fff;font-family:inherit}
    .t42-left{position:absolute;left:max(10px,env(safe-area-inset-left));bottom:max(8px,env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(3,58px);gap:7px;align-items:end}
    .t42-left button{width:58px;height:58px;border-radius:17px;padding:0;font-size:24px;font-weight:1000;background:linear-gradient(180deg,rgba(54,61,112,.98),rgba(22,27,65,.98));border:2px solid rgba(105,224,255,.72);box-shadow:inset 0 2px 0 rgba(255,255,255,.17),0 8px 22px rgba(0,0,0,.46)}
    .t42-left button[data-action="down"]{transform:translateY(8px)}
    .t42-right{position:absolute;right:max(10px,env(safe-area-inset-right));bottom:max(7px,env(safe-area-inset-bottom));width:185px;height:96px}
    .t42-right button{position:absolute;border-radius:50%;padding:0;display:grid;place-items:center;align-content:center;border:2px solid rgba(255,255,255,.42);box-shadow:inset 0 3px 0 rgba(255,255,255,.18),0 8px 22px rgba(0,0,0,.45)}
    .t42-right small{font-size:6px;line-height:1;letter-spacing:.08em;opacity:.82}.t42-right b{font-size:18px;line-height:1.05}
    .t42-a{width:66px;height:66px;right:0;top:0;background:linear-gradient(180deg,#ff8d9d,#b93462)}
    .t42-b{width:66px;height:66px;right:72px;top:27px;background:linear-gradient(180deg,#68cfff,#2465c7)}
    .t42-hold{width:48px;height:48px;left:0;top:1px;background:linear-gradient(180deg,#8d82d8,#4a408b)}
    .t42-hold b{font-size:13px}.t42-hold small{font-size:5px}
    .t42-utility{position:absolute;top:max(7px,env(safe-area-inset-top));right:max(9px,env(safe-area-inset-right));display:flex;gap:6px}
    .t42-utility button{height:34px;border-radius:10px;padding:0 10px;font-size:12px;font-weight:900;background:rgba(16,20,52,.94);border:1px solid rgba(111,228,255,.55);box-shadow:0 5px 14px rgba(0,0,0,.35)}
    .t42-utility .t42-quit{border-color:rgba(255,112,135,.6);background:rgba(75,20,39,.92)}
    .t42-utility span{font-size:8px;letter-spacing:.06em;margin-left:3px}
    #tacticalTouchControlsV42 button.pressed,#tacticalTouchControlsV42 button:active{filter:brightness(1.3);scale:.93}
    @media(max-height:430px){
      .t42-left{grid-template-columns:repeat(3,50px);gap:6px}.t42-left button{width:50px;height:50px;border-radius:15px;font-size:21px}
      .t42-right{transform:scale(.88);transform-origin:right bottom}
      .t42-utility button{height:30px;padding:0 8px}.t42-utility span{font-size:7px}
    }
  `;
  document.head.appendChild(style);

  const repeaters = new Map();
  const running = () => typeof gameRunning !== 'undefined' && !!gameRunning;
  const isPaused = () => typeof paused !== 'undefined' && !!paused;

  function direct(action){
    try {
      if (action === 'left' && typeof move === 'function') move(-1);
      else if (action === 'right' && typeof move === 'function') move(1);
      else if (action === 'down' && typeof softDrop === 'function') softDrop();
      else if (action === 'rotate' && typeof rotate === 'function') rotate();
      else if (action === 'drop' && typeof hardDrop === 'function') hardDrop();
      if (typeof draw === 'function') draw();
    } catch (err) { console.error('Touch action failed', action, err); }
  }

  function hold(){
    const btn = $('holdBtn');
    if (!btn) return;
    try { btn.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'touch',isPrimary:true})); }
    catch { btn.click(); }
  }

  function stopRepeat(btn){
    const r = repeaters.get(btn);
    if (r){ clearTimeout(r.timeout); clearInterval(r.interval); repeaters.delete(btn); }
    btn?.classList.remove('pressed');
  }

  function startRepeat(btn, action){
    stopRepeat(btn);
    btn.classList.add('pressed');
    direct(action);
    const r = {};
    r.timeout = setTimeout(() => {
      r.interval = setInterval(() => direct(action), action === 'down' ? 55 : 72);
    }, action === 'down' ? 120 : 155);
    repeaters.set(btn,r);
  }

  controls.addEventListener('pointerdown', event => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();
    const action = btn.dataset.action;

    if (action === 'quit') {
      try { if (typeof quitGame === 'function') quitGame(); else $('quitBtn')?.click(); } catch {}
      return;
    }
    if (action === 'pause') {
      try { if (typeof pauseGame === 'function') pauseGame(); else $('pauseBtn')?.click(); } catch {}
      return;
    }
    if (!running() || isPaused()) return;

    if (['left','right','down'].includes(action)) startRepeat(btn, action);
    else {
      btn.classList.add('pressed');
      if (action === 'rotate') direct('rotate');
      else if (action === 'drop') direct('drop');
      else if (action === 'hold') hold();
    }
    try { btn.setPointerCapture(event.pointerId); } catch {}
  }, {passive:false});

  ['pointerup','pointercancel','pointerleave'].forEach(type => controls.addEventListener(type,event => {
    const btn = event.target.closest?.('button[data-action]');
    if (btn) stopRepeat(btn);
  }, {passive:false}));

  function gateOpen(){
    const g = $('multiplayerScreenGate');
    return !!g && !g.classList.contains('hidden');
  }
  function isLandscape(){
    const vv = window.visualViewport;
    const w = vv?.width || innerWidth;
    const h = vv?.height || innerHeight;
    return !!window.matchMedia?.('(orientation: landscape)').matches || w > h;
  }
  function gameVisible(){
    const game = $('game');
    return !!game && !game.classList.contains('hidden') && getComputedStyle(game).display !== 'none';
  }
  function refresh(){
    const soloLike = (typeof gameMode !== 'undefined' && gameMode === 'solo') || !!window.TBTutorialActive;
    const multiplayerOkay = !gateOpen() && isLandscape();
    const show = gameVisible() && (soloLike || multiplayerOkay);
    controls.style.setProperty('display',show?'block':'none','important');
    controls.style.setProperty('visibility',show?'visible':'hidden','important');
    controls.style.setProperty('opacity',show?'1':'0','important');
  }

  new MutationObserver(refresh).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
  window.addEventListener('resize',refresh,{passive:true});
  window.addEventListener('orientationchange',()=>[0,120,300,600].forEach(d=>setTimeout(refresh,d)),{passive:true});
  window.visualViewport?.addEventListener('resize',refresh,{passive:true});
  setInterval(refresh,400);
  refresh();
})();
