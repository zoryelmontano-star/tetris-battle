// v32: Beginner tutorial mode + mandatory player names before multiplayer battles.
(() => {
  const $ = id => document.getElementById(id);
  const nameInput = $('playerName');
  let tutorialActive = false;
  let tutorialStep = 0;
  let priorMode = 'duel';

  // ---------- Player name requirement ----------
  if (nameInput) {
    if ((nameInput.value || '').trim() === 'Player 1') nameInput.value = '';
    nameInput.required = true;
    nameInput.autocomplete = 'nickname';
    nameInput.placeholder = 'Enter your player name';
  }

  function cleanName() {
    return String(nameInput?.value || '').trim().replace(/\s+/g, ' ').slice(0, 16);
  }

  function clearNameError() {
    if (!nameInput) return;
    nameInput.classList.remove('player-name-error');
    nameInput.removeAttribute('aria-invalid');
    const existing = $('playerNameError');
    if (existing) existing.remove();
  }

  function requirePlayerName() {
    const name = cleanName();
    if (name) {
      if (nameInput && nameInput.value !== name) nameInput.value = name;
      clearNameError();
      return true;
    }
    if (!nameInput) return false;
    clearNameError();
    nameInput.classList.add('player-name-error');
    nameInput.setAttribute('aria-invalid', 'true');
    const error = document.createElement('div');
    error.id = 'playerNameError';
    error.className = 'player-name-error-text';
    error.textContent = 'Enter your player name before joining a battle.';
    nameInput.insertAdjacentElement('afterend', error);
    const status = $('roomStatus');
    if (status) status.textContent = 'Player name is required before you can join a battle.';
    nameInput.focus();
    try { nameInput.scrollIntoView({behavior:'smooth', block:'center'}); } catch {}
    return false;
  }

  nameInput?.addEventListener('input', () => {
    if (cleanName()) clearNameError();
  });

  // Block every known multiplayer entry point before legacy handlers can run.
  document.addEventListener('click', event => {
    const trigger = event.target?.closest?.('#find2PBtn,#createRoomBtn,#joinRoomBtn,#battleAIBtn,#readyBtn');
    if (!trigger || tutorialActive || gameMode === 'solo') return;
    if (!requirePlayerName()) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }, true);

  // Last-line defense for any path that tries to open a multiplayer game directly.
  if (typeof openGame === 'function') {
    const priorOpenGame = openGame;
    openGame = function(code) {
      if (!tutorialActive && gameMode !== 'solo' && !requirePlayerName()) return false;
      return priorOpenGame(code);
    };
  }

  // ---------- Tutorial mode ----------
  const modeGrid = document.querySelector('#lobby .mode-grid');
  if (modeGrid && !$('tutorialModeCard')) {
    const card = document.createElement('button');
    card.id = 'tutorialModeCard';
    card.className = 'mode-card tutorial-mode-card';
    card.type = 'button';
    card.innerHTML = `
      <span class="mode-icon">★</span>
      <span><strong>Tutorial Mode</strong><small>New to Tetris? Learn the controls and battle basics step by step.</small></span>`;
    modeGrid.appendChild(card);
    card.addEventListener('click', openTutorialIntro);
  }

  const intro = document.createElement('div');
  intro.id = 'tutorialIntro';
  intro.className = 'tutorial-intro hidden';
  intro.innerHTML = `
    <div class="tutorial-intro-card" role="dialog" aria-modal="true" aria-labelledby="tutorialIntroTitle">
      <button id="tutorialIntroClose" class="tutorial-close" type="button" aria-label="Close tutorial">×</button>
      <div class="tutorial-kicker">BEGINNER TRAINING</div>
      <h2 id="tutorialIntroTitle">Learn Tetris Battle Z</h2>
      <p>No timer pressure. We’ll teach you one move at a time, then explain HOLD, line clears, garbage attacks, KOs, and pause/resume.</p>
      <div class="tutorial-roadmap">
        <span>1<br><b>MOVE</b></span><span>2<br><b>ROTATE</b></span><span>3<br><b>DROP</b></span><span>4<br><b>HOLD</b></span><span>5<br><b>BATTLE</b></span>
      </div>
      <div class="tutorial-intro-actions">
        <button id="startTutorialBtn" class="primary" type="button">Start Tutorial</button>
        <button id="tutorialControlsBtn" type="button">Quick Controls</button>
      </div>
      <div id="tutorialQuickControls" class="tutorial-quick-controls hidden">
        <b>Keyboard</b><span>← → Move · ↑ Rotate · ↓ Soft Drop · Space Hard Drop · C/H Hold · P Pause</span>
        <b>Touch</b><span>Use the on-screen arrows, rotate, drop, HOLD, and Pause buttons.</span>
      </div>
    </div>`;
  document.body.appendChild(intro);

  const coach = document.createElement('div');
  coach.id = 'tutorialCoach';
  coach.className = 'tutorial-coach hidden';
  coach.innerHTML = `
    <div class="tutorial-coach-card">
      <div class="tutorial-coach-top"><span id="tutorialStepLabel">STEP 1 OF 7</span><button id="exitTutorialBtn" type="button">Exit Tutorial</button></div>
      <h3 id="tutorialCoachTitle">Move your piece</h3>
      <p id="tutorialCoachText">Use ← or → to move. On touch, tap the left or right arrow.</p>
      <div class="tutorial-progress"><i id="tutorialProgressBar"></i></div>
      <button id="tutorialNextBtn" class="hidden" type="button">Next</button>
    </div>`;
  document.body.appendChild(coach);

  const steps = [
    {key:'move', title:'Move your piece', text:'Use ← or → to move. On touch, tap the left or right arrow.'},
    {key:'rotate', title:'Rotate', text:'Press ↑ or tap the rotate button. Rotate pieces to fit the space you need.'},
    {key:'soft', title:'Soft Drop', text:'Hold ↓ or tap the down button to bring the piece down faster while keeping control.'},
    {key:'hard', title:'Hard Drop', text:'Press Space or HARD DROP to instantly lock the piece into its landing position.'},
    {key:'hold', title:'Use HOLD', text:'Press C/H or tap HOLD / SWAP. You can save one piece and swap it back later.'},
    {key:'pause', title:'Pause safely', text:'Press P or tap Pause. Your exact board and progress should freeze. Resume to continue from the same spot.'},
    {key:'mechanics', title:'Battle basics', text:'Clear lines to send garbage in battles. Fill an opponent to the top to score a KO. In 1v1, the first player to 5 KOs wins.', manual:true}
  ];

  function openTutorialIntro() {
    intro.classList.remove('hidden');
    $('tutorialQuickControls')?.classList.add('hidden');
  }

  function closeTutorialIntro() {
    intro.classList.add('hidden');
  }

  function renderTutorialStep() {
    const s = steps[tutorialStep];
    if (!s) return finishTutorial();
    $('tutorialStepLabel').textContent = `STEP ${tutorialStep + 1} OF ${steps.length}`;
    $('tutorialCoachTitle').textContent = s.title;
    $('tutorialCoachText').textContent = s.text;
    $('tutorialProgressBar').style.width = `${((tutorialStep + 1) / steps.length) * 100}%`;
    const next = $('tutorialNextBtn');
    next.classList.toggle('hidden', !s.manual);
    next.textContent = tutorialStep === steps.length - 1 ? 'Finish Tutorial' : 'Next';
  }

  function markAction(action) {
    if (!tutorialActive) return;
    const s = steps[tutorialStep];
    if (!s || s.manual || s.key !== action) return;
    if (action === 'pause') {
      // The shared pause screen may temporarily cover the coach. Advance now so the next lesson is ready after resume.
      tutorialStep++;
      renderTutorialStep();
      return;
    }
    tutorialStep++;
    renderTutorialStep();
  }

  function startTutorial() {
    closeTutorialIntro();
    priorMode = gameMode || localStorage.getItem('tb_mode') || 'duel';
    tutorialActive = true;
    tutorialStep = 0;
    window.TBTutorialActive = true;
    document.body.classList.add('tutorial-active');

    // Reuse Solo's untimed board engine, but hide Solo goals and replace them with guided lessons.
    gameMode = 'solo';
    try { openGame('TUTORIAL'); } catch (err) { console.error('Tutorial open failed', err); return; }
    setTimeout(() => {
      $('modePill') && ($('modePill').textContent = 'BEGINNER TUTORIAL');
      $('roomCodeDisplay') && ($('roomCodeDisplay').textContent = 'TRAINING');
      $('soloStatus')?.classList.add('tutorial-hidden');
      $('rankCard')?.classList.add('tutorial-hidden');
      $('readyPanel')?.classList.add('tutorial-hidden');
      $('readyBtn')?.classList.add('tutorial-hidden');
      coach.classList.remove('hidden');
      try { startGame(); } catch (err) { console.error('Tutorial start failed', err); }
      renderTutorialStep();
    }, 80);
  }

  function finishTutorial() {
    $('tutorialStepLabel').textContent = 'TRAINING COMPLETE';
    $('tutorialCoachTitle').textContent = 'You’re ready to battle!';
    $('tutorialCoachText').textContent = 'You learned movement, rotation, drops, HOLD, pause/resume, line clears, garbage, and KOs. Practice freely or return to the arcade.';
    $('tutorialProgressBar').style.width = '100%';
    const next = $('tutorialNextBtn');
    next.classList.remove('hidden');
    next.textContent = 'Practice Freely';
    next.dataset.complete = 'true';
    if (!$('tutorialBackBtn')) {
      const back = document.createElement('button');
      back.id = 'tutorialBackBtn';
      back.type = 'button';
      back.textContent = 'Back to Modes';
      next.insertAdjacentElement('afterend', back);
      back.addEventListener('click', exitTutorial);
    }
  }

  function exitTutorial() {
    coach.classList.add('hidden');
    $('tutorialBackBtn')?.remove();
    const next = $('tutorialNextBtn');
    if (next) { next.dataset.complete = ''; next.classList.add('hidden'); }
    tutorialActive = false;
    window.TBTutorialActive = false;
    document.body.classList.remove('tutorial-active');
    try {
      if (gameRunning) {
        gameRunning = false;
        clearInterval(timerInterval);
        cancelAnimationFrame(animationId);
        if (typeof stopMusic === 'function') stopMusic();
      }
    } catch {}
    gameMode = priorMode || localStorage.getItem('tb_mode') || 'duel';
    try { quitGame(); } catch {
      $('game')?.classList.add('hidden');
      $('lobby')?.classList.remove('hidden');
    }
    setTimeout(() => window.TBModeFlow?.showChooser?.(false), 20);
  }

  $('tutorialIntroClose')?.addEventListener('click', closeTutorialIntro);
  $('startTutorialBtn')?.addEventListener('click', startTutorial);
  $('tutorialControlsBtn')?.addEventListener('click', () => $('tutorialQuickControls')?.classList.toggle('hidden'));
  $('exitTutorialBtn')?.addEventListener('click', exitTutorial);
  $('tutorialNextBtn')?.addEventListener('click', () => {
    const btn = $('tutorialNextBtn');
    if (btn?.dataset.complete === 'true') {
      btn.classList.add('hidden');
      coach.classList.add('hidden');
      return;
    }
    tutorialStep++;
    if (tutorialStep >= steps.length) finishTutorial();
    else renderTutorialStep();
  });

  document.addEventListener('keydown', event => {
    if (!tutorialActive) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') markAction('move');
    else if (event.key === 'ArrowUp') markAction('rotate');
    else if (event.key === 'ArrowDown') markAction('soft');
    else if (event.code === 'Space') markAction('hard');
    else if (['c','C','h','H'].includes(event.key)) markAction('hold');
    else if (event.key === 'p' || event.key === 'P') markAction('pause');
  }, true);

  document.addEventListener('pointerdown', event => {
    if (!tutorialActive) return;
    const action = event.target?.closest?.('[data-action]')?.dataset?.action;
    if (action === 'left' || action === 'right') markAction('move');
    if (action === 'rotate') markAction('rotate');
    if (action === 'down') markAction('soft');
    if (action === 'drop') markAction('hard');
    if (event.target?.closest?.('#holdBtn')) markAction('hold');
    if (event.target?.closest?.('#pauseBtn')) markAction('pause');
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    #playerName.player-name-error{border-color:#ff657e!important;box-shadow:0 0 0 3px rgba(255,71,105,.18)!important;animation:tb-name-shake .22s linear 2}
    .player-name-error-text{margin-top:6px;color:#ff91a3;font-size:11px;font-weight:900}
    @keyframes tb-name-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
    #lobby .tutorial-mode-card{background:linear-gradient(180deg,#247eb0,#194f83)!important;border-color:#58d9ff!important;box-shadow:inset 0 2px 0 rgba(255,255,255,.14),0 12px 28px rgba(0,0,0,.25)!important}
    #lobby .tutorial-mode-card .mode-icon{background:linear-gradient(145deg,#70edff,#5f84ff)!important;color:#071738!important}
    .tutorial-intro{position:fixed;inset:0;z-index:15000;display:grid;place-items:center;padding:18px;background:rgba(5,7,20,.82);backdrop-filter:blur(10px)}
    .tutorial-intro.hidden,.tutorial-coach.hidden,.tutorial-quick-controls.hidden,.tutorial-hidden{display:none!important}
    .tutorial-intro-card{position:relative;width:min(92vw,620px);padding:30px 26px 25px;border-radius:27px;background:linear-gradient(160deg,#252365,#15173d 55%,#0d112d);border:2px solid #5bdfff;box-shadow:0 30px 80px rgba(0,0,0,.62),0 0 42px rgba(72,212,255,.2);text-align:center}
    .tutorial-close{position:absolute;right:14px;top:12px;width:37px;height:37px;padding:0;border-radius:50%;font-size:24px;background:#151936;color:#d9f7ff}
    .tutorial-kicker{color:#69e8ff;font-size:10px;font-weight:1000;letter-spacing:.18em}.tutorial-intro h2{margin:7px 0 8px;font-size:30px;color:#fff}.tutorial-intro p{margin:0 auto;max-width:500px;color:#c8cae8;font-size:13px;line-height:1.6}
    .tutorial-roadmap{display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin:20px 0}.tutorial-roadmap span{padding:11px 4px;border-radius:13px;background:#101435;border:1px solid #3d4d88;color:#7fe9ff;font-size:15px;font-weight:1000}.tutorial-roadmap b{font-size:8px;color:#e7ecff;letter-spacing:.06em}
    .tutorial-intro-actions{display:flex;gap:9px}.tutorial-intro-actions button{flex:1;min-height:48px}.tutorial-quick-controls{display:grid;grid-template-columns:auto 1fr;gap:8px 12px;margin-top:16px;padding:13px;border-radius:14px;text-align:left;background:#0c102a;border:1px solid #313d76;font-size:10px}.tutorial-quick-controls b{color:#70e9ff}.tutorial-quick-controls span{color:#c6cbe3;line-height:1.45}
    .tutorial-coach{position:fixed;z-index:12000;left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(92vw,620px);pointer-events:none}
    .tutorial-coach-card{padding:16px 17px 15px;border-radius:19px;background:linear-gradient(160deg,rgba(28,31,87,.97),rgba(13,15,48,.98));border:2px solid #55dcff;box-shadow:0 20px 50px rgba(0,0,0,.5),0 0 28px rgba(67,209,255,.18);pointer-events:auto}
    .tutorial-coach-top{display:flex;justify-content:space-between;align-items:center;gap:10px}.tutorial-coach-top span{color:#64e3ff;font-size:9px;font-weight:1000;letter-spacing:.13em}.tutorial-coach-top button{padding:6px 9px;font-size:9px;border-radius:9px}.tutorial-coach h3{margin:8px 0 5px;color:#fff6ac;font-size:19px}.tutorial-coach p{margin:0;color:#d8dcf1;font-size:12px;line-height:1.48}.tutorial-progress{height:6px;margin-top:12px;border-radius:99px;overflow:hidden;background:#090c23}.tutorial-progress i{display:block;height:100%;width:0;background:linear-gradient(90deg,#4ce6ff,#8876ff,#ff66b9);transition:width .2s ease}.tutorial-coach-card>#tutorialNextBtn,.tutorial-coach-card>#tutorialBackBtn{width:100%;margin-top:9px;min-height:39px}
    body.tutorial-active #game .room-pill{display:none!important}
    @media(max-width:600px){.tutorial-intro-card{padding:26px 15px 19px}.tutorial-roadmap{gap:4px}.tutorial-roadmap span{font-size:12px;padding:9px 2px}.tutorial-intro-actions{flex-direction:column}.tutorial-coach{bottom:8px}.tutorial-coach-card{padding:13px}.tutorial-coach h3{font-size:16px}}
  `;
  document.head.appendChild(style);

  window.TBTutorial = {
    get active(){ return tutorialActive; },
    start:startTutorial,
    exit:exitTutorial,
    requirePlayerName
  };
})();
