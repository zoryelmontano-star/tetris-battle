// v19: landing chooser and mode setup are separate screens.
(() => {
  const $ = id => document.getElementById(id);
  const lobby = $('lobby');
  const modeGrid = lobby?.querySelector('.mode-grid');
  if (!lobby || !modeGrid || $('modeSetupScreen')) return;

  const setup = document.createElement('section');
  setup.id = 'modeSetupScreen';
  setup.className = 'hidden';
  setup.innerHTML = `
    <div class="setup-top">
      <div class="setup-mode-badge" id="setupModeBadge">◆</div>
      <div class="setup-heading"><strong id="setupModeTitle">Mode Setup</strong><small id="setupModeSub"></small></div>
      <button id="backToModesBtn" class="back-modes-btn" type="button">← Back to Modes</button>
    </div>
  `;
  modeGrid.insertAdjacentElement('afterend', setup);

  // Keep the chooser card clean. Sprint/Marathon choices belong on the Solo setup screen.
  const soloCard = modeGrid.querySelector('.mode-card[data-mode="solo"]');
  if (soloCard) {
    soloCard.innerHTML = `<span class="mode-icon">◆</span><span><strong>Solo Session</strong></span>`;
  }

  // Move all lower controls into the setup screen, preserving existing event listeners.
  const movable = [
    lobby.querySelector('.lobby-grid'),
    $('duelQuickPanel'),
    lobby.querySelector('.actions'),
    $('roomStatus'),
    $('recentRoomsPanel'),
    $('soloOptions'),
    lobby.querySelector('.fineprint')
  ].filter(Boolean);
  movable.forEach(node => setup.appendChild(node));

  const copy = {
    duel:{title:'2P Battle', sub:'Enter your player name, then find an opponent automatically.', badge:'⚔'},
    party:{title:'Party Session', sub:'Create a session or join friends using a Party room code.', badge:'✦'},
    solo:{title:'Solo Session', sub:'Choose Sprint 40 Lines or Marathon, then start playing.', badge:'◆'}
  };

  function paintSetup(mode){
    const c = copy[mode] || copy.duel;
    setup.dataset.mode = mode;
    $('setupModeTitle').textContent = c.title;
    $('setupModeSub').textContent = c.sub;
    $('setupModeBadge').textContent = c.badge;
  }

  function showChooser(updateHistory = true){
    lobby.classList.remove('setup-open');
    setup.classList.add('hidden');
    document.querySelectorAll('.mode-card').forEach(card => card.classList.remove('active'));
    if (updateHistory && location.hash) history.pushState({screen:'chooser'},'',location.pathname + location.search);
  }

  function showSetup(mode, updateHistory = true){
    if (!copy[mode]) return;
    if (window.TBLobby?.setMode) TBLobby.setMode(mode);
    else { gameMode = mode; localStorage.setItem('tb_mode',mode); }
    paintSetup(mode);
    lobby.classList.add('setup-open');
    setup.classList.remove('hidden');
    document.querySelectorAll('.mode-card').forEach(card => card.classList.toggle('active', card.dataset.mode === mode));
    if (updateHistory) history.pushState({screen:'setup',mode},'',`#${mode}`);
    setTimeout(() => {
      const focusTarget = mode === 'solo' ? setup.querySelector('.solo-choice') : $('playerName');
      focusTarget?.focus?.();
    }, 80);
  }

  // These listeners run after all legacy mode listeners so this screen flow wins visually.
  modeGrid.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => setTimeout(() => showSetup(card.dataset.mode), 130));
  });

  $('backToModesBtn').addEventListener('click', () => {
    if (history.state?.screen === 'setup') history.back();
    else showChooser(true);
  });

  window.addEventListener('popstate', () => {
    const mode = location.hash.replace('#','');
    if (copy[mode]) showSetup(mode, false);
    else showChooser(false);
  });

  // Returning from the game always goes back to the clean mode chooser.
  const previousQuit = quitGame;
  quitGame = function(){
    const result = previousQuit();
    setTimeout(() => showChooser(false), 20);
    return result;
  };

  // Always open on the clean chooser instead of exposing a remembered mode's controls.
  showChooser(false);
  window.TBModeFlow = { showChooser, showSetup };
})();
