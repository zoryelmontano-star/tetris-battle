// v27: Party battle royale, KO/respawn, per-round lines sent, session wins, defending champion, and board results.
(() => {
  const $ = id => document.getElementById(id);
  const priorClearLines = clearLines;
  const priorStartGame = startGame;
  const priorEndGame = endGame;
  const priorOpenGame = openGame;

  const stats = new Map();
  const sessionWinsById = new Map();
  const remoteSent = new Map();
  let localLinesSent = 0;
  let localKOs = 0;
  let localDeaths = 0;
  let lastAttackerId = '';
  let lastAttackerName = '';
  let lastAttackAt = 0;
  let respawning = false;
  let resultBusy = false;
  let handledResultToken = '';
  let defendingChampionId = '';
  let previousChampionId = '';
  let targetCursor = 0;
  let lastDuelResult = '';

  const localId = () => String(window.TBMultiplayer?.playerId || 'local');
  const localName = () => (($('playerName')?.value || 'Player').trim().slice(0,16) || 'Player');
  const rankNow = () => {
    try { return window.getTetrisRank?.() || {rank:1,title:'Newbie',stars:0,goal:5}; }
    catch { return {rank:1,title:'Newbie',stars:0,goal:5}; }
  };

  function activeRemoteEntries(mode = gameMode){
    if(!window.TBLiveGrid?.remotes) return [];
    const now = Date.now();
    return [...TBLiveGrid.remotes.entries()].filter(([,p]) => p.mode === mode && now - Number(p.seen || 0) < 7000);
  }
  function leaderId(){ return [localId(), ...activeRemoteEntries().map(([id])=>String(id))].sort()[0] || localId(); }

  function ensureStat(id, patch = {}){
    id = String(id || '');
    if(!id) return null;
    const base = stats.get(id) || {id,name:'Player',rank:1,rankTitle:'Newbie',kos:0,deaths:0,linesSent:0,score:0};
    const next = {...base, ...patch, id};
    stats.set(id,next);
    return next;
  }

  function localStat(){
    const r = rankNow();
    return ensureStat(localId(), {
      name:localName(), rank:Number(r.rank||1), rankTitle:String(r.title||'Newbie'),
      kos:localKOs, deaths:localDeaths, linesSent:localLinesSent, score:Number(score||0)
    });
  }

  function resetRoundStats(){
    stats.clear(); remoteSent.clear();
    localLinesSent=0; localKOs=0; localDeaths=0; lastAttackerId=''; lastAttackerName=''; lastAttackAt=0;
    respawning=false; resultBusy=false; handledResultToken=''; targetCursor=0;
    localStat();
    clearBoardResults();
    $('partyResultPanel')?.classList.add('hidden');
    if(gameMode==='party'){ attack=0; updateHud?.(); }
  }

  function choosePartyTarget(){
    const ids = activeRemoteEntries('party').map(([id])=>String(id));
    if(!ids.length) return '';
    const target = ids[targetCursor % ids.length];
    targetCursor = (targetCursor + 1) % Math.max(1, ids.length);
    return target;
  }

  function addGarbageToLocal(lines){
    let overflow=false;
    for(let n=0;n<lines;n++){
      if(board[0]?.some(Boolean)) overflow=true;
      board.shift();
      const hole=Math.floor(Math.random()*COLS);
      board.push(Array.from({length:COLS},(_,x)=>x===hole?'':'G'));
    }
    COLORS.G = COLORS.G || '#777177';
    draw?.();
    return overflow;
  }

  function sendPartyGarbage(cleared){
    const n=Math.max(0,Number(cleared)||0);
    if(!n || gameMode!=='party' || !gameRunning || !window.TBMultiplayer?.room) return;
    const targetId=choosePartyTarget();
    if(!targetId) return;
    // Every cleared line sends one garbage line. No random/hidden garbage.
    const lines=n;
    localLinesSent += lines;
    attack = localLinesSent;
    localStat();
    updateHud?.();
    window.TBSfx?.garbageSend?.(lines);
    TBMultiplayer.send('party_garbage', {
      targetId, lines, fromName:localName(), totalSent:localLinesSent,
      rank:Number(rankNow().rank||1), rankTitle:String(rankNow().title||'Newbie')
    });
  }

  function recoverPartyBoard(){
    board=createBoard(); current=null; resetQueue(); spawn(); draw(); lastTime=performance.now();
    respawning=false;
    const ov=$('overlay');
    if(ov && $('overlayTitle')?.textContent==='K.O.!') ov.classList.add('hidden');
  }

  function partySelfKO(){
    if(gameMode!=='party' || !gameRunning || respawning) return;
    respawning=true;
    localDeaths++;
    const attackerFresh = lastAttackerId && Date.now()-lastAttackAt < 6500;
    const attackerId = attackerFresh ? lastAttackerId : '';
    const attackerName = attackerFresh ? lastAttackerName : '';
    ensureStat(localId(),{...localStat(),deaths:localDeaths});
    if(attackerId) ensureStat(attackerId,{...(stats.get(attackerId)||{}),name:attackerName||stats.get(attackerId)?.name||'Player'});
    window.TBSfx?.selfKO?.();
    $('overlayTitle').textContent='K.O.!';
    $('overlayText').textContent=attackerName ? `${attackerName} knocked you out. Respawning…` : 'Knocked out. Respawning…';
    overlay.classList.remove('hidden');
    TBMultiplayer?.send?.('party_ko', {victimId:localId(),victimName:localName(),attackerId,attackerName});
    setTimeout(recoverPartyBoard,900);
  }

  // Freeze controls only during the short local respawn, without pausing the shared clock.
  const priorMove=move, priorSoftDrop=softDrop, priorHardDrop=hardDrop, priorRotate=rotate;
  move=function(...a){ if(respawning)return; return priorMove(...a); };
  softDrop=function(...a){ if(respawning)return; return priorSoftDrop(...a); };
  hardDrop=function(...a){ if(respawning)return; return priorHardDrop(...a); };
  rotate=function(...a){ if(respawning)return; return priorRotate(...a); };

  clearLines=function(){
    const cleared = Array.isArray(board) ? board.reduce((n,row)=>n+(row.every(Boolean)?1:0),0) : 0;
    const out = priorClearLines();
    if(gameMode==='party' && cleared>0) sendPartyGarbage(cleared);
    return out;
  };

  startGame=function(){
    if(gameMode==='party') resetRoundStats();
    const out=priorStartGame();
    if(gameMode==='party'){
      const card=document.querySelector('.mode-card[data-mode="party"] small');
      if(card) card.textContent='2–6 players · garbage + KOs · 2-minute battle royale';
    }
    return out;
  };

  openGame=function(code){
    const out=priorOpenGame(code);
    if(gameMode==='party') resetRoundStats();
    return out;
  };

  function finishPartyRound(){
    if(resultBusy) return;
    resultBusy=true;
    // Let the existing engine/ready system do its normal cleanup first.
    priorEndGame('time');
    $('overlayTitle').textContent='CALCULATING RESULTS';
    $('overlayText').textContent='Counting KOs, lines sent, and score…';
    overlay.classList.remove('hidden');
    const me=localStat();
    TBMultiplayer?.send?.('party_final_stats', me);
    ensureStat(localId(),me);
    if(localId()===leaderId()) setTimeout(computeAndBroadcastResult,520);
    setTimeout(()=>{ if(!handledResultToken) computeAndShowFallback(); },1800);
  }

  endGame=function(reason){
    if(gameMode==='party' && gameRunning){
      if(reason==='lose'){ partySelfKO(); return; }
      if(reason==='time'){ finishPartyRound(); return; }
    }
    return priorEndGame(reason);
  };

  function sortedLeaderboard(){
    const ids=[localId(),...activeRemoteEntries('party').map(([id])=>String(id))];
    const unique=[...new Set(ids)];
    unique.forEach(id=>{ if(!stats.has(id)) ensureStat(id,{name:id===localId()?localName():'Player'}); });
    return unique.map(id=>stats.get(id)).sort((a,b)=>(b.kos-a.kos)||(b.linesSent-a.linesSent)||(b.score-a.score)||(a.deaths-b.deaths)||String(a.name).localeCompare(String(b.name)));
  }

  function computeAndBroadcastResult(){
    if(gameMode!=='party') return;
    const board=sortedLeaderboard();
    if(!board.length) return;
    const winner=board[0];
    const token=`result-${roomNowSafe()}-${Date.now()}`;
    const prev=defendingChampionId;
    TBMultiplayer?.send?.('party_round_result',{token,winnerId:winner.id,previousChampionId:prev,leaderboard:board});
    applyPartyResult({token,winnerId:winner.id,previousChampionId:prev,leaderboard:board});
  }
  function roomNowSafe(){ return String(window.TBMultiplayer?.room||'party'); }
  function computeAndShowFallback(){
    const board=sortedLeaderboard(); if(!board.length)return;
    applyPartyResult({token:`fallback-${Date.now()}`,winnerId:board[0].id,previousChampionId:defendingChampionId,leaderboard:board});
  }

  function clearBoardResults(){
    document.querySelectorAll('.board-result-overlay').forEach(el=>el.remove());
  }
  function showTileResult(tile,text,win=false){
    if(!tile)return;
    const shell=tile.querySelector('.board-shell,.remote-board-shell'); if(!shell)return;
    shell.querySelector('.board-result-overlay')?.remove();
    const el=document.createElement('div');
    el.className=`board-result-overlay ${win?'win':'lose'}`;
    el.innerHTML=`<strong>${text}</strong><span>${win?'CHAMPION':'ROUND OVER'}</span>`;
    shell.appendChild(el);
  }

  function showAllBoardResults(winnerId){
    showTileResult($('localLiveTile'), winnerId===localId()?'YOU WIN':'YOU LOSE', winnerId===localId());
    activeRemoteEntries('party').forEach(([id])=>showTileResult($(`live-${id}`), String(id)===String(winnerId)?'YOU WIN':'YOU LOSE', String(id)===String(winnerId)));
  }

  function ensureResultPanel(){
    let panel=$('partyResultPanel'); if(panel)return panel;
    panel=document.createElement('section'); panel.id='partyResultPanel'; panel.className='party-result-panel hidden';
    panel.innerHTML='<div class="party-result-card"><div class="result-crown">♛</div><p class="result-kicker">ROUND RESULTS</p><h2 id="partyResultTitle">SESSION STANDINGS</h2><div id="partyWinnerSummary"></div><div id="partyLeaderboard" class="party-leaderboard"></div><button id="partyResultClose" type="button">READY FOR NEXT ROUND</button></div>';
    document.body.appendChild(panel);
    $('partyResultClose').addEventListener('click',()=>panel.classList.add('hidden'));
    return panel;
  }

  function applyPartyResult(p){
    if(!p?.token || handledResultToken===p.token) return;
    handledResultToken=p.token;
    const board=Array.isArray(p.leaderboard)?p.leaderboard:[];
    board.forEach(s=>ensureStat(s.id,s));
    const winner=board.find(x=>String(x.id)===String(p.winnerId)) || board[0];
    if(!winner)return;
    previousChampionId=p.previousChampionId||defendingChampionId||'';
    defendingChampionId=String(winner.id);
    sessionWinsById.set(defendingChampionId,(sessionWinsById.get(defendingChampionId)||0)+1);
    if(defendingChampionId===localId()) sessionWins=sessionWinsById.get(defendingChampionId)||0;
    updateHud?.();
    showAllBoardResults(defendingChampionId);
    const won=defendingChampionId===localId();
    $('overlayTitle').textContent=won?'YOU WIN':'YOU LOSE';
    $('overlayText').textContent=`Winner: ${winner.name} · ${winner.kos} KO · ${winner.linesSent} lines sent`;
    overlay.classList.remove('hidden');
    if(won){ window.TBEffects?.confetti?.(); window.TBSfx?.partyWin?.(); }
    else window.TBSfx?.partyLose?.();

    const panel=ensureResultPanel(); panel.classList.remove('hidden');
    const defended=previousChampionId && previousChampionId===defendingChampionId;
    $('partyWinnerSummary').innerHTML=`<div class="winner-name">${escapeHtml(winner.name)}</div><div class="winner-rank">RANK ${Number(winner.rank||1)} · ${escapeHtml(String(winner.rankTitle||'Newbie').toUpperCase())}</div><div class="winner-badges"><span>🏆 ${sessionWinsById.get(defendingChampionId)||1} SESSION WIN${(sessionWinsById.get(defendingChampionId)||1)===1?'':'S'}</span><span>♛ ${defended?'DEFENDING CHAMPION RETAINED':'NEW DEFENDING CHAMPION'}</span></div>`;
    $('partyLeaderboard').innerHTML=board.map((s,i)=>`<div class="party-result-row ${String(s.id)===defendingChampionId?'champion-row':''}"><b>#${i+1}</b><span>${escapeHtml(s.name)}<small>RANK ${Number(s.rank||1)} · ${escapeHtml(String(s.rankTitle||'Newbie').toUpperCase())}</small></span><strong>${sessionWinsById.get(String(s.id))||0}W</strong><em>${Number(s.kos||0)} KO</em><em>${Number(s.linesSent||0)} SENT</em></div>`).join('');
    renderChampionChips();
  }

  function escapeHtml(v){ const d=document.createElement('div'); d.textContent=String(v||''); return d.innerHTML; }

  if(window.TBMultiplayer){
    TBMultiplayer.onMessage(msg=>{
      const p=msg.payload||{};
      if(msg.type==='party_garbage' && gameMode==='party'){
        const sender=ensureStat(msg.playerId,{name:p.fromName||'Player',rank:Number(p.rank||1),rankTitle:p.rankTitle||'Newbie',linesSent:Number(p.totalSent||0)});
        remoteSent.set(String(msg.playerId),Number(p.totalSent||0));
        if(String(p.targetId)!==localId() || !gameRunning) return;
        lastAttackerId=String(msg.playerId||''); lastAttackerName=p.fromName||sender?.name||'Player'; lastAttackAt=Date.now();
        const overflow=addGarbageToLocal(Math.max(0,Number(p.lines)||0));
        if(overflow) partySelfKO();
      }
      if(msg.type==='party_ko' && gameMode==='party'){
        const victimId=String(p.victimId||''); const attackerId=String(p.attackerId||'');
        if(victimId){ const s=ensureStat(victimId,{name:p.victimName||stats.get(victimId)?.name||'Player'}); s.deaths=(s.deaths||0)+1; }
        if(attackerId){
          const s=ensureStat(attackerId,{name:p.attackerName||stats.get(attackerId)?.name||'Player'}); s.kos=(s.kos||0)+1;
          if(attackerId===localId()){ localKOs=s.kos; window.TBSfx?.enemyKO?.(); }
        }
        const tile=victimId===localId()?$('localLiveTile'):$(`live-${victimId}`);
        flashKO(tile);
      }
      if(msg.type==='party_final_stats' && gameMode==='party') ensureStat(msg.playerId,p);
      if(msg.type==='party_round_result' && gameMode==='party') applyPartyResult(p);
    });
  }

  function flashKO(tile){
    if(!tile)return; const shell=tile.querySelector('.board-shell,.remote-board-shell'); if(!shell)return;
    const el=document.createElement('div'); el.className='party-ko-flash'; el.textContent='K.O.!'; shell.appendChild(el); setTimeout(()=>el.remove(),850);
  }

  function ensureRail(tile,key){
    if(!tile)return null;
    let rail=tile.querySelector('.battle-stat-rail');
    if(!rail){
      rail=document.createElement('div'); rail.className='battle-stat-rail';
      rail.innerHTML='<div class="rail-ko"><span>KO</span><strong>0</strong></div><div class="rail-sent"><span>LINES<br>SENT</span><strong>0</strong></div>';
      tile.appendChild(rail);
    }
    rail.dataset.player=key||''; return rail;
  }
  function setRail(tile,ko,sent){
    const rail=ensureRail(tile); if(!rail)return;
    rail.querySelector('.rail-ko strong').textContent=Number(ko||0);
    rail.querySelector('.rail-sent strong').textContent=Number(sent||0);
  }
  function renderRails(){
    if(gameMode==='solo') return;
    if(gameMode==='duel'){
      setRail($('localLiveTile'),Number($('myKO')?.textContent||0),Number(window.TBBattle?.totalSent||attack||0));
      const rem=activeRemoteEntries('duel')[0];
      if(rem){ const [id,state]=rem; setRail($(`live-${id}`),Number(state.ko||0),Number(remoteSent.get(String(id))||state.totalSent||0)); }
      if(window.TBAIMode){
        const aiSent=Number(window.TBAIStats?.linesSent||0); setRail($('live-ai-rival'),Number($('rivalKO')?.textContent||0),aiSent);
      }
    } else if(gameMode==='party'){
      setRail($('localLiveTile'),localKOs,localLinesSent);
      activeRemoteEntries('party').forEach(([id,state])=>{ const s=stats.get(String(id))||{}; setRail($(`live-${id}`),Number(s.kos||state.ko||0),Number(s.linesSent||remoteSent.get(String(id))||0)); });
    }
  }

  // Share duel lines-sent total so the opponent rail is exact and per game.
  let lastSharedAttack=-1;
  setInterval(()=>{
    renderRails(); renderChampionChips();
    if(gameMode==='duel'&&!window.TBAIMode&&gameRunning&&window.TBMultiplayer?.room){
      const n=Number(window.TBBattle?.totalSent||attack||0);
      if(n!==lastSharedAttack){ lastSharedAttack=n; TBMultiplayer.send('attack_total',{totalSent:n,name:localName()}); }
    }
  },120);
  if(window.TBMultiplayer){
    TBMultiplayer.onMessage(msg=>{
      if(msg.type==='attack_total') remoteSent.set(String(msg.playerId),Number(msg.payload?.totalSent||0));
    });
  }

  function renderChampionChips(){
    document.querySelectorAll('.defending-champion-chip').forEach(el=>el.remove());
    if(!defendingChampionId || gameMode!=='party') return;
    const tile=defendingChampionId===localId()?$('localLiveTile'):$(`live-${defendingChampionId}`);
    const profile=tile?.querySelector('.player-profile-row'); if(!profile)return;
    const chip=document.createElement('span'); chip.className='defending-champion-chip'; chip.textContent='♛ DEFENDING CHAMPION'; profile.appendChild(chip);
  }

  // Mirror duel outcome onto both boards: when you win, the rival board visibly says YOU LOSE.
  const titleObserver=new MutationObserver(()=>{
    if(gameMode!=='duel' || game.classList.contains('hidden')) return;
    const title=String($('overlayTitle')?.textContent||'').trim().toUpperCase();
    if(!['YOU WIN','YOU LOSE'].includes(title) || title===lastDuelResult) return;
    lastDuelResult=title;
    const won=title==='YOU WIN';
    showTileResult($('localLiveTile'),title,won);
    const rival=window.TBAIMode?$('live-ai-rival'):(activeRemoteEntries('duel')[0]?$(`live-${activeRemoteEntries('duel')[0][0]}`):null);
    showTileResult(rival,won?'YOU LOSE':'YOU WIN',!won);
    if(won){window.TBEffects?.confetti?.();window.TBSfx?.partyWin?.();} else window.TBSfx?.partyLose?.();
  });
  if($('overlayTitle')) titleObserver.observe($('overlayTitle'),{childList:true,characterData:true,subtree:true});

  // Remove the old small counters; the large left rail is the authoritative per-game counter.
  const style=document.createElement('style');
  style.textContent=`
    .player-counters{display:none!important}
    .live-player-tile{position:relative!important}
    .battle-stat-rail{position:absolute;left:-12px;top:104px;z-index:24;width:76px;display:grid;gap:7px;pointer-events:none}
    .battle-stat-rail>div{padding:8px 5px 7px;text-align:center;border-radius:12px;border:2px solid rgba(255,255,255,.42);box-shadow:0 5px 0 rgba(9,8,31,.64),0 8px 18px rgba(0,0,0,.32),inset 0 1px rgba(255,255,255,.25)}
    .rail-ko{background:linear-gradient(180deg,#ff728d,#cf365f)}.rail-sent{background:linear-gradient(180deg,#5de6ff,#397ee8)}
    .battle-stat-rail span{display:block;color:#fff;font-size:9px;line-height:1.05;font-weight:1000;letter-spacing:.06em;text-shadow:0 1px 2px rgba(0,0,0,.4)}
    .battle-stat-rail strong{display:block;color:#fff;font-size:31px;line-height:1;margin-top:3px;font-weight:1000;text-shadow:0 3px 0 rgba(0,0,0,.25)}
    .board-shell,.remote-board-shell{position:relative!important;overflow:hidden}
    .board-result-overlay{position:absolute;inset:0;z-index:60;display:grid;place-content:center;text-align:center;gap:6px;background:rgba(22,13,44,.80);backdrop-filter:blur(2px);animation:resultPop .35s ease-out}
    .board-result-overlay.win{background:radial-gradient(circle at center,rgba(255,222,82,.38),rgba(34,22,77,.88) 58%)}
    .board-result-overlay.lose{background:radial-gradient(circle at center,rgba(255,77,104,.25),rgba(29,15,43,.90) 58%)}
    .board-result-overlay strong{font-size:clamp(24px,4vw,52px);color:#fff;font-weight:1000;letter-spacing:.03em;text-shadow:0 4px 0 rgba(0,0,0,.38),0 0 24px rgba(255,255,255,.15)}
    .board-result-overlay.win strong{color:#fff27b}.board-result-overlay.lose strong{color:#ff98ae}.board-result-overlay span{font-size:10px;font-weight:1000;color:#ded7ff;letter-spacing:.15em}
    @keyframes resultPop{0%{opacity:0;transform:scale(.85)}70%{transform:scale(1.04)}100%{opacity:1;transform:scale(1)}}
    .party-ko-flash{position:absolute;inset:0;z-index:58;display:grid;place-items:center;background:rgba(187,34,73,.68);color:#fff;font-size:clamp(34px,6vw,70px);font-weight:1000;text-shadow:0 5px 0 rgba(0,0,0,.35);animation:koFlash27 .85s ease both}@keyframes koFlash27{0%{opacity:0;transform:scale(.7)}25%{opacity:1;transform:scale(1.12)}100%{opacity:0;transform:scale(.96)}}
    .defending-champion-chip{color:#3a2305!important;background:linear-gradient(180deg,#fff27d,#f3ad45)!important;border:1px solid #fff7b6!important;box-shadow:0 2px 0 #9b6335,0 0 12px rgba(255,224,93,.35)!important}
    .party-result-panel{position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:18px;background:rgba(7,7,24,.78);backdrop-filter:blur(8px)}.party-result-panel.hidden{display:none!important}
    .party-result-card{width:min(720px,96vw);max-height:88vh;overflow:auto;padding:22px;border-radius:24px;text-align:center;background:linear-gradient(180deg,#40318b,#211d57 38%,#151536);border:2px solid #7edfff;box-shadow:0 24px 70px rgba(0,0,0,.55),inset 0 1px rgba(255,255,255,.16)}
    .result-crown{font-size:44px}.result-kicker{margin:0;color:#8beaff;font-size:10px;font-weight:1000;letter-spacing:.18em}.party-result-card h2{margin:5px 0 12px;color:#fff;font-size:25px}.winner-name{font-size:30px;font-weight:1000;color:#fff077;text-shadow:0 3px 0 #704086}.winner-rank{margin-top:3px;color:#d9d0ff;font-size:12px;font-weight:900}.winner-badges{display:flex;justify-content:center;gap:7px;flex-wrap:wrap;margin:10px 0 15px}.winner-badges span{padding:6px 9px;border-radius:999px;background:#292568;border:1px solid #6d64bd;color:#fff;font-size:9px;font-weight:1000}
    .party-leaderboard{display:grid;gap:6px}.party-result-row{display:grid;grid-template-columns:38px minmax(110px,1fr) 46px 64px 76px;gap:6px;align-items:center;padding:8px 9px;border-radius:12px;background:#191943;border:1px solid #3f3c81;text-align:left}.party-result-row.champion-row{background:linear-gradient(90deg,#5c4374,#3c347b);border-color:#ffe46e}.party-result-row>b{color:#6ee7ff}.party-result-row span{color:#fff;font-weight:1000}.party-result-row small{display:block;color:#9e98d1;font-size:7px;margin-top:2px}.party-result-row strong{color:#ffe86d;text-align:center}.party-result-row em{font-style:normal;color:#dad6ff;font-size:9px;text-align:right;font-weight:900}.party-result-card button{margin-top:15px;width:100%;padding:12px;border-radius:12px;background:linear-gradient(180deg,#65eaff,#3d8def);border:1px solid #b8f7ff;color:#122558;font-weight:1000;box-shadow:0 4px 0 #255aa4}
    @media(max-width:720px){.battle-stat-rail{left:-2px;top:88px;width:58px;gap:5px}.battle-stat-rail>div{padding:6px 3px}.battle-stat-rail strong{font-size:24px}.battle-stat-rail span{font-size:7px}.party-result-row{grid-template-columns:28px minmax(90px,1fr) 36px 45px 55px;padding:7px 5px}.party-result-row em{font-size:7px}.winner-name{font-size:24px}}
  `;
  document.head.appendChild(style);

  // Party description now reflects battle royale rules.
  const partySmall=document.querySelector('.mode-card[data-mode="party"] small');
  if(partySmall) partySmall.textContent='2–6 players · garbage + KOs · 2-minute battle royale';
  // Chat must be player-only; remove the old system starter message if present.
  setTimeout(()=>{ const first=$('chatMessages')?.querySelector('.chat-message'); if(first?.querySelector('b')?.textContent==='SYSTEM') first.remove(); },100);

  window.TBPartyBattle={get localKOs(){return localKOs;},get localLinesSent(){return localLinesSent;},get defendingChampionId(){return defendingChampionId;}};
})();
