// v45: deterministic Solo start. No Ready button; Start Solo -> READY? -> 3 -> 2 -> 1 -> GO! -> play.
(() => {
  const $ = id => document.getElementById(id);
  let starting = false;
  let countdownToken = 0;

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function soloType(){
    return localStorage.getItem('tb_solo_type') === 'marathon' ? 'marathon' : 'sprint';
  }

  function prepareSolo(){
    try { gameMode = 'solo'; } catch {}
    try { localStorage.setItem('tb_mode','solo'); } catch {}
    document.querySelectorAll('.mode-card').forEach(card => card.classList.toggle('active', card.dataset.mode === 'solo'));
    $('soloOptions')?.classList.remove('hidden');
  }

  function normalizeSoloUI(){
    const gameEl = $('game');
    if (!gameEl) return;
    gameEl.classList.add('solo-live-mode');
    document.querySelector('.room-pill')?.classList.add('hidden');
    $('readyBtn')?.classList.add('hidden');
    $('readyPanel')?.classList.add('hidden');
    $('hostStartBtn')?.classList.add('hidden');
    $('startSoloGameBtn')?.classList.add('hidden');
    $('duelMonitor')?.classList.add('hidden');
    $('partyStandings')?.classList.add('hidden');
    $('soloStatus')?.classList.remove('hidden');

    const grid = $('liveArenaGrid');
    if (grid) {
      grid.classList.add('solo');
      grid.classList.remove('duel','party');
      grid.querySelectorAll('.remote-live-tile').forEach(x => x.remove());
    }

    if ($('roomCodeDisplay')) $('roomCodeDisplay').textContent = 'SOLO';
    if ($('modePill')) $('modePill').textContent = soloType() === 'marathon' ? 'SOLO MARATHON' : 'SOLO SPRINT 40L';
    if ($('playerState')) $('playerState').textContent = starting ? 'Get Ready' : ((typeof gameRunning !== 'undefined' && gameRunning) ? 'Playing' : 'Solo');
  }

  function openSoloBoard(){
    prepareSolo();
    try {
      if ($('game')?.classList.contains('hidden')) openGame('SOLO');
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

    ov.classList.remove('hidden');
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
    if (starting) return;
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
      $('overlay')?.classList.add('hidden');
      if ($('playerState')) $('playerState').textContent = 'Playing';
    } catch (err) {
      console.error('Solo start failed', err);
    } finally {
      starting = false;
      normalizeSoloUI();
    }
  }

  // Choice buttons should always visibly select Sprint/Marathon.
  document.addEventListener('click', event => {
    const choice = event.target?.closest?.('.solo-choice[data-solo]');
    if (!choice) return;
    const type = choice.dataset.solo === 'marathon' ? 'marathon' : 'sprint';
    localStorage.setItem('tb_solo_type', type);
    document.querySelectorAll('.solo-choice').forEach(btn => btn.classList.toggle('active', btn === choice));
  }, true);

  // Own the Start Solo action so older listeners cannot leave the user stuck on setup.
  document.addEventListener('click', event => {
    const start = event.target?.closest?.('#startSoloBtn');
    if (!start) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    beginSolo();
  }, true);

  // Solo never exposes Ready controls, even if older multiplayer scripts repaint them.
  new MutationObserver(() => {
    if (typeof gameMode === 'undefined' || gameMode !== 'solo') return;
    normalizeSoloUI();
  }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
})();
