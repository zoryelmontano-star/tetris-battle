// v38: Tactical touch controls + reliable multiplayer orientation gating.
(() => {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const $ = id => document.getElementById(id);

  // Keep the legacy control pad in the DOM as an action bus, but never show it.
  const baseStyle = document.createElement('style');
  baseStyle.textContent = `
    .touch-controls{display:none!important}
    .hold-touch-btn{display:none!important}
  `;
  document.head.appendChild(baseStyle);

  // ---------- Multiplayer orientation / screen gate ----------
  const MIN_MULTIPLAYER_LANDSCAPE_WIDTH = 640;
  let pendingMultiplayerEntry = null;

  function viewportSize(){
    const vv = window.visualViewport;
    return {
      width: Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 0),
      height: Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 0)
    };
  }
  function isLandscape(){
    const {width,height} = viewportSize();
    return !!window.matchMedia?.('(orientation: landscape)').matches || width > height;
  }
  function landscapeWidth(){
    const {width,height} = viewportSize();
    return Math.max(width,height);
  }
  function isMultiplayerMode(){
    return typeof gameMode !== 'undefined' && (gameMode === 'duel' || gameMode === 'party');
  }
  function ensureScreenGate(){
    let gate = $('multiplayerScreenGate');
    if (gate) return gate;
    gate = document.createElement('div');
    gate.id = 'multiplayerScreenGate';
    gate.className = 'multiplayer-screen-gate hidden';
    gate.innerHTML = `
      <div class="multiplayer-screen-card" role="dialog" aria-modal="true" aria-labelledby="multiplayerScreenTitle">
        <div class="multiplayer-screen-icon">↻</div>
        <h2 id="multiplayerScreenTitle">Rotate your device</h2>
        <p id="multiplayerScreenText">Multiplayer uses a landscape battle layout.</p>
        <small id="multiplayerScreenHint">Rotate to landscape to continue.</small>
      </div>`;
    document.body.appendChild(gate);
    const style = document.createElement('style');
    style.textContent = `
      .multiplayer-screen-gate{position:fixed;inset:0;z-index:26000;display:grid;place-items:center;padding:22px;background:rgba(5,7,20,.95);backdrop-filter:blur(12px)}
      .multiplayer-screen-gate.hidden{display:none!important}
      .multiplayer-screen-card{width:min(92vw,470px);padding:30px 25px;border-radius:25px;text-align:center;background:linear-gradient(160deg,#252365,#15173d 55%,#0d112d);border:2px solid #5bdfff;box-shadow:0 30px 80px rgba(0,0,0,.62),0 0 42px rgba(72,212,255,.2)}
      .multiplayer-screen-icon{font-size:48px;line-height:1;color:#6de9ff;margin-bottom:8px}
      .multiplayer-screen-card h2{margin:6px 0 8px;color:#fff;font-size:26px}.multiplayer-screen-card p{margin:0;color:#c8cae8;font-size:13px;line-height:1.55}.multiplayer-screen-card small{display:block;margin-top:12px;color:#7f8bb9;font-size:10px}
    `;
    document.head.appendChild(style);
    return gate;
  }
  function screenGateReason(){
    if (!coarse || !isMultiplayerMode()) return '';
    if (!isLandscape()) return 'rotate';
    if (landscapeWidth() < MIN_MULTIPLAYER_LANDSCAPE_WIDTH) return 'small';
    return '';
  }
  function resumePendingEntry(){
    if (!pendingMultiplayerEntry) return;
    const trigger = pendingMultiplayerEntry;
    pendingMultiplayerEntry = null;
    if (trigger.isConnected) setTimeout(() => trigger.click(), 100);
  }
  function renderScreenGate(forceReason=''){
    const gate = ensureScreenGate();
    const reason = forceReason || screenGateReason();
    if (!reason) {
      gate.classList.add('hidden');
      resumePendingEntry();
      return false;
    }
    const title = $('multiplayerScreenTitle');
    const text = $('multiplayerScreenText');
    const hint = $('multiplayerScreenHint');
    if (reason === 'rotate') {
      title.textContent = 'Rotate your device';
      text.textContent = 'Multiplayer is designed for landscape so your board, opponents, and controls stay readable.';
      hint.textContent = 'Rotate to landscape. Your action will continue automatically.';
    } else {
      title.textContent = 'Use a larger screen';
      text.textContent = 'This display is too small for the multiplayer battle layout.';
      hint.textContent = 'Try a larger phone, tablet, iPad, laptop, or desktop. Solo and Tutorial still work here.';
    }
    gate.classList.remove('hidden');
    return true;
  }
  function refreshGateAfterRotation(){
    [0,80,180,350,650,1000].forEach(delay => setTimeout(() => renderScreenGate(), delay));
  }
  document.addEventListener('click', event => {
    if (!coarse) return;
    const trigger = event.target?.closest?.('#find2PBtn,#createRoomBtn,#joinRoomBtn,#battleAIBtn,#readyBtn,[data-multiplayer-entry]');
    if (!trigger) return;
    const reason = screenGateReason();
    if (!reason) return;
    pendingMultiplayerEntry = trigger;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    renderScreenGate(reason);
  }, true);
  window.addEventListener('resize', refreshGateAfterRotation, {passive:true});
  window.addEventListener('orientationchange', refreshGateAfterRotation, {passive:true});
  window.visualViewport?.addEventListener('resize', refreshGateAfterRotation, {passive:true});
  try { window.screen?.orientation?.addEventListener?.('change', refreshGateAfterRotation); } catch {}

  if (!coarse) return;
  document.body.classList.add('tb-tactical-touch');

  // ---------- Tactical thumb controls ----------
  function fireAction(action){
    const legacy = document.querySelector(`.touch-controls [data-action="${action}"]`);
    if (legacy) {
      legacy.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'touch',isPrimary:true}));
      return;
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
  function fireHold(){
    const hold = $('holdBtn');
    if (hold) hold.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,pointerType:'touch',isPrimary:true}));
  }
  function firePause(){ $('pauseBtn')?.click(); }
  function tinyHaptic(){ try { navigator.vibrate?.(8); } catch {} }

  const controls = document.createElement('div');
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

  const tacticalStyle = document.createElement('style');
  tacticalStyle.textContent = `
    .tactical-touch-controls{display:none;position:fixed;inset:0;z-index:24000;pointer-events:none;font-family:inherit}
    body.tb-tactical-touch #game:not(.hidden)~* .tactical-touch-controls{display:none}
    body.tb-tactical-touch.tb-touch-battle .tactical-touch-controls{display:block}
    .tactical-left,.tactical-right,.tactical-pause{pointer-events:auto;position:absolute}
    .tactical-left{left:max(10px,env(safe-area-inset-left));bottom:max(8px,env(safe-area-inset-bottom));display:grid;grid-template-columns:repeat(3,58px);gap:7px;align-items:end}
    .tactical-left button{width:58px;height:58px;border-radius:17px;padding:0;font-size:24px;font-weight:1000;background:linear-gradient(180deg,rgba(54,61,112,.96),rgba(22,27,65,.96));border:2px solid rgba(105,224,255,.58);box-shadow:inset 0 2px 0 rgba(255,255,255,.16),0 8px 20px rgba(0,0,0,.38);touch-action:none;-webkit-user-select:none;user-select:none}
    .tactical-left button[data-tactical="down"]{transform:translateY(8px)}
    .tactical-right{right:max(10px,env(safe-area-inset-right));bottom:max(7px,env(safe-area-inset-bottom));width:185px;height:96px}
    .tactical-right button{position:absolute;border-radius:50%;padding:0;display:grid;place-items:center;align-content:center;color:#fff;border:2px solid rgba(255,255,255,.36);box-shadow:inset 0 3px 0 rgba(255,255,255,.16),0 8px 20px rgba(0,0,0,.4);touch-action:none;-webkit-user-select:none;user-select:none}
    .tactical-right small{font-size:6px;line-height:1;letter-spacing:.08em;opacity:.78}.tactical-right b{font-size:18px;line-height:1.05}
    .tactical-a{width:66px;height:66px;right:0;top:0;background:linear-gradient(180deg,#ff8d9d,#b93462)}
    .tactical-b{width:66px;height:66px;right:72px;top:27px;background:linear-gradient(180deg,#68cfff,#2465c7)}
    .tactical-hold{width:48px;height:48px;left:0;top:1px;background:linear-gradient(180deg,#8d82d8,#4a408b)}
    .tactical-hold b{font-size:13px}.tactical-hold small{font-size:5px}
    .tactical-pause{top:max(7px,env(safe-area-inset-top));right:max(9px,env(safe-area-inset-right));width:38px;height:38px;border-radius:12px;padding:0;font-size:16px;background:rgba(16,20,52,.84);border:1px solid rgba(111,228,255,.48);box-shadow:0 5px 14px rgba(0,0,0,.28)}
    .tactical-touch-controls button:active,.tactical-touch-controls button.pressed{transform:scale(.91)!important;filter:brightness(1.25)}
    body.tb-touch-battle #game .bottom-actions,body.tb-touch-battle #game .controls-note,body.tb-touch-battle #game .gesture-hint{display:none!important}
    @media(max-height:430px){
      .tactical-left{grid-template-columns:repeat(3,50px);gap:6px}.tactical-left button{width:50px;height:50px;border-radius:15px;font-size:21px}
      .tactical-right{transform:scale(.88);transform-origin:right bottom}.tactical-pause{width:34px;height:34px}
    }
  `;
  document.head.appendChild(tacticalStyle);

  const repeaters = new Map();
  function stopRepeat(btn){
    const ids = repeaters.get(btn);
    if (ids) { clearTimeout(ids.timeout); clearInterval(ids.interval); repeaters.delete(btn); }
    btn.classList.remove('pressed');
  }
  function startRepeat(btn, action){
    stopRepeat(btn);
    btn.classList.add('pressed');
    tinyHaptic();
    fireAction(action);
    const delay = action === 'down' ? 120 : 155;
    const speed = action === 'down' ? 55 : 72;
    const ids = {};
    ids.timeout = setTimeout(() => { ids.interval = setInterval(() => fireAction(action), speed); }, delay);
    repeaters.set(btn, ids);
  }
  controls.addEventListener('pointerdown', event => {
    const btn = event.target.closest('[data-tactical]');
    if (!btn) return;
    event.preventDefault();
    const action = btn.dataset.tactical;
    if (['left','right','down'].includes(action)) startRepeat(btn, action);
    else {
      btn.classList.add('pressed'); tinyHaptic();
      if (action === 'rotate') fireAction('rotate');
      else if (action === 'drop') fireAction('drop');
      else if (action === 'hold') fireHold();
      else if (action === 'pause') firePause();
    }
    try { btn.setPointerCapture(event.pointerId); } catch {}
  }, {passive:false});
  ['pointerup','pointercancel','pointerleave'].forEach(type => controls.addEventListener(type, event => {
    const btn = event.target.closest?.('[data-tactical]');
    if (btn) stopRepeat(btn);
  }, {passive:false}));

  // Show tactical controls only while an actual touch battle is open.
  function refreshControlVisibility(){
    const game = $('game');
    const visible = game && !game.classList.contains('hidden');
    const gate = $('multiplayerScreenGate');
    const gateOpen = gate && !gate.classList.contains('hidden');
    const active = visible && !gateOpen && isLandscape();
    document.body.classList.toggle('tb-touch-battle', !!active);
  }
  new MutationObserver(refreshControlVisibility).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',refreshControlVisibility,{passive:true});
  window.addEventListener('orientationchange',()=>setTimeout(refreshControlVisibility,150),{passive:true});
  window.visualViewport?.addEventListener('resize',refreshControlVisibility,{passive:true});
  setInterval(refreshControlVisibility,600);
  refreshControlVisibility();

  // Touch tutorial copy now teaches the physical-button style layout.
  function rewriteTutorialCopy(){
    const quick = $('tutorialQuickControls');
    if (quick) {
      const spans = quick.querySelectorAll('span');
      if (spans[1]) spans[1].textContent = 'Use ◀ and ▶ to move · ▼ to soft drop · A to rotate · B to hard drop · HOLD to save/swap · Pause to pause.';
    }
    const title = $('tutorialCoachTitle')?.textContent || '';
    const text = $('tutorialCoachText');
    if (!text) return;
    if (title === 'Move your piece') text.textContent = 'Use the left thumb controls: ◀ and ▶ move the falling piece.';
    else if (title === 'Rotate') text.textContent = 'Tap A on the right side to rotate the falling piece.';
    else if (title === 'Soft Drop') text.textContent = 'Press or hold ▼ to bring the piece down faster.';
    else if (title === 'Hard Drop') text.textContent = 'Tap B to instantly drop and lock the piece.';
    else if (title === 'Use HOLD') text.textContent = 'Tap HOLD to save the current piece or swap it with the held piece.';
    else if (title === 'Pause safely') text.textContent = 'Tap the Pause button at the top-right. Resume continues from the same board state.';
  }
  rewriteTutorialCopy();
  const coach = $('tutorialCoach'); if (coach) new MutationObserver(rewriteTutorialCopy).observe(coach,{subtree:true,childList:true,characterData:true});
  const intro = $('tutorialIntro'); if (intro) new MutationObserver(rewriteTutorialCopy).observe(intro,{subtree:true,childList:true,characterData:true});
})();
