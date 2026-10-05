// Tetris Battle v9: first-to-5 KO duel engine, garbage/countering, CPU test rival, and local-tab multiplayer sync.
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
  let rivalBoard = Array.from({length: 20}, () => Array(10).fill(''));
  let rivalName = 'CPU Rival';
  let rivalConnected = false;
  let lastRemote = 0;
  let cpuTimer = null;
  let syncTimer = null;
  let matchResolved = false;

  if (sideCard && !$b('duelMonitor')) {
    const panel = document.createElement('div');
    panel.id = 'duelMonitor';
    panel.className = 'duel-monitor';
    panel.innerHTML = `
      <div class="duel-head"><span>1v1 BATTLE</span><b>FIRST TO 5 KO</b></div>
      <div class="ko-score"><div><small>YOU</small><strong id="myKO">0</strong></div><span>KO</span><div><small id="rivalName">CPU RIVAL</small><strong id="rivalKO">0</strong></div></div>
      <div class="rival-wrap"><canvas id="rivalBoard" width="150" height="300"></canvas><div id="rivalKOFlash" class="ko-flash hidden">K.O.!</div></div>
      <div class="incoming-box"><span>INCOMING GARBAGE</span><strong id="incomingCount">0</strong><div class="incoming-meter"><i id="incomingMeter"></i></div></div>
      <div id="connectionState" class="connection-state">CPU test rival active</div>
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
    .connection-state{text-align:center;color:#796d75;font-size:9px;margin-top:8px}.test-controls{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.test-controls button{padding:7px 5px;font-size:8px;border-radius:9px}
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
      const hole=randomHole();
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
    rivalBoard.forEach((row,y)=>row.forEach((v,col)=>{if(!v)return;const color=v==='G'?'#777177':(COLORS[v]||'#9b7b8d');const g=x.createLinearGradient(col*cell,y*cell,(col+1)*cell,(y+1)*cell);g.addColorStop(0,adjust(color,25));g.addColorStop(1,adjust(color,-25));x.fillStyle=g;x.fillRect(col*cell+1,y*cell+1,cell-2,cell-2);x.fillStyle='rgba(255,255,255,.16)';x.fillRect(col*cell+3,y*cell+3,cell-6,2)}));
  }
  function renderDuel(){
    $b('duelMonitor')?.classList.toggle('hidden',!duelMode());
    if(!duelMode()) return;
    $b('myKO').textContent=myKO; $b('rivalKO').textContent=rivalKO; $b('rivalName').textContent=rivalName.toUpperCase();
    $b('incomingCount').textContent=incomingGarbage; $b('incomingMeter').style.width=`${Math.min(100,incomingGarbage*8)}%`;
    $b('connectionState').textContent=rivalConnected?'Local-tab opponent connected':'CPU test rival active';
    drawRival();
  }
  function koFlash(who){
    if(who==='rival'){
      const el=$b('rivalKOFlash'); el.classList.remove('hidden'); void el.offsetWidth; setTimeout(()=>el.classList.add('hidden'),720);
    } else {
      arena?.classList.remove('duel-ko-local'); void arena?.offsetWidth; arena?.classList.add('duel-ko-local');
      if(typeof toast==='function') toast('K.O.!',`${rivalName} scores a knockout`);
    }
    if(typeof tone==='function'&&sfxOn){tone(120,.18,'sawtooth',.05);tone(70,.25,'triangle',.05,.08)}
  }
  function recoverLocal(){
    board=createBoard(); incomingGarbage=0; current=null; renderDuel(); spawn(); draw();
  }
  function resolveMatch(result,reason){
    if(matchResolved) return; matchResolved=true;
    if(typeof TBMultiplayer!=='undefined') TBMultiplayer.send('match_end',{result, myKO, rivalKO, score, totalSent});
    const label=reason||`${myKO}-${rivalKO} KO`;
    if(typeof toast==='function') toast(result==='win'?'YOU WIN':'YOU LOSE',label);
    originalEndGame(result);
  }
  function scoreKO(side){
    if(matchResolved||!duelMode()) return;
    if(side==='me'){
      myKO++; koFlash('rival'); rivalBoard=Array.from({length:20},()=>Array(10).fill(''));
      if(rivalConnected&&typeof TBMultiplayer!=='undefined') TBMultiplayer.send('ko_scored',{myKO});
      if(myKO>=KO_TARGET) return resolveMatch('win','First to 5 KOs');
    } else {
      rivalKO++; koFlash('me');
      if(rivalConnected&&typeof TBMultiplayer!=='undefined') TBMultiplayer.send('knocked_out',{rivalKO});
      if(rivalKO>=KO_TARGET) return resolveMatch('lose','Rival reached 5 KOs');
      setTimeout(recoverLocal,420);
    }
    renderDuel();
  }

  function desiredAttack(lines, comboCount, perfect){
    let sent=[0,0,1,2,4][lines]||4;
    if(comboCount>0){const bonuses=[0,1,1,2,2,3,3,4,4,4,4];sent+=bonuses[Math.min(comboCount,10)]||4}
    if(perfect) sent+=10;
    return sent;
  }
  function sendGarbage(lines){
    if(lines<=0||!duelMode())return;
    totalSent+=lines;
    if(rivalConnected&&window.TBMultiplayer){TBMultiplayer.send('garbage',{lines});}
    else {
      const overflow=addGarbageToBoard(rivalBoard,lines);
      if(overflow||maxHeight(rivalBoard)>=20) scoreKO('me');
    }
    renderDuel();
  }
  function receiveGarbage(lines){incomingGarbage+=Math.max(0,Number(lines)||0);renderDuel()}
  function applyPending(){
    if(!duelMode()||incomingGarbage<=0)return;
    const lines=incomingGarbage; incomingGarbage=0;
    const overflow=addGarbageToBoard(board,lines);
    renderDuel();
    if(overflow) scoreKO('rival');
  }

  const beforeBattleClear=clearLines;
  clearLines=function(){
    if(!duelMode()) return beforeBattleClear();
    const lines=board.reduce((n,row)=>n+(row.every(Boolean)?1:0),0);
    const attackBefore=attack;
    beforeBattleClear();
    if(lines>0){
      const perfect=typeof emptyBoard==='function'&&emptyBoard();
      const desired=desiredAttack(lines,combo,perfect);
      const cancel=Math.min(incomingGarbage,desired);
      incomingGarbage-=cancel;
      const outbound=Math.max(0,desired-cancel);
      attack=attackBefore+outbound;
      if(typeof updateHud==='function') updateHud();
      sendGarbage(outbound);
    }
    applyPending();
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
      if(totalSent!==rivalSent) return resolveMatch(totalSent>rivalSent?'win':'lose','Tiebreak: garbage sent');
      const myH=maxHeight(board), rivalH=maxHeight(rivalBoard);
      if(myH!==rivalH) return resolveMatch(myH<rivalH?'win':'lose','Tiebreak: lower stack');
      matchResolved=true;
      if(typeof toast==='function') toast('DRAW','KO, garbage, and stack height tied');
      return originalEndGame('time');
    }
    return originalEndGame(reason);
  };

  const oldStartGame=startGame;
  startGame=function(){
    myKO=0;rivalKO=0;incomingGarbage=0;totalSent=0;rivalSent=0;matchResolved=false;
    rivalBoard=Array.from({length:20},()=>Array(10).fill(''));
    const out=oldStartGame();
    startCPU(); startSync(); renderDuel();
    return out;
  };

  const oldOpenGame=openGame;
  openGame=function(code){
    const out=oldOpenGame(code);
    connectTransport(code);
    renderDuel();
    return out;
  };

  function cpuBuild(){
    if(!duelMode()||rivalConnected||!gameRunning||paused||matchResolved)return;
    if(Math.random()<.55){
      const y=19-Math.floor(Math.random()*Math.min(8,19));
      const x=Math.floor(Math.random()*10); rivalBoard[y][x]=['T','L','J','S','Z','O','I'][Math.floor(Math.random()*7)];
    }
    if(Math.random()<.24){const lines=Math.random()<.7?1:Math.random()<.85?2:4;rivalSent+=lines;receiveGarbage(lines)}
    if(Math.random()<.35){for(let y=19;y>=12;y--){if(rivalBoard[y].filter(Boolean).length>=7){rivalBoard.splice(y,1);rivalBoard.unshift(Array(10).fill(''));break}}}
    if(maxHeight(rivalBoard)>=20) scoreKO('me');
    renderDuel();
  }
  function startCPU(){clearInterval(cpuTimer);cpuTimer=setInterval(cpuBuild,1100)}

  function connectTransport(code){
    rivalConnected=false;lastRemote=0;rivalName='CPU Rival';
    if(!window.TBMultiplayer||!TBMultiplayer.connect(code,$b('playerName')?.value||'Player')){renderDuel();return}
    TBMultiplayer.onMessage(msg=>{
      lastRemote=Date.now(); rivalConnected=true;
      const p=msg.payload||{};
      if(msg.type==='hello'||msg.type==='heartbeat'){
        rivalName=p.name||'Rival';
        if(msg.type==='hello') TBMultiplayer.send('hello',{name:$b('playerName')?.value||'Player'});
      }
      if(msg.type==='state'){
        rivalName=p.name||rivalName; rivalSent=Number(p.totalSent||rivalSent);
        if(Array.isArray(p.board)&&p.board.length===20) rivalBoard=p.board;
        rivalKO=Number(p.myKO??rivalKO);
      }
      if(msg.type==='garbage') receiveGarbage(p.lines);
      if(msg.type==='knocked_out') { myKO++; koFlash('rival'); rivalBoard=Array.from({length:20},()=>Array(10).fill('')); if(myKO>=KO_TARGET) resolveMatch('win','First to 5 KOs'); }
      if(msg.type==='match_end'&&!matchResolved){ if(p.result==='win') resolveMatch('lose','Opponent won'); }
      renderDuel();
    });
  }
  function startSync(){
    clearInterval(syncTimer);
    syncTimer=setInterval(()=>{
      if(!duelMode()||!gameRunning||!window.TBMultiplayer)return;
      if(rivalConnected&&Date.now()-lastRemote>7000){rivalConnected=false;rivalName='CPU Rival'}
      TBMultiplayer.send('state',{name:$b('playerName')?.value||'Player',board,score,myKO,totalSent,timeLeft});
      renderDuel();
    },300);
  }

  $b('testSend4')?.addEventListener('click',()=>{ if(duelMode()){sendGarbage(4);renderDuel()} });
  $b('testReceive4')?.addEventListener('click',()=>{ if(duelMode()){receiveGarbage(4);renderDuel()} });
  document.querySelectorAll('.mode-card').forEach(btn=>btn.addEventListener('click',()=>setTimeout(renderDuel,0)));
  renderDuel();
})();
