// v44: KO Blocks commercial-facing rebrand without changing legacy DOM IDs/game hooks.
(() => {
  const $ = id => document.getElementById(id);

  function setText(selector, text) {
    const el = document.querySelector(selector);
    if (el && el.textContent !== text) el.textContent = text;
  }

  function setCard(mode, title, sub) {
    const card = document.querySelector(`.mode-card[data-mode="${mode}"]`);
    if (!card) return;
    const strong = card.querySelector('strong');
    const small = card.querySelector('small');
    if (strong && strong.textContent !== title) strong.textContent = title;
    if (sub) {
      if (small) small.textContent = sub;
      else {
        const span = strong?.parentElement;
        if (span) {
          const s = document.createElement('small');
          s.textContent = sub;
          span.appendChild(s);
        }
      }
    }
  }

  function patchHero() {
    document.title = 'KO Blocks';
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content','KO Blocks');
    setText('.brand-mark','KO');
    setText('.brand .eyebrow','BLOCK ARCADE');
    setText('.brand h1','KO Blocks');

    const logo = document.querySelector('.block-logo');
    if (logo) {
      logo.setAttribute('aria-label','KO Blocks');
      logo.innerHTML = `
        <span class="logo-row logo-top ko-logo-top"><b>K</b><b>O</b></span>
        <span class="logo-row logo-bottom"><b>B</b><b>L</b><b>O</b><b>C</b><b>K</b><b>S</b></span>`;
    }
    const heroP = document.querySelector('#baseLandingHero > p');
    if (heroP) {
      heroP.innerHTML = '<strong>Block. Attack. Survive.</strong><br><span>Knock out your rivals.</span>';
    }
  }

  function patchModes() {
    setCard('duel','1v1 Battle','First to 5 KOs wins');
    setCard('party','Battle Arena','2 to 6 players · Multiplayer knockout battle');
    setCard('solo','Solo Challenge','Sprint or Marathon');

    const tutorial = $('tutorialModeCard');
    if (tutorial) {
      const strong = tutorial.querySelector('strong');
      const small = tutorial.querySelector('small');
      if (strong) strong.textContent = 'Tutorial';
      if (small) small.textContent = 'New to KO Blocks? Learn the controls and battle basics step by step.';
    }
  }

  function patchSetup() {
    const setup = $('modeSetupScreen');
    const mode = setup?.dataset.mode;
    if (!setup || !mode) return;
    const title = $('setupModeTitle');
    const sub = $('setupModeSub');
    if (mode === 'duel') {
      if (title) title.textContent = '1v1 Battle';
      if (sub) sub.textContent = 'Enter your player name, then find one rival.';
    } else if (mode === 'party') {
      if (title) title.textContent = 'Battle Arena';
      if (sub) sub.textContent = 'Create or join a private multiplayer battle room.';
    } else if (mode === 'solo') {
      if (title) title.textContent = 'Solo Challenge';
      if (sub) sub.textContent = 'Choose Sprint or Marathon and start immediately.';
    }
  }

  function patchTutorial() {
    setText('#tutorialIntroTitle','Learn KO Blocks');
    const introP = document.querySelector('#tutorialIntro .tutorial-intro-card > p');
    if (introP) introP.textContent = 'No timer pressure. Learn movement, rotation, drops, HOLD, line clears, attacks, KOs, and pause/resume one step at a time.';
    const quick = $('tutorialQuickControls');
    if (quick) {
      const labels = quick.querySelectorAll('b');
      const spans = quick.querySelectorAll('span');
      if (labels[0]) labels[0].textContent = 'Keyboard';
      if (spans[0]) spans[0].textContent = '← → Move · ↑ Rotate · ↓ Soft Drop · Space Hard Drop · C/H Hold · P Pause';
      if (labels[1]) labels[1].textContent = 'Touch';
      if (spans[1]) spans[1].textContent = 'Right-side arrow cluster: ◀ ▶ move · ▼ soft drop · ⟳ in the Up position rotates · long HARD DROP button acts like Space · tap the HOLD box to hold/swap.';
    }
  }

  function patchMisc() {
    const name = $('playerName');
    if (name && name.value.trim() === 'Player 1') name.value = '';
    if (name) name.placeholder = 'Enter your player name';
    setText('#duelQuickPanel .duel-panel-head strong','Find a 1v1 Rival');
    const duelSmall = document.querySelector('#duelQuickPanel .duel-panel-head small');
    if (duelSmall) duelSmall.textContent = 'No room code. We’ll match you with one opponent.';
    const fine = document.querySelector('.fineprint');
    if (fine) fine.textContent = '1v1 uses automatic matchmaking. Battle Arena is private and invite/code based for 2 to 6 players. Solo includes Sprint and Marathon.';
    const board = $('board');
    if (board) board.setAttribute('aria-label','KO Blocks game board');

    document.querySelectorAll('*').forEach(el => {
      if (el.children.length) return;
      const t = (el.textContent || '').trim();
      if (t === 'God of Tetris') el.textContent = 'KO Legend';
      else if (t === 'Tetris Battle Z') el.textContent = 'KO Blocks';
      else if (t === 'Tetris Battle') el.textContent = 'KO Blocks';
      else if (t === 'Solo Session') el.textContent = 'Solo Challenge';
      else if (t === 'Party Session') el.textContent = 'Battle Arena';
      else if (t === '2P Battle') el.textContent = '1v1 Battle';
    });
  }

  function patchAll() {
    patchHero();
    patchModes();
    patchSetup();
    patchTutorial();
    patchMisc();
  }

  const style = document.createElement('style');
  style.textContent = `
    .ko-logo-top{justify-content:center!important}
    #baseLandingHero>p strong{font-size:1.08em;color:#fff}
    #baseLandingHero>p span{opacity:.86;font-size:.88em}
    .brand-mark{min-width:34px;font-size:11px!important;letter-spacing:-.04em}
  `;
  document.head.appendChild(style);

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; patchAll(); });
  };
  new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','data-mode']});
  document.addEventListener('click',()=>setTimeout(schedule,0),true);
  patchAll();
})();
