// v46: deterministic Solo start without broad mutation loops.
// Start Solo -> READY? -> 3 -> 2 -> 1 -> GO! -> play. No Ready button.
(() => {
  const $ = id => document.getElementById(id);
  let starting = false;
  let countdownToken = 0;

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function soloType(){
    return localStorage.getItem('tb_solo_type') === 'marathon' ? 'marathon' : 'sprint';
  }

  function prepareSolo(){
    if (window.TBTutorialActive) return;
    try { gameMode = 'solo'; } catch {}
    try { localStorage.setItem('tb_mode','solo'); } catch {}
    document.querySelectorAll('.mode-card').forEach(card => {
      const should = card.dataset.mode === 'solo';
      if (card.classList.contains('active') !== should) card.classList.toggle('active', should);
    });
    const opts = $('soloOptions');
    if (opts?.classList.contains('hidden')) opts.classList.remove('hidden');
  }

  function addClass(el, cls){ if (el && !el.classList.contains(cls)) el.classList.add(cls); }
  function removeClass(el, cls){ if (el?.classList.contains(cls)) el.classList.remove(cls); }

  function normalizeSoloUI(){
    if (window.TBTutorialActive) return;
    const gameEl = $('game');
    if (!gameEl || gameMode !== 'solo') return;

    addClass(gameEl,'solo-live-mode');
    addClass(document.querySelector('.room-pill'),'hidden');
    addClass($('readyBtn'),'hidden');
    addClass($('readyPanel'),'hidden');
    addClass($('hostStartBtn'),'hidden');
    addClass($('startSoloGameBtn'),'hidden');
    addClass($('duelMonitor'),'hidden');
    addClass($('partyStandings'),'hidden');
    removeClass($('soloStatus'),'hidden');

    const grid = $('liveArenaGrid');
    if (grid) {
      addClass(grid,'solo');
      removeClass(grid,'duel');
      removeClass(grid,'party');
      grid.querySelectorAll('.remote-live-tile').forEach(x => x.remove());
    }

    if ($('roomCodeDisplay') && $('roomCodeDisplay').textContent !== 'SOLO') $('roomCodeDisplay').textContent = 'SOLO';
    const pillText = soloType() === 'marathon' ? 'SOLO MARATHON' : 'SOLO SPRINT 40L';
    if ($('modePill') && $('modePill').textContent !== pillText) $('modePill').textContent = pillText;
    const stateText = starting ? 'Get Ready' : ((typeof gameRunning !== 'undefined' && gameRunning) ? 'Playing' : 'Solo');
    if ($('playerState') && $('playerState').textContent !== stateText) $('playerState').textContent = stateText;
  }

  function openSoloBoard(){
    prepareSolo();
    try {
      if ($('game')?.classList.contains('hidden')) {
        const opened = openGame('SOLO');
        if (opened === false) return false;
      }
    } catch (err) {
      console.error('Solo open failed', err);
      return false;
    }
    try { window.TBMultiplayer?.disconnect?.(); } catch {}
    normalizeSoloUI();
    return true;
  }

  async function showCountdown(){
    const token = ++countdownToken;
    const ov = $('overlay');
    const title = $('overlayTitle');
    const text = $('overlayText');
    if (!ov || !title) return false;

    removeClass(ov,'hidden');
    title.textContent = 'READY?';
    if (text) text.textContent = soloType() === 'marathon' ? 'Survive all 15 levels.' : 'Clear 40 lines as fast as you can.';
    await wait(700);

    for (const n of ['3','2','1']) {
      if (token !== countdownToken) return false;
      title.textContent = n;
      if (text) text.textContent = '';
      await wait(1000);
    }

    if (token !== countdownToken) return false;
    title.textContent = 'GO!';
    if (text) text.textContent = '';
    await wait(450);
    return token === countdownToken;
  }

  async function beginSolo(){
    if (starting || window.TBTutorialActive) return;
    starting = true;
    prepareSolo();
    if (!openSoloBoard()) { starting = false; return; }

    // Keep gameplay stopped while the countdown is visible.
    try {
      if (typeof gameRunning !== 'undefined') gameRunning = false;
      if (typeof paused !== 'undefined') paused = false;
      if (typeof timerInterval !== 'undefined') clearInterval(timerInterval);
      if (typeof animationId !== 'undefined') cancelAnimationFrame(animationId);
    } catch {}
    normalizeSoloUI();

    const okay = await showCountdown();
    if (!okay) { starting = false; return; }

    try {
      startGame();
      addClass($('overlay'),'hidden');
      if ($('playerState')) $('playerState').textContent = 'Playing';
    } catch (err) {
      console.error('Solo start failed', err);
    } finally {
      starting = false;
      normalizeSoloUI();
    }
  }

  // Choice buttons visibly select Sprint/Marathon and never start by themselves.
  document.addEventListener('click', event => {
    const choice = event.target?.closest?.('.solo-choice[data-solo]');
    if (!choice) return;
    const type = choice.dataset.solo === 'marathon' ? 'marathon' : 'sprint';
    localStorage.setItem('tb_solo_type', type);
    document.querySelectorAll('.solo-choice').forEach(btn => btn.classList.toggle('active', btn === choice));
  }, true);

  // Own the Start Solo action so older handlers cannot add a second Ready/Start step.
  document.addEventListener('click', event => {
    const start = event.target?.closest?.('#startSoloBtn');
    if (!start) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    beginSolo();
  }, true);

  // Reassert the Solo-only UI only when the game itself changes visibility.
  const gameEl = $('game');
  if (gameEl) {
    new MutationObserver(() => {
      if (window.TBTutorialActive || gameMode !== 'solo' || gameEl.classList.contains('hidden')) return;
      normalizeSoloUI();
    }).observe(gameEl,{attributes:true,attributeFilter:['class','style']});
  }
})();