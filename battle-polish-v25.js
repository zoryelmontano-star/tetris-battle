// v25: centered shared pause, realistic AI visual play, and Rank XP in the top HUD.
(() => {
  const $ = id => document.getElementById(id);

  // ---------------- Rank XP HUD ----------------
  function renderRankXP() {
    const value = $('combo');
    const box = value?.closest('.hud-box');
    const label = box?.querySelector('span');
    if (!value || !label || typeof window.getTetrisRank !== 'function') return;
    const r = getTetrisRank();
    const starXP = 100;
    const currentXP = Math.max(0, Number(r.stars || 0)) * starXP;
    const goalXP = Math.max(1, Number(r.goal || 1)) * starXP;
    const maxed = r.title === 'God of Tetris';
    label.textContent = maxed ? 'RANK XP · MAX' : `RANK XP · ${r.stars}/${r.goal}★`;
    value.textContent = maxed ? 'MAX' : `${currentXP}/${goalXP}`;
    value.title = maxed
      ? 'Maximum rank achieved'
      : `${goalXP - currentXP} XP to the next rank threshold · 100 XP = 1 star`;
  }

  if (typeof updateHud === 'function') {
    const priorUpdateHud = updateHud;
    updateHud = function() {
      const out = priorUpdateHud();
      renderRankXP();
      return out;
    };
  }
  setInterval(renderRankXP, 350);
  renderRankXP();

  // ---------------- Full-page shared pause ----------------
  let pauseBy = '';
  const pauseLayer = document.createElement('div');
  pauseLayer.id = 'globalPauseLayer';
  pauseLayer.className = 'global-pause-layer hidden';
  pauseLayer.innerHTML = `
    <div class="global-pause-card">
      <div class="pause-symbol">Ⅱ</div>
      <strong>PAUSED</strong>
      <p id="globalPauseText">Game paused.</p>
      <button id="globalResumeBtn" type="button">Resume Game</button>
      <small>Either player can resume. The match continues after READY · 3 · 2 · 1 · GO.</small>
    </div>`;
  document.body.appendChild(pauseLayer);

  const pauseStyle = document.createElement('style');
  pauseStyle.textContent = `
    .global-pause-layer{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:rgba(8,7,10,.76);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
    .global-pause-layer.hidden{display:none!important}
    .global-pause-card{width:min(92vw,460px);padding:30px 24px 24px;border-radius:24px;text-align:center;background:linear-gradient(180deg,#282129,#171418);border:1px solid rgba(231,199,127,.3);box-shadow:0 28px 70px rgba(0,0,0,.58),inset 0 1px rgba(255,255,255,.06)}
    .pause-symbol{width:58px;height:58px;margin:0 auto 12px;display:grid;place-items:center;border-radius:18px;background:linear-gradient(145deg,#e0bd79,#9e6f47);color:#171116;font-size:27px;font-weight:1000;box-shadow:0 12px 26px rgba(0,0,0,.3)}
    .global-pause-card>strong{display:block;font-size:42px;line-height:1;letter-spacing:.05em;color:#f4e3bd;text-shadow:0 6px 22px rgba(0,0,0,.4)}
    .global-pause-card p{margin:10px 0 18px;color:#c1b2bb;font-size:14px;font-weight:750}
    .global-pause-card button{width:100%;padding:13px 16px;border-radius:14px;font-size:14px;font-weight:1000;background:linear-gradient(180deg,#d6b671,#a77d48);color:#1b1419;border:1px solid #e1c586}
    .global-pause-card small{display:block;margin-top:12px;color:#80757c;font-size:10px;line-height:1.45}
  `;
  document.head.appendChild(pauseStyle);

  function playerName() { return ($('playerName')?.value || 'Player').trim() || 'Player'; }

  function renderGlobalPause() {
    const activeGame = !game.classList.contains('hidden') && !!gameRunning;
    const title = ($('overlayTitle')?.textContent || '').trim().toUpperCase();
    const visible = activeGame && !!paused && title === 'PAUSED';
    pauseLayer.classList.toggle('hidden', !visible);
    if (visible) {
      $('globalPauseText').textContent = gameMode === 'solo'
        ? 'Game paused.'
        : `${pauseBy || 'A player'} paused the match.`;
    }
  }

  $('pauseBtn')?.addEventListener('click', () => { pauseBy = playerName(); }, true);
  $('globalResumeBtn')?.addEventListener('click', () => {
    if (paused && typeof pauseGame === 'function') pauseGame();
  });

  if (window.TBMultiplayer) {
    TBMultiplayer.onMessage(msg => {
      const p = msg.payload || {};
      if (msg.type === 'shared_pause') pauseBy = p.name || 'A player';
      if (msg.type === 'shared_resume') setTimeout(renderGlobalPause, 20);
    });
  }
  setInterval(renderGlobalPause, 80);

  // ---------------- Realistic-looking AI board ----------------
  const W = 10, H = 20;
  const PIECES = {
    I:[[0,0],[1,0],[2,0],[3,0]],
    O:[[0,0],[1,0],[0,1],[1,1]],
    T:[[0,0],[1,0],[2,0],[1,1]],
    S:[[1,0],[2,0],[0,1],[1,1]],
    Z:[[0,0],[1,0],[1,1],[2,1]],
    J:[[0,0],[0,1],[1,1],[2,1]],
    L:[[2,0],[0,1],[1,1],[2,1]]
  };
  const AI_COLORS = {I:'#65c8d0',O:'#e4c85e',T:'#a982c3',S:'#78b985',Z:'#d9787d',J:'#6f8fc9',L:'#d99a63',G:'#777177'};
  let aiBoard = blankBoard();
  let aiActive = null;
  let aiBag = [];
  let aiLastStep = 0;
  let aiLastAttack = Number($('attack')?.textContent || 0);
  let aiLastKO = Number($('rivalKO')?.textContent || 0);

  function blankBoard(){ return Array.from({length:H},()=>Array(W).fill('')); }
  function cloneBoard(b){ return b.map(r=>r.slice()); }
  function normalize(cells){
    const minX=Math.min(...cells.map(c=>c[0])), minY=Math.min(...cells.map(c=>c[1]));
    return cells.map(([x,y])=>[x-minX,y-minY]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  }
  function rotate(cells){ return normalize(cells.map(([x,y])=>[-y,x])); }
  function keyShape(cells){ return cells.map(c=>c.join(',')).join(';'); }
  function rotations(type){
    const out=[], seen=new Set(); let s=normalize(PIECES[type]);
    for(let i=0;i<4;i++){ const k=keyShape(s); if(!seen.has(k)){seen.add(k);out.push(s);} s=rotate(s); }
    return out;
  }
  function refillBag(){ aiBag=['I','O','T','S','Z','J','L'].sort(()=>Math.random()-.5); }
  function nextType(){ if(!aiBag.length) refillBag(); return aiBag.pop(); }
  function collides(b,cells,x,y){
    return cells.some(([dx,dy])=>{
      const px=x+dx, py=y+dy;
      return px<0||px>=W||py>=H||(py>=0&&!!b[py][px]);
    });
  }
  function clearRows(b){
    let n=0;
    for(let y=H-1;y>=0;y--){
      if(b[y].every(Boolean)){ b.splice(y,1); b.unshift(Array(W).fill('')); n++; y++; }
    }
    return n;
  }
  function metrics(b){
    const heights=[]; let holes=0;
    for(let x=0;x<W;x++){
      let top=H;
      for(let y=0;y<H;y++) if(b[y][x]){ top=y; break; }
      const h=H-top; heights.push(h);
      if(h>0) for(let y=top+1;y<H;y++) if(!b[y][x]) holes++;
    }
    const agg=heights.reduce((a,v)=>a+v,0);
    const bump=heights.slice(1).reduce((a,v,i)=>a+Math.abs(v-heights[i]),0);
    return {agg,holes,bump,max:Math.max(...heights)};
  }
  function lockTo(b,type,cells,x,y){
    cells.forEach(([dx,dy])=>{const px=x+dx,py=y+dy;if(py>=0&&py<H&&px>=0&&px<W)b[py][px]=type;});
  }
  function pickPlacement(type){
    const candidates=[];
    for(const cells of rotations(type)){
      const maxX=Math.max(...cells.map(c=>c[0]));
      for(let x=0;x<=W-1-maxX;x++){
        let y=-4;
        while(!collides(aiBoard,cells,x,y+1)) y++;
        if(collides(aiBoard,cells,x,y)) continue;
        const temp=cloneBoard(aiBoard); lockTo(temp,type,cells,x,y); const lines=clearRows(temp); const m=metrics(temp);
        const score=lines*10-m.holes*7-m.agg*.34-m.bump*.42-m.max*.5+Math.random()*.9;
        candidates.push({cells,x,y,score});
      }
    }
    candidates.sort((a,b)=>b.score-a.score);
    if(!candidates.length) return null;
    const pick = Math.random()<.18 ? candidates[Math.min(2,candidates.length-1)] : candidates[0];
    return pick;
  }
  function spawnAI(){
    const type=nextType(), plan=pickPlacement(type);
    if(!plan){ aiBoard=blankBoard(); return; }
    aiActive={type,cells:plan.cells,x:Math.max(0,Math.min(3,plan.x)),targetX:plan.x,y:-3};
  }
  function lockAI(){
    if(!aiActive) return;
    lockTo(aiBoard,aiActive.type,aiActive.cells,aiActive.x,aiActive.y);
    clearRows(aiBoard); aiActive=null; spawnAI();
  }
  function stepAI(){
    if(!window.TBAIMode||gameMode!=='duel'||!gameRunning||paused) return;
    if(!aiActive) spawnAI();
    if(!aiActive) return;
    const dir=Math.sign(aiActive.targetX-aiActive.x);
    if(dir && !collides(aiBoard,aiActive.cells,aiActive.x+dir,aiActive.y)) aiActive.x+=dir;
    if(!collides(aiBoard,aiActive.cells,aiActive.x,aiActive.y+1)) aiActive.y++;
    else lockAI();
  }
  function addGarbageVisual(lines){
    for(let i=0;i<Math.max(0,lines);i++){
      aiBoard.shift(); const hole=Math.floor(Math.random()*W);
      aiBoard.push(Array.from({length:W},(_,x)=>x===hole?'':'G'));
    }
  }
  function drawCell(ctx,x,y,c,cell){
    if(!c||y<0) return;
    const color=AI_COLORS[c]||'#9f8195';
    const g=ctx.createLinearGradient(x*cell,y*cell,(x+1)*cell,(y+1)*cell);
    g.addColorStop(0,color); g.addColorStop(1,'#3a3037');
    ctx.fillStyle=g;ctx.fillRect(x*cell+1,y*cell+1,cell-2,cell-2);
    ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(x*cell+2.5,y*cell+2.5,Math.max(2,cell-5),2);
  }
  function drawAI(){
    if(!window.TBAIMode) return;
    window.TBAIHotfix?.showAITile?.();
    const canvas=$('live-ai-rival')?.querySelector('canvas'); if(!canvas) return;
    const ctx=canvas.getContext('2d'), cell=canvas.width/W;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#09080a';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle='rgba(255,255,255,.035)';ctx.lineWidth=.7;
    for(let x=0;x<=W;x++){ctx.beginPath();ctx.moveTo(x*cell,0);ctx.lineTo(x*cell,canvas.height);ctx.stroke();}
    for(let y=0;y<=H;y++){ctx.beginPath();ctx.moveTo(0,y*cell);ctx.lineTo(canvas.width,y*cell);ctx.stroke();}
    aiBoard.forEach((row,y)=>row.forEach((c,x)=>drawCell(ctx,x,y,c,cell)));
    if(aiActive) aiActive.cells.forEach(([dx,dy])=>drawCell(ctx,aiActive.x+dx,aiActive.y+dy,aiActive.type,cell));
  }
  function resetAIVisual(){ aiBoard=blankBoard(); aiActive=null; aiBag=[]; aiLastKO=Number($('rivalKO')?.textContent||0); spawnAI(); drawAI(); }

  const attackEl=$('attack');
  if(attackEl){
    new MutationObserver(()=>{
      const next=Number(attackEl.textContent||0);
      if(next<aiLastAttack){aiLastAttack=next;return;}
      const delta=next-aiLastAttack; aiLastAttack=next;
      if(window.TBAIMode&&delta>0) setTimeout(()=>addGarbageVisual(delta),180);
    }).observe(attackEl,{childList:true,characterData:true,subtree:true});
  }

  $('battleAIBtn')?.addEventListener('click',()=>setTimeout(resetAIVisual,40));
  $('startBtn')?.addEventListener('click',()=>{ if(window.TBAIMode) resetAIVisual(); },true);

  setInterval(()=>{
    if(window.TBAIMode){
      const ko=Number($('rivalKO')?.textContent||0);
      if(ko!==aiLastKO){aiLastKO=ko;resetAIVisual();}
      const now=performance.now();
      if(now-aiLastStep>125){aiLastStep=now;stepAI();}
      drawAI();
    }
  },55);
})();
