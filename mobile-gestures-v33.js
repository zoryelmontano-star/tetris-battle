// v36: Touch gestures, hidden on-screen controls, and reliable multiplayer orientation gating.
(() => {
  // The directional/rotate/drop pad and dedicated HOLD button are implementation hooks only.
  // Keep them in the DOM for existing event wiring, but never show them in the UI.
  const hiddenControlStyle = document.createElement('style');
  hiddenControlStyle.textContent = `
    .touch-controls{display:none!important}
    .hold-touch-btn{display:none!important}
  `;
  document.head.appendChild(hiddenControlStyle);

  const coarse = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const $ = id => document.getElementById(id);

  // ---------- Multiplayer orientation / screen gate ----------
  const MIN_MULTIPLAYER_LANDSCAPE_WIDTH = 640;
  let gateReason = '';
  let pendingMultiplayerEntry = null;

  function isMultiplayerMode(){
    return typeof gameMode !== 'undefined' && (gameMode === 'duel' || gameMode === 'party');
  }

  function viewportSize(){
    const vv = window.visualViewport;
    const width = Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 0);
    const height = Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 0);
    return {width, height};
  }

  function landscapeWidth(){
    const {width, height} = viewportSize();
    return Math.max(width, height);
  }

  function isLandscape(){
    const {width, height} = viewportSize();
    const mediaLandscape = !!window.matchMedia?.('(orientation: landscape)').matches;
    return mediaLandscape || width > height;
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
        <p id="multiplayerScreenText">Multiplayer works best in landscape so the battle boards stay readable.</p>
        <small id="multiplayerScreenHint">Solo and Tutorial can still be played in portrait.</small>
      </div>`;
    document.body.appendChild(gate);

    const style = document.createElement('style');
    style.textContent = `
      .multiplayer-screen-gate{position:fixed;inset:0;z-index:22000;display:grid;place-items:center;padding:22px;background:rgba(5,7,20,.94);backdrop-filter:blur(12px)}
      .multiplayer-screen-gate.hidden{display:none!important}
      .multiplayer-screen-card{width:min(92vw,470px);padding:30px 25px;border-radius:25px;text-align:center;background:linear-gradient(160deg,#252365,#15173d 55%,#0d112d);border:2px solid #5bdfff;box-shadow:0 30px 80px rgba(0,0,0,.62),0 0 42px rgba(72,212,255,.2)}
      .multiplayer-screen-icon{font-size:48px;line-height:1;color:#6de9ff;margin-bottom:8px}
      .multiplayer-screen-card h2{margin:6px 0 8px;color:#fff;font-size:26px}
      .multiplayer-screen-card p{margin:0;color:#c8cae8;font-size:13px;line-height:1.55}
      .multiplayer-screen-card small{display:block;margin-top:12px;color:#7f8bb9;font-size:10px;line-height:1.4}
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
    if (!trigger.isConnected) return;
    setTimeout(() => trigger.click(), 80);
  }

  function renderScreenGate(forceReason = ''){
    const gate = ensureScreenGate();
    gateReason = forceReason || screenGateReason();
    const title = $('multiplayerScreenTitle');
    const text = $('multiplayerScreenText');
    const hint = $('multiplayerScreenHint');

    if (!gateReason) {
      gate.classList.add('hidden');
      resumePendingEntry();
      return false;
    }

    if (gateReason === 'rotate') {
      title.textContent = 'Rotate your device';
      text.textContent = 'Multiplayer is available in landscape view so both your board and live opponent boards stay readable.';
      hint.textContent = 'Rotate to landscape. Your multiplayer action will continue automatically.';
    } else {
      title.textContent = 'Use a larger screen';
      text.textContent = 'This screen is too small for a fair multiplayer battle layout, even in landscape.';
      hint.textContent = 'Use a larger phone, tablet, iPad, laptop, or desktop. Solo and Tutorial remain available here.';
    }
    gate.classList.remove('hidden');
    return true;
  }

  function refreshGateAfterRotation(){
    // iOS Safari/PWA can update orientation and viewport dimensions at different times.
    [0, 80, 180, 350, 650, 1000].forEach(delay => {
      setTimeout(() => renderScreenGate(), delay);
    });
  }

  // Prevent multiplayer entry until a touch device meets the landscape / size requirement.
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
  try {
    window.screen?.orientation?.addEventListener?.('change', refreshGateAfterRotation);
  } catch {}

  if (!coarse) return;

  const boardShell = document.querySelector('.board-shell');
  const boardCanvas = $('board');
  if (!boardShell || !boardCanvas) return;

  document.body.classList.add('tb-gesture-controls');

  const style = document.createElement('style');
  style.textContent = `
    .tb-gesture-controls .board-shell,
    .tb-gesture-controls #board{touch-action:none!important;-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}
    .tb-gesture-controls .hold-card{cursor:pointer;touch-action:manipulation}
    .tb-gesture-controls .hold-card::after{content:'TAP TO SWAP';position:absolute;left:5px;right:5px;bottom:4px;text-align:center;font-size:7px;font-weight:1000;letter-spacing:.08em;color:#9edff4;opacity:.82;pointer-events:none}
    .gesture-hint{margin:7px auto 2px;max-width:520px;padding:7px 9px;border:1px solid rgba(105,232,255,.22);border-radius:10px;background:rgba(11,15,40,.64);color:#aeb8dc;font-size:9px;font-weight:800;line-height:1.35;text-align:center;letter-spacing:.015em}
    .gesture-hint b{color:#72e7ff}
    @media(max-width:620px){
      .tb-gesture-controls .play-stage{gap:4px!important}
      .gesture-hint{font-size:8px;padding:6px 7px}
    }
  `;
  document.head.appendChild(style);

  const bottomActions = document.querySelector('.bottom-actions');
  if (bottomActions && !$('gestureHint')) {
    const hint = document.createElement('div');
    hint.id = 'gestureHint';
    hint.className = 'gesture-hint';
    hint.innerHTML = '<b>TOUCH:</b> Drag ← → move · Drag ↓ soft drop · Tap rotate · Double-tap hard drop · Tap HOLD to swap';
    bottomActions.insertAdjacentElement('beforebegin', hint);
  }

  const controlsNote = document.querySelector('.controls-note');
  if (controlsNote) controlsNote.textContent = 'Touch: drag left/right to move · drag down to soft drop · tap to rotate · double-tap to hard drop · tap HOLD to swap · Pause button to pause';

  // Use the hidden legacy buttons as the action bus so all existing hooks,
  // tutorial tracking, audio, and future wrappers still receive the same events.
  function fireAction(action) {
    const btn = document.querySelector(`.touch-controls [data-action="${action}"]`);
    if (btn) {
      btn.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerType: 'touch',
        isPrimary: true
      }));
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

  function fireHold() {
    const btn = $('holdBtn');
    if (!btn) return;
    btn.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      cancelable: true,
      pointerType: 'touch',
      isPrimary: true
    }));
  }

  let activePointer = null;
  let startX = 0;
  let startY = 0;
  let lastHorizontalCell = 0;
  let lastVerticalCell = 0;
  let dragged = false;
  let downAt = 0;
  let pendingTap = null;
  let lastTapAt = 0;
  let lastTapX = 0;
  let lastTapY = 0;

  function cellSizes() {
    const rect = boardCanvas.getBoundingClientRect();
    return {
      x: Math.max(18, rect.width / 10),
      y: Math.max(18, rect.height / 20)
    };
  }

  boardShell.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    if (!gameRunning || paused) return;
    if (event.target?.closest?.('.overlay')) return;
    event.preventDefault();
    activePointer = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    lastHorizontalCell = 0;
    lastVerticalCell = 0;
    dragged = false;
    downAt = performance.now();
    try { boardShell.setPointerCapture(event.pointerId); } catch {}
  }, {passive:false});

  boardShell.addEventListener('pointermove', event => {
    if (event.pointerId !== activePointer || !gameRunning || paused) return;
    event.preventDefault();
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const distance = Math.hypot(dx, dy);
    if (distance > 9) dragged = true;
    if (!dragged) return;

    const size = cellSizes();
    const horizontalCell = Math.trunc(dx / size.x);
    let hDelta = horizontalCell - lastHorizontalCell;
    hDelta = Math.max(-6, Math.min(6, hDelta));
    while (hDelta < 0) { fireAction('left'); hDelta++; }
    while (hDelta > 0) { fireAction('right'); hDelta--; }
    lastHorizontalCell = horizontalCell;

    const verticalCell = Math.max(0, Math.trunc(dy / size.y));
    let vDelta = verticalCell - lastVerticalCell;
    vDelta = Math.max(0, Math.min(10, vDelta));
    while (vDelta > 0) { fireAction('down'); vDelta--; }
    lastVerticalCell = verticalCell;
  }, {passive:false});

  function finishPointer(event) {
    if (event.pointerId !== activePointer) return;
    event.preventDefault();
    try { boardShell.releasePointerCapture(event.pointerId); } catch {}
    activePointer = null;

    if (dragged) return;
    const held = performance.now() - downAt;
    if (held > 420) return;

    const now = performance.now();
    const nearLastTap = Math.hypot(event.clientX - lastTapX, event.clientY - lastTapY) < 34;
    const isDouble = now - lastTapAt < 290 && nearLastTap;

    if (isDouble) {
      clearTimeout(pendingTap);
      pendingTap = null;
      lastTapAt = 0;
      fireAction('drop');
      return;
    }

    lastTapAt = now;
    lastTapX = event.clientX;
    lastTapY = event.clientY;
    clearTimeout(pendingTap);
    pendingTap = setTimeout(() => {
      pendingTap = null;
      fireAction('rotate');
    }, 300);
  }

  boardShell.addEventListener('pointerup', finishPointer, {passive:false});
  boardShell.addEventListener('pointercancel', event => {
    if (event.pointerId === activePointer) activePointer = null;
  });

  document.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') return;
    const card = event.target?.closest?.('.hold-card');
    if (!card) return;
    event.preventDefault();
    fireHold();
  }, {passive:false});

  function rewriteTutorialCopy() {
    const quick = $('tutorialQuickControls');
    if (quick) {
      const spans = quick.querySelectorAll('span');
      if (spans[1]) spans[1].textContent = 'Drag left/right to move · Drag down for soft drop · Tap to rotate · Double-tap for hard drop · Tap HOLD to swap · Tap Pause to pause.';
    }

    const title = $('tutorialCoachTitle')?.textContent || '';
    const text = $('tutorialCoachText');
    if (!text) return;
    if (title === 'Move your piece') text.textContent = 'Drag left or right across the board to move the falling piece.';
    else if (title === 'Rotate') text.textContent = 'Tap the board once to rotate the falling piece.';
    else if (title === 'Soft Drop') text.textContent = 'Drag downward on the board to bring the piece down while keeping control.';
    else if (title === 'Hard Drop') text.textContent = 'Double-tap the board to instantly lock the piece into its landing position.';
    else if (title === 'Use HOLD') text.textContent = 'Tap the HOLD preview to save the current piece or swap it with the held piece.';
    else if (title === 'Pause safely') text.textContent = 'Tap Pause. Your exact board and progress should freeze, then Resume to continue from the same spot.';
  }

  rewriteTutorialCopy();
  const coach = $('tutorialCoach');
  if (coach) new MutationObserver(rewriteTutorialCopy).observe(coach, {subtree:true, childList:true, characterData:true});
  const intro = $('tutorialIntro');
  if (intro) new MutationObserver(rewriteTutorialCopy).observe(intro, {subtree:true, childList:true, characterData:true});
})();
