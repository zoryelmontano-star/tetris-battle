// Tetris Battle v9: first-to-5 KO duel engine with realtime, line-clear-driven garbage.
(() => {
  const $b = id => document.getElementById(id);
  const sideCard = document.querySelector('.side-card');
  const arena = document.getElementById('arenaCard');
  const KO_TARGET = 5;
  COLORS.G = COLORS.G || '#777177';

  let myKO = 0;
  let rivalKO = 0;
  let incomingGarbage = 0;
  let totalSent = 0;
  let rivalSent = 0;
  let rivalBoard = Array.from({length:20}, () => Array(10).fill(''));
  let rivalName = 'Rival';
  let rivalConnected = false;
  let lastRemote = 0;
  let syncTimer = null;
  let matchResolved = false;

  if (sideCard && !$b('duelMonitor')) {
    const panel = document.createElement('div');
    panel.id = 'duelMonitor';
    panel.className = 'duel-monitor';
    panel.innerHTML = `
      <div class="duel-head"><span>1v1 BATTLE</span><b>FIRST TO 5 KO</b></div>
      <div class="ko-score"><div><small>YOU</small><strong id="myKO">0</strong></div><span>KO</span><div><small id="rivalName">RIVAL</small><strong id="rivalKO">0</strong></div></div>
      <div class="rival-wrap"><canvas id="rivalBoard" width="150" height="300"></canvas><div id="rivalKOFlash" class="ko-flash hidden">K.O.!</div></div>
      <div class="incoming-box"><span>INCOMING GARBAGE</span><strong id="incomingCount">0</strong><div class="incoming-meter"><i id="incomingMeter"></i></div></div>
      <div id="connectionState" class="connection-state">Waiting for rival</div>
      <div class="test-controls"><button id="testSend4">Test +4 → Rival</button><button id="testReceive4">Test +4 Incoming</button></div>
    `;
    sideCard.prepend(panel);
  }

  const style = document.createElement('style');
  style.textContent = `
    .duel-monitor{margin-bottom:15px;padding:13px;border-radius:16px;background:linear-gradient(180deg,#211b21,#151216);border:1px solid #453945}
    .duel-head{display:flex;justify-content:space-between;gap:8px;color:#9e919a;font-size:9px;font-weight:900;letter-spacing:.09em}.duel-head b{color:#e1bd79}
    .ko-score{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin:10px 0}.ko-score>div{text-align:center;background:#121014;border:1px solid #3a3139;border-radius:12px;padding:8px}.ko-score small{display:block;color:#897d85;font-size:8px}.ko-score strong{font-size:28px;color:#f2d18f}.ko-score>span{font-size:10px;color:#8d8189;font-weight:1000}
    .rival-wrap{position:relative;width:150px;margin:0 auto 10px;padding:6px;border-radius:14px;background:#0f0d10;border:1px solid #3e343c}.rival-wrap canvas{width:100%;height:auto;display:block;border-radius:9px;background:#09080a;image-rendering:pixelated}.ko-flash{position:absolute;inset:0;display:grid;place-items:center;font-size:34px;font-weight:1000;color:#fff;background:rgba(120,36,50,.72);border-radius:13px;animation:koPop .7s ease both}@keyframes koPop{0%{opacity:0;transform:scale(.75)}25%{opacity:1;transform:scale(1.08)}100%{opacity:0;transform:scale(.96)}}
    .incoming-box{padding:9px;border-radius:11px;background:#141116;border:1px solid #372e36}.incoming-box span{display:block;color:#8e8189;font-size:8px;font-weight:900;letter-spacing:.08em}.incoming-box strong{display:block;font-size:21px;margin:2px 0;color:#e78387}.incoming-meter{height:6px;border-radius:999px;overflow:hidden;background:#211a20}.incoming-meter i{display:block;height:100%;width:0;background:linear-gradient(90deg,#b96b86,#d95863);transition:width .2s ease}
    .connection-state{text-align:center;color:#796d75;font-size:9px;margin-top:8px}.test-controls{display:none!important}
    .duel-ko-local{animation:localKO .42s ease}@keyframes localKO{40%{filter:brightness(1.7);transform:scale(.985)}100%{filter:none;transform:scale(1)}}
  `;
  document.head.appendChild(style);

  function duelMode(){ return gameMode === 'duel'; }
  function maxHeight(bd){
    for(let y=0;y<bd.length;y++) if(bd[y].some(Boolean)) return bd.length-y;
    return 0;
  }
  function randomHole(){ return Math.floor(Math.random()*10); }
  function addGarbageToBoard(bd, lines){
    let overflow = false;
    for(let n=0;n<lines;n++){
      if(bd[0].some(Boolean)) overflow = true;
      bd.shift();
      const hole = randomHole();
      bd.push(Array.from({length:10},(_,x)=>x===hole?'':'G'));
    }
    return overflow;
  }

  function drawRival(){
    const c=$b('rivalBoard'); if(!c) return;
    const x=c.getContext('2d'), cell=15;
    x.clearRect(0,0,c.width,c.height); x.fillStyle='#09080a'; x.fillRect(0,0,c.width,c.height);
    x.strokeStyle='rgba(255,255,255,.035)';
    for(let i=0;i<=10;i++){x.beginPath();x.moveTo(i*cell,0);x.lineTo(i*cell,300);x.stroke()}
    for(let i=0;i<=20;i++){x.beginPath();x.moveTo(0,i*cell);x.lineTo(150,i*cell);x.stroke()}
    rivalBoard.forEach((row,y)=>row.forEach((v,col)=>{
      if(!v)return;
      const color=v==='G'?'#777177':(COLORS[v]||'#9b7b8d');
      const g=x.createLinearGradient(col*cell,y*cell,(col+1)*cell,(y+1)*cell);
      g.addColorStop(0,adjust(color,25));g.addColorStop(1,adjust(color,-25));
      x.fillStyle=g;x.fillRect(col*cell+1,y*cell+1,cell-2,cell-2);
      x.fillStyle='rgba(255,255,255,.16)';x.fillRect(col*cell+3,y*cell+3,cell-6,2);
    }));
  }

  function renderDuel(){
    $b('duelMonitor')?.classList.toggle('hidden',!duelMode());
    if(!duelMode()) return;
    if($b('myKO')) $b('myKO').textContent=myKO;
    if($b('rivalKO')) $b('rivalKO').textContent=rivalKO;
    if($b('rivalName')) $b('rivalName').textContent=(window.TBAIMode?'AI Rival':rivalName).toUpperCase();
    if($b('incomingCount')) $b('incomingCount').textContent=incomingGarbage;
    if($b('incomingMeter')) $b('incomingMeter').style.width=`${Math.min(100,incomingGarbage*8)}%`;
    if($b('connectionState')) $b('connectionState').textContent=window.TBAIMode?'AI opponent active':rivalConnected?'Online opponent connected':'Waiting for online opponent';
    drawRival();
  }

  function koFlash(who){
    if(who==='rival'){
      const el=$b('rivalKOFlash');
      if(el){el.classList.remove('hidden');void el.offsetWidth;setTimeout(()=>el.classList.add('hidden'),720);}
    } else {
      arena?.classList.remove('duel-ko-local');void arena?.offsetWidth;arena?.classList.add('duel-ko-local');
      if(typeof toast==='function') toast('K.O.!',`${window.TBAIMode?'AI Rival':rivalName} scores a knockout`);
    }
    if(typeof tone==='function'&&sfxOn){tone(120,.18,'sawtooth',.05);tone(70,.25,'triangle',.05,.08);}
  }

  function recoverLocal(){
    board=createBoard();incomingGarbage=0;current=null;renderDuel();spawn();draw();
  }

  function resolveMatch(result,reason){
    if(matchResolved) return;
    matchResolved=true;
    if(typeof TBMultiplayer!=='undefined' && TBMultiplayer.room) TBMultiplayer.send('match_end',{result,myKO,rivalKO,score,totalSent});
    const label=reason||`${myKO}-${rivalKO} KO`;
    if(typeof toast==='function') toast(result==='win'?'YOU WIN':'YOU LOSE',label);
    originalEndGame(result);
  }

  function scoreKO(side){
    if(matchResolved||!duelMode()) return;
    if(side==='me'){
      myKO++;
      koFlash('rival');
      rivalBoard=Array.from({length:20},()=>Array(10).fill(''));
      if(rivalConnected&&typeof TBMultiplayer!=='undefined') TBMultiplayer.send('ko_scored',{myKO});
      if(myKO>=KO_TARGET) return resolveMatch('win','First to 5 KOs');
    } else {
      rivalKO++;
      koFlash('me');
      if(rivalConnected&&typeof TBMultiplayer!=='undefined') TBMultiplayer.send('knocked_out',{rivalKO});
      if(rivalKO>=KO_TARGET) return resolveMatch('lose','Rival reached 5 KOs');
      setTimeout(recoverLocal,420);
    }
    renderDuel();
  }

  // One cleared line = one garbage line. No random garbage and no hidden bonus garbage.
  function desiredAttack(lines){ return Math.max(0,Number(lines)||0); }

  function sendGarbage(lines){
    const n=Math.max(0,Number(lines)||0);
    if(n<=0||!duelMode())return;
    totalSent+=n;
    if(window.TBAIMode){
      window.dispatchEvent(new CustomEvent('tb-ai-garbage',{detail:{lines:n}}));
    } else if(rivalConnected&&window.TBMultiplayer){
      TBMultiplayer.send('garbage',{lines:n});
    }
    renderDuel();
  }

  function applyPending(){
    if(!duelMode()||incomingGarbage<=0)return;
    const lines=incomingGarbage;
    incomingGarbage=0;
    const overflow=addGarbageToBoard(board,lines);
    renderDuel();draw();
    if(overflow) scoreKO('rival');
  }

  // Incoming garbage is applied immediately when the opponent's line-clear event arrives.
  function receiveGarbage(lines){
    const n=Math.max(0,Number(lines)||0);
    if(!n||!duelMode())return;
    incomingGarbage+=n;
    renderDuel();
    applyPending();
  }

  const beforeBattleClear=clearLines;
  clearLines=function(){
    if(!duelMode()) return beforeBattleClear();
    const lines=board.reduce((n,row)=>n+(row.every(Boolean)?1:0),0);
    const attackBefore=attack;
    const result=beforeBattleClear();
    if(lines>0){
      const outbound=desiredAttack(lines);
      attack=attackBefore+outbound;
      if(typeof updateHud==='function') updateHud();
      sendGarbage(outbound);
    }
    return result;
  };

  const originalEndGame=endGame;
  endGame=function(reason){
    if(!duelMode()||matchResolved) return originalEndGame(reason);
    if(reason==='lose'){
      scoreKO('rival');
      return;
    }
    if(reason==='time'){
      if(myKO!==rivalKO) return resolveMatch(myKO>rivalKO?'win':'lose','Time: most KOs');
      if(totalSent!==rivalSent) return resolveMatch(totalSent>rivalSent?'win':'lose','Tiebreak: lines sent');
      const myH=maxHeight(board), rivalH=maxHeight(rivalBoard);
      if(myH!==rivalH) return resolveMatch(myH<rivalH?'win':'lose','Tiebreak: lower stack');
      matchResolved=true;
      if(typeof toast==='function') toast('DRAW','KO, lines sent, and stack height tied');
      return originalEndGame('time');
    }
    return originalEndGame(reason);
  };

  const oldStartGame=startGame;
  startGame=function(){
    myKO=0;rivalKO=0;incomingGarbage=0;totalSent=0;rivalSent=0;matchResolved=false;
    rivalBoard=Array.from({length:20},()=>Array(10).fill(''));
    const out=oldStartGame();
    startSync();renderDuel();
    return out;
  };

  // Listen to the already-connected transport. Do not create a CPU fallback or reconnect the room here.
  if(window.TBMultiplayer){
    TBMultiplayer.onMessage(msg=>{
      const p=msg.payload||{};
      if(msg.playerId && msg.playerId!==TBMultiplayer.playerId){
        lastRemote=Date.now();
        if(gameMode==='duel') rivalConnected=true;
      }
      if(msg.type==='hello'||msg.type==='heartbeat') rivalName=p.name||rivalName;
      if(msg.type==='live_state'){
        rivalName=p.name||rivalName;
        rivalSent=Number(p.totalSent||rivalSent);
        if(Array.isArray(p.board)&&p.board.length===20) rivalBoard=p.board;
        rivalKO=Number(p.ko??rivalKO);
      }
      if(msg.type==='state'){
        rivalName=p.name||rivalName;
        rivalSent=Number(p.totalSent||rivalSent);
        if(Array.isArray(p.board)&&p.board.length===20) rivalBoard=p.board;
        rivalKO=Number(p.myKO??rivalKO);
      }
      if(msg.type==='garbage') receiveGarbage(p.lines);
      if(msg.type==='knocked_out'){
        myKO++;
        koFlash('rival');
        rivalBoard=Array.from({length:20},()=>Array(10).fill(''));
        if(myKO>=KO_TARGET) resolveMatch('win','First to 5 KOs');
      }
      if(msg.type==='match_end'&&!matchResolved&&p.result==='win') resolveMatch('lose','Opponent won');
      renderDuel();
    });
  }

  function startSync(){
    clearInterval(syncTimer);
    syncTimer=setInterval(()=>{
      if(!duelMode()||!gameRunning||!window.TBMultiplayer||!TBMultiplayer.room)return;
      if(rivalConnected&&Date.now()-lastRemote>7000){rivalConnected=false;rivalName='Rival';}
      TBMultiplayer.send('state',{name:$b('playerName')?.value||'Player',board,score,myKO,totalSent,timeLeft});
      renderDuel();
    },300);
  }

  // API used by the visual AI engine. AI can only attack after it actually clears lines.
  window.TBBattle={
    aiAttack(lines){ receiveGarbage(lines); },
    aiKnockedOut(){ scoreKO('me'); },
    get myKO(){return myKO;},
    get rivalKO(){return rivalKO;},
    get totalSent(){return totalSent;},
    render:renderDuel
  };

  document.querySelectorAll('.mode-card').forEach(btn=>btn.addEventListener('click',()=>setTimeout(renderDuel,0)));
  renderDuel();
})();
