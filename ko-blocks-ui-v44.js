// v46: lightweight KO Blocks rebrand. Avoids broad DOM scans/observers during gameplay.
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
    if (small && sub && small.textContent !== sub) small.textContent = sub;
  }

  function patchHero() {
    document.title = 'KO Blocks';
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content','KO Blocks');
    setText('.brand-mark','KO');
    setText('.brand .eyebrow','BLOCK ARCADE');
    setText('.brand h1','KO Blocks');

    const logo = document.querySelector('.block-logo');
    if (logo && logo.getAttribute('aria-label') !== 'KO Blocks') {
      logo.setAttribute('aria-label','KO Blocks');
      logo.innerHTML = `
        <span class="logo-row logo-top ko-logo-top"><b>K</b><b>O</b></span>
        <span class="logo-row logo-bottom"><b>B</b><b>L</b><b>O</b><b>C</b><b>K</b><b>S</b></span>`;
    }
    const heroP = document.querySelector('#baseLandingHero > p');
    if (heroP && !heroP.dataset.koPatched) {
      heroP.innerHTML = '<strong>Block. Attack. Survive.</strong><br><span>Knock out your rivals.</span>';
      heroP.dataset.koPatched = '1';
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
      const spans = quick.querySelectorAll('span');
      if (spans[0]) spans[0].textContent = '← → Move · ↑ Rotate · ↓ Soft Drop · Space Hard Drop · C/H Hold · P Pause';
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
    $('board')?.setAttribute('aria-label','KO Blocks game board');

    // Target only known legacy labels instead of scanning every DOM node on every mutation.
    document.querySelectorAll('.rank-name,.rank-title,#rankName,#rankTitle').forEach(el => {
      if ((el.textContent || '').trim() === 'God of Tetris') el.textContent = 'KO Legend';
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
  function schedulePatch() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      patchModes();
      patchSetup();
      patchTutorial();
      patchMisc();
    });
  }

  // Mode changes are user-driven, so patch only around those events instead of observing the whole app.
  document.addEventListener('click', event => {
    if (event.target?.closest?.('.mode-card,#backToModesBtn,#tutorialModeCard,#tutorialControlsBtn')) {
      setTimeout(schedulePatch, 0);
      setTimeout(schedulePatch, 180);
    }
  }, true);
  window.addEventListener('popstate', schedulePatch);
  window.addEventListener('hashchange', schedulePatch);

  patchAll();
})();
