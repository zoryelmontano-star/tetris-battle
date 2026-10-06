// v49: Battle Arena minimum 3 players + explicit post-round recap actions.
(() => {
  const $ = id => document.getElementById(id);
  const MIN_ARENA_PLAYERS = 3;
  let heldPartyDeadline = false;
  let soloResultKey = '';

  function activePartyRemotes(){
    if(!window.TBLiveGrid?.remotes) return [];
    const now = Date.now();
    return [...TBLiveGrid.remotes.entries()].filter(([,p]) => p?.mode === 'party' && now - Number(p?.seen || 0) < 7000);
  }

  function arenaPlayerCount(){
    return 1 + activePartyRemotes().length;
  }

  function arenaHasMinimum(){
    return arenaPlayerCount() >= MIN_ARENA_PLAYERS;
  }

  function updateArenaCopy(){
    const card = document.querySelector('.mode-card[data-mode="party"] small');
    if(card) card.textContent = '3 to 6 players · Multiplayer knockout battle';
    const fine = document.querySelector('.fineprint');
    if(fine) fine.textContent = '1v1 uses automatic matchmaking. Battle Arena is private and invite/code based for 3 to 6 players. Solo includes Sprint and Marathon.';
    if($('setupModeSub') && $('modeSetupScreen')?.dataset?.mode === 'party') {
      $('setupModeSub').textContent = 'Create or join a private battle room. Minimum 3 players, maximum 6.';
    }
  }

  function showArenaMinimumMessage(){
    const count = arenaPlayerCount();
    const msg = `Battle Arena needs at least ${MIN_ARENA_PLAYERS} players. ${count} connected now.`;
    if($('readyMessage')) $('readyMessage').textContent = msg;
    if($('roomStatus')) $('roomStatus').textContent = msg;
  }

  // Manual host start is blocked until the host + at least 2 guests are present.
  document.addEventListener('click', event => {
    const start = event.target?.closest?.('#hostStartBtn');
    if(!start || gameMode !== 'party' || arenaHasMinimum()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    showArenaMinimumMessage();
  }, true);

  // Keep the host's auto-start deadline parked while fewer than 3 total players are connected.
  // Once player 3 arrives, release it so the normal 60-second countdown can begin.
  setInterval(() => {
    if(gameMode !== 'party' || !window.TBReadyState?.isPartyHost || !window.TBMultiplayer?.room) return;
    const deadline = Number(window.TBReadyState?.partyDeadline || 0);
    if(!arenaHasMinimum()) {
      updateArenaCopy();
      showArenaMinimumMessage();
      if(deadline && deadline < Date.now() + 3600000 && !heldPartyDeadline) {
        heldPartyDeadline = true;
        window.TBMultiplayer.send?.('party_lobby_deadline', {deadline: Date.now() + 86400000, mode:'party'});
      }
      const hostStart = $('hostStartBtn');
      if(hostStart) hostStart.disabled = true;
      $('partyAutoStart')?.classList.add('hidden');
    } else {
      const hostStart = $('hostStartBtn');
      if(hostStart) hostStart.disabled = false;
      if(heldPartyDeadline) {
        heldPartyDeadline = false;
        window.TBMultiplayer.send?.('party_lobby_deadline', {deadline:0, mode:'party'});
      }
    }
  }, 800);

  // Last-line safety: an arena round itself cannot start under 3 total players.
  if(typeof startGame === 'function') {
    const priorStartGame = startGame;
    startGame = function(...args){
      if(gameMode === 'party' && !arenaHasMinimum()) {
        showArenaMinimumMessage();
        $('battlefieldCountdown')?.classList.add('hidden');
        try { window.TBMultiplayer?.send?.('round_reset', {mode:'party', reason:'minimum-3'}); } catch {}
        return false;
      }
      return priorStartGame.apply(this,args);
    };
  }

  function hideMainResultOverlay(){
    const ov = $('overlay');
    if(ov) ov.classList.add('hidden');
  }

  function quitFromResult(panel){
    panel?.classList.add('hidden');
    hideMainResultOverlay();
    try { quitGame(); } catch {}
  }

  function anotherDuelRound(panel){
    panel?.classList.add('hidden');
    hideMainResultOverlay();
    if(window.TBAIMode === true) {
      const start = $('startBtn');
      if(start) {
        start.classList.remove('hidden');
        start.click();
        start.classList.add('hidden');
      } else {
        try { startGame(); } catch {}
      }
      return;
    }
    const ready = $('readyBtn');
    if(ready && !ready.classList.contains('hidden')) {
      ready.click();
      if($('readyMessage')) $('readyMessage').textContent = 'Ready for another round. Waiting for your rival…';
    }
  }

  function configureDuelResult(panel){
    if(!panel || panel.dataset.actionsLocked === '1') return;
    const old = panel.querySelector('#duelResultContinue');
    if(!old) return;
    const another = old.cloneNode(true);
    another.id = 'duelResultAnother';
    another.textContent = 'START ANOTHER ROUND';
    old.replaceWith(another);
    const quit = document.createElement('button');
    quit.id = 'duelResultQuit';
    quit.type = 'button';
    quit.className = 'result-secondary-action';
    quit.textContent = 'QUIT GAME';
    another.insertAdjacentElement('afterend', quit);
    another.addEventListener('click', () => anotherDuelRound(panel));
    quit.addEventListener('click', () => quitFromResult(panel));
    panel.dataset.actionsLocked = '1';
  }

  function backToArenaLobby(panel){
    panel?.classList.add('hidden');
    hideMainResultOverlay();
    try { window.TBReadyState?.reset?.(); } catch {}
    $('readyPanel')?.classList.remove('hidden');
    $('hostStartBtn')?.classList.remove('hidden');
    if($('playerState')) $('playerState').textContent = 'Arena Lobby';
    if($('readyMessage')) $('readyMessage').textContent = arenaHasMinimum()
      ? 'Back in the arena lobby. Get ready for the next round.'
      : `Waiting for ${Math.max(0, MIN_ARENA_PLAYERS - arenaPlayerCount())} more player${MIN_ARENA_PLAYERS - arenaPlayerCount() === 1 ? '' : 's'}…`;
  }

  function configurePartyResult(panel){
    if(!panel || panel.dataset.actionsLocked === '1') return;
    const old = panel.querySelector('#partyResultClose');
    if(!old) return;
    const back = old.cloneNode(true);
    back.id = 'partyResultBackLobby';
    back.textContent = 'BACK TO ARENA LOBBY';
    old.replaceWith(back);
    const quit = document.createElement('button');
    quit.id = 'partyResultQuit';
    quit.type = 'button';
    quit.className = 'result-secondary-action';
    quit.textContent = 'QUIT GAME';
    back.insertAdjacentElement('afterend', quit);
    back.addEventListener('click', () => backToArenaLobby(panel));
    quit.addEventListener('click', () => quitFromResult(panel));
    panel.dataset.actionsLocked = '1';
  }

  function ensureSoloResult(){
    let panel = $('soloResultPanel');
    if(panel) return panel;
    panel = document.createElement('section');
    panel.id = 'soloResultPanel';
    panel.className = 'solo-result-panel hidden';
    panel.innerHTML = `
      <div class="solo-result-card">
        <p class="result-kicker">QUICK RECAP</p>
        <h2 id="soloResultTitle">RUN COMPLETE</h2>
        <p id="soloResultSummary"></p>
        <div class="solo-result-score"><span>SCORE</span><strong id="soloResultScore">0</strong></div>
        <button id="soloResultAnother" type="button">START ANOTHER ROUND</button>
        <button id="soloResultQuit" class="result-secondary-action" type="button">QUIT GAME</button>
      </div>`;
    document.body.appendChild(panel);
    $('soloResultAnother').addEventListener('click', () => {
      panel.classList.add('hidden');
      hideMainResultOverlay();
      const startSolo = $('startSoloBtn');
      if(startSolo) startSolo.click();
      else {
        try { startGame(); } catch {}
      }
    });
    $('soloResultQuit').addEventListener('click', () => quitFromResult(panel));
    return panel;
  }

  function showSoloResultIfNeeded(){
    if(gameMode !== 'solo') return;
    const title = String($('overlayTitle')?.textContent || '').trim();
    const upper = title.toUpperCase();
    const isResult = upper === 'TOP OUT' || upper.includes('SPRINT COMPLETE') || upper.includes('MARATHON COMPLETE');
    if(!isResult) return;
    const summary = String($('overlayText')?.textContent || '').trim();
    const key = `${upper}|${summary}|${Number(score||0)}`;
    if(key === soloResultKey) return;
    soloResultKey = key;
    const panel = ensureSoloResult();
    $('soloResultTitle').textContent = title;
    $('soloResultSummary').textContent = summary;
    $('soloResultScore').textContent = Number(score || 0).toLocaleString();
    panel.classList.remove('hidden');
  }

  // Existing duel/arena panels are appended directly to body, so this observer stays very small.
  new MutationObserver(mutations => {
    for(const m of mutations) {
      for(const node of m.addedNodes) {
        if(!(node instanceof HTMLElement)) continue;
        if(node.id === 'duelHighlightPanel') configureDuelResult(node);
        if(node.id === 'partyResultPanel') configurePartyResult(node);
      }
    }
  }).observe(document.body,{childList:true});

  const duelExisting = $('duelHighlightPanel');
  if(duelExisting) configureDuelResult(duelExisting);
  const partyExisting = $('partyResultPanel');
  if(partyExisting) configurePartyResult(partyExisting);

  const overlayTitle = $('overlayTitle');
  if(overlayTitle) new MutationObserver(showSoloResultIfNeeded).observe(overlayTitle,{childList:true,characterData:true,subtree:true});

  const style = document.createElement('style');
  style.textContent = `
    .duel-highlight-card .result-secondary-action,.party-result-card .result-secondary-action,.solo-result-card .result-secondary-action{background:linear-gradient(180deg,#3a355f,#272447)!important;border:1px solid #625d8c!important;color:#efeefe!important;box-shadow:0 4px 0 #17152f!important}
    .solo-result-panel{position:fixed;inset:0;z-index:14600;display:grid;place-items:center;padding:18px;background:rgba(7,8,28,.82);backdrop-filter:blur(8px)}
    .solo-result-panel.hidden{display:none!important}
    .solo-result-card{width:min(480px,94vw);padding:24px;border-radius:25px;text-align:center;background:linear-gradient(180deg,#352c78,#211d59 42%,#141536);border:2px solid #70e7ff;box-shadow:0 26px 75px rgba(0,0,0,.58)}
    .solo-result-card h2{margin:5px 0 9px;color:#fff07a;font-size:31px}.solo-result-card>p:not(.result-kicker){color:#c7c3e6;font-size:13px;line-height:1.5}.solo-result-score{margin:13px 0;padding:12px;border-radius:15px;background:#171742;border:1px solid #474397}.solo-result-score span{display:block;color:#9993c9;font-size:8px;font-weight:1000;letter-spacing:.13em}.solo-result-score strong{display:block;color:#72eeff;font-size:30px}.solo-result-card button{width:100%;margin-top:9px;padding:13px;border-radius:12px;background:linear-gradient(180deg,#61eaff,#3d8df0);border:1px solid #b7f8ff;color:#10275d;font-weight:1000;box-shadow:0 4px 0 #245ba8}
  `;
  document.head.appendChild(style);

  updateArenaCopy();
  document.addEventListener('click', event => {
    if(event.target?.closest?.('.mode-card[data-mode="party"],#backToModesBtn')) setTimeout(updateArenaCopy, 180);
  }, true);
})();
