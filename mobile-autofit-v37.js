// v37: Auto-fit the full multiplayer battle stage into a touch-device landscape viewport.
(() => {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (!coarse) return;

  const game = document.getElementById('game');
  if (!game) return;

  const style = document.createElement('style');
  style.textContent = `
    body.tb-battle-autofit{
      overflow:hidden!important;
      overscroll-behavior:none!important;
      width:100vw!important;
      height:100dvh!important;
    }
    body.tb-battle-autofit .topbar{display:none!important}
    body.tb-battle-autofit .app-shell{
      width:100vw!important;
      max-width:none!important;
      min-width:0!important;
      margin:0!important;
      padding:0!important;
    }
    body.tb-battle-autofit #game.tb-autofit-target{
      position:fixed!important;
      left:50%!important;
      top:50%!important;
      z-index:12000!important;
      margin:0!important;
      max-width:none!important;
      transform-origin:center center!important;
      will-change:transform;
    }
    body.tb-battle-autofit #game .controls-note,
    body.tb-battle-autofit #game .gesture-hint{display:none!important}
  `;
  document.head.appendChild(style);

  let raf = 0;
  let fitting = false;

  function viewportSize() {
    const vv = window.visualViewport;
    return {
      width: Math.max(1, Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || 1)),
      height: Math.max(1, Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || 1))
    };
  }

  function isLandscape() {
    const {width, height} = viewportSize();
    return !!window.matchMedia?.('(orientation: landscape)').matches || width > height;
  }

  function isMultiplayer() {
    return typeof gameMode !== 'undefined' && (gameMode === 'duel' || gameMode === 'party');
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.classList.contains('hidden')) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden';
  }

  function clearFit() {
    document.body.classList.remove('tb-battle-autofit');
    game.classList.remove('tb-autofit-target');
    game.style.removeProperty('width');
    game.style.removeProperty('height');
    game.style.removeProperty('transform');
  }

  function shouldFit() {
    if (!isMultiplayer() || !isLandscape() || !isVisible(game)) return false;
    const gate = document.getElementById('multiplayerScreenGate');
    if (gate && !gate.classList.contains('hidden')) return false;
    return true;
  }

  function fitBattle() {
    if (fitting) return;
    fitting = true;
    try {
      if (!shouldFit()) {
        clearFit();
        return;
      }

      // Measure the battle at its natural size first. scrollWidth/scrollHeight capture
      // overflow from the live rival grid, HOLD/NEXT panels, HUD, and action row.
      clearFit();
      const naturalRect = game.getBoundingClientRect();
      let naturalWidth = Math.ceil(Math.max(game.scrollWidth, naturalRect.width));
      let naturalHeight = Math.ceil(Math.max(game.scrollHeight, naturalRect.height));
      if (!naturalWidth || !naturalHeight) return;

      // Give the transformed element a box large enough to contain all overflowing
      // multiplayer columns before scaling it down. This prevents the right rival
      // board from being clipped off-screen.
      game.style.width = `${naturalWidth}px`;
      game.style.height = 'auto';
      naturalWidth = Math.ceil(Math.max(naturalWidth, game.scrollWidth));
      naturalHeight = Math.ceil(Math.max(naturalHeight, game.scrollHeight, game.getBoundingClientRect().height));

      const {width: vw, height: vh} = viewportSize();
      const safeX = 10;
      const safeY = 8;
      const availableWidth = Math.max(1, vw - safeX * 2);
      const availableHeight = Math.max(1, vh - safeY * 2);
      const scale = Math.min(1, availableWidth / naturalWidth, availableHeight / naturalHeight);

      document.body.classList.add('tb-battle-autofit');
      game.classList.add('tb-autofit-target');
      game.style.width = `${naturalWidth}px`;
      game.style.height = `${naturalHeight}px`;
      game.style.transform = `translate(-50%, -50%) scale(${Math.max(.2, scale).toFixed(4)})`;
    } finally {
      fitting = false;
    }
  }

  function scheduleFit() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => requestAnimationFrame(fitBattle));
  }

  window.addEventListener('resize', scheduleFit, {passive:true});
  window.addEventListener('orientationchange', () => {
    [0, 100, 250, 500, 900].forEach(delay => setTimeout(scheduleFit, delay));
  }, {passive:true});
  window.visualViewport?.addEventListener('resize', scheduleFit, {passive:true});
  try { window.screen?.orientation?.addEventListener?.('change', scheduleFit); } catch {}

  // Multiplayer scripts add/remove rival tiles dynamically, so refit whenever the
  // live stage changes size or the game/lobby visibility changes.
  new MutationObserver(scheduleFit).observe(game, {
    subtree:true,
    childList:true,
    attributes:true,
    attributeFilter:['class','style']
  });
  try { new ResizeObserver(scheduleFit).observe(game); } catch {}

  // Some legacy wrappers update the battle layout after short timers.
  // A light periodic check keeps iOS Safari/PWA viewport changes from leaving a stale fit.
  setInterval(scheduleFit, 700);
  scheduleFit();
})();
