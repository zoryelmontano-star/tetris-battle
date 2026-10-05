// v25: centered shared pause, realistic AI play, and Rank XP in the top HUD.
(() => {
  const $ = id => document.getElementById(id);

  // ---------------- Rank XP HUD ----------------
  function renderRankXP() {
    const value = $('combo');
    const box = value?.closest('.hud-box');
    const label = box?.querySelector('span');
    if (!value || !label || typeof window.getTetrisRank !== 'function') return;
    const r = getTetrisRank();
    const currentXP = Math.max(0, Number(r.stars || 0)) * 100;
    const goalXP = Math.max(1, Number(r.goal || 1)) * 100;
    const maxed = r.title === 'God of Tetris';
    label.textContent = maxed ? 'RANK XP · MAX' : `RANK XP · ${r.stars}/${r.goal}★`;
    value.textContent = maxed ? 'MAX' : `${currentXP}/${goalXP}`;
    value.title = maxed ? 'Maximum rank achieved' : `${goalXP-currentXP} XP to next rank · 100 XP = 1 star`;
  }
  if (typeof updateHud === 'function') {
    const priorUpdateHud = updateHud;
    updateHud = function(){ const out=priorUpdateHud(); renderRankXP(); return out; };
  }
  setInterval(renderRankXP,350);
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
    .global-pause-layer{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:20px;background:rgba(6,7,18,.76);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}
    .global-pause-layer.hidden{display:none!important}
    .global-pause-card{width:min(92vw,470px);padding:32px 25px 24px;border-radius:27px;text-align:center;background:linear-gradient(160deg,#3b2474,#1d1745 52%,#17152b);border:2px solid rgba(255,229,119,.55);box-shadow:0 30px 80px rgba(0,0,0,.64),0 0 42px rgba(136,91,255,.28),inset 0 1px rgba(255,255,255,.13)}
    .pause-symbol{width:64px;height:64px;margin:0 auto 13px;display:grid;place-items:center;border-radius:20px;background:linear-gradient(145deg,#ffe66f,#ff9e4d);color:#31182e;font-size:29px;font-weight:1000;box-shadow:0 12px 28px rgba(0,0,0,.36),0 0 22px rgba(255,209,82,.25)}
    .global-pause-card>strong{display:block;font-size:44px;line-height:1;letter-spacing:.055em;color:#fff4ad;text-shadow:0 4px 0 #5f3378,0 8px 24px rgba(0,0,0,.55)}
    .global-pause-card p{margin:11px 0 19px;color:#f0eaff;font-size:14px;font-weight:850}
    .global-pause-card button{width:100%;padding:14px 16px;border-radius:15px;font-size:14px;font-weight:1000;background:linear-gradient(180deg,#62e7ff,#249cda);color:#0d2140;border:2px solid #b8f5ff;box-shadow:0 7px 0 #176590,0 12px 24px rgba(0,0,0,.25)}
    .global-pause-card small{display:block;margin-top:14px;color:#aaa1cc;font-size:10px;line-height:1.5}
  `;
  document.head.appendChild(pauseStyle);

  function playerName(){return ($('playerName')?.value||'Player').trim()||'Player';}
  function renderGlobalPause(){
    const active=!game.classList.contains('hidden')&&!!gameRunning;
    const title=($('overlayTitle')?.textContent||'').trim().toUpperCase();
    const visible=active&&!!paused&&title==='PAUSED';
    pauseLayer.classList.toggle('hidden',!visible);
    if(visible) $('globalPauseText').textContent=gameMode==='solo'?'Game paused.':`${pauseBy||'A player'} paused the match.`;
  }
  $('pauseBtn')?.addEventListener('click',()=>{pauseBy=playerName();},true);
  $('globalResumeBtn')?.addEventListener('click',()=>{if(paused&&typeof pauseGame==='function')pauseGame();});
  if(window.TBMultiplayer){
    TBMultiplayer.onMessage(msg=>{
      const p=msg.payload||{};
      if(msg.type==='shared_pause')pauseBy=p.name||'A player';
      if(msg.type==='shared_resume')setTimeout(renderGlobalPause,20);
    });
  }
  setInterval(renderGlobalPause,80);

  // ---------------- Realistic AI board ----------------
  const W=10,H=20;
  const PIECES={
    I:[[0,0],[1,0],[2,0],[3,0]], O:[[0,0],[1,0],[0,1],[1,1]], T:[[0,0],[1,0],[2,0],[1,1]],
    S:[[1,0],[2,0],[0,1],[1,1]], Z:[[0,0],[1,0],[1,1],[2,1]], J:[[0,0],[0,1],[1,1],[2,1]], L:[[2,0],[0,1],[1,1],[2,1]]
  };
  const AI_COLORS={I:'#47d8ff',O:'#ffe353',T:'#c378ff',S:'#54e489',Z:'#ff6578',J:'#5d8eff',L:'#ffad4f',G:'#777177'};
  let aiBoard=blankBoard(),aiActive=null,aiBag=[],aiLastStep=0,aiLastKO=0,aiLines=0;

  function blankBoard(){return Array.from({length:H},()=>Array(W).fill(''));}
  function cloneBoard(b){return b.map(r=>r.slice());}
  function normalize(cells){const minX=Math.min(...cells.map(c=>c[0])),minY=Math.min(...cells.map(c=>c[1]));return cells.map(([x,y])=>[x-minX,y-minY]).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);}
  function rotate(cells){return normalize(cells.map(([x,y])=>[-y,x]));}
  function keyShape(cells){return cells.map(c=>c.join(',')).join(';');}
  function rotations(type){const out=[],seen=new Set();let s=normalize(PIECES[type]);for(let i=0;i<4;i++){const k=keyShape(s);if(!seen.has(k)){seen.add(k);out.push(s);}s=rotate(s);}return out;}
  function refillBag(){aiBag=['I','O','T','S','Z','J','L'].sort(()=>Math.random()-.5);}
  function nextType(){if(!aiBag.length)refillBag();return aiBag.pop();}
  function collides(b,cells,x,y){return cells.some(([dx,dy])=>{const px=x+dx,py=y+dy;return px<0||px>=W||py>=H||(py>=0&&!!b[py][px]);});}
  function clearRows(b){let n=0;for(let y=H-1;y>=0;y--){if(b[y].every(Boolean)){b.splice(y,1);b.unshift(Array(W).fill(''));n++;y++;}}return n;}
  function metrics(b){
    const heights=[];let holes=0;
    for(let x=0;x<W;x++){let top=H;for(let y=0;y<H;y++)if(b[y][x]){top=y;break;}const h=H-top;heights.push(h);if(h>0)for(let y=top+1;y<H;y++)if(!b[y][x])holes++;}
    return {agg:heights.reduce((a,v)=>a+v,0),holes,bump:heights.slice(1).reduce((a,v,i)=>a+Math.abs(v-heights[i]),0),max:Math.max(...heights)};
  }
  function lockTo(b,type,cells,x,y){cells.forEach(([dx,dy])=>{const px=x+dx,py=y+dy;if(py>=0&&py<H&&px>=0&&px<W)b[py][px]=type;});}
  function pickPlacement(type){
    const candidates=[];
    for(const cells of rotations(type)){
      const maxX=Math.max(...cells.map(c=>c[0]));
      for(let x=0;x<=W-1-maxX;x++){
        let y=-4;while(!collides(aiBoard,cells,x,y+1))y++;
        if(collides(aiBoard,cells,x,y))continue;
        const temp=cloneBoard(aiBoard);lockTo(temp,type,cells,x,y);const lines=clearRows(temp),m=metrics(temp);
        const score=lines*13-m.holes*8-m.agg*.34-m.bump*.45-m.max*.58+Math.random()*1.2;
        candidates.push({cells,x,y,score});
      }
    }
    candidates.sort((a,b)=>b.score-a.score);
    if(!candidates.length)return null;
    return Math.random()<.14?candidates[Math.min(2,candidates.length-1)]:candidates[0];
  }
  function resetAIVisual(resetLines=true){
    aiBoard=blankBoard();aiActive=null;aiBag=[];aiLastKO=Number($('rivalKO')?.textContent||0);
    if(resetLines)aiLines=0;
    spawnAI();drawAI();
    window.dispatchEvent(new CustomEvent('tb-ai-lines',{detail:{total:aiLines}}));
  }
  function aiKO(){
    window.TBBattle?.aiKnockedOut?.();
    resetAIVisual(false);
  }
  function spawnAI(){
    const type=nextType(),plan=pickPlacement(type);
    if(!plan){aiKO();return;}
    const startX=Math.max(0,Math.min(W-4,4));
    aiActive={type,cells:plan.cells,x:startX,targetX:plan.x,y:-3};
  }
  function lockAI(){
    if(!aiActive)return;
    lockTo(aiBoard,aiActive.type,aiActive.cells,aiActive.x,aiActive.y);
    const cleared=clearRows(aiBoard);
    if(cleared>0){
      aiLines+=cleared;
      window.dispatchEvent(new CustomEvent('tb-ai-lines',{detail:{total:aiLines,cleared}}));
      // AI sends garbage only because it actually cleared these lines.
      window.TBBattle?.aiAttack?.(cleared);
    }
    aiActive=null;spawnAI();
  }
  function stepAI(){
    if(!window.TBAIMode||gameMode!=='duel'||!gameRunning||paused)return;
    if(!aiActive)spawnAI();if(!aiActive)return;
    const dir=Math.sign(aiActive.targetX-aiActive.x);
    if(dir&&!collides(aiBoard,aiActive.cells,aiActive.x+dir,aiActive.y))aiActive.x+=dir;
    if(!collides(aiBoard,aiActive.cells,aiActive.x,aiActive.y+1))aiActive.y++;
    else lockAI();
  }
  function addGarbageVisual(lines){
    const n=Math.max(0,Number(lines)||0);if(!n)return;
    for(let i=0;i<n;i++){
      const overflow=aiBoard[0].some(Boolean);
      aiBoard.shift();const hole=Math.floor(Math.random()*W);aiBoard.push(Array.from({length:W},(_,x)=>x===hole?'':'G'));
      if(overflow){aiKO();return;}
    }
  }
  window.addEventListener('tb-ai-garbage',e=>addGarbageVisual(e.detail?.lines));

  function drawCell(ctx,x,y,c,cell){
    if(!c||y<0)return;
    const color=AI_COLORS[c]||'#9f8195';
    const g=ctx.createLinearGradient(x*cell,y*cell,(x+1)*cell,(y+1)*cell);g.addColorStop(0,'#ffffff');g.addColorStop(.12,color);g.addColorStop(1,'#352d45');
    ctx.fillStyle=g;ctx.fillRect(x*cell+1,y*cell+1,cell-2,cell-2);
    ctx.fillStyle='rgba(255,255,255,.42)';ctx.fillRect(x*cell+2.5,y*cell+2.5,Math.max(2,cell-5),2.4);
    ctx.strokeStyle='rgba(255,255,255,.12)';ctx.strokeRect(x*cell+1.5,y*cell+1.5,cell-3,cell-3);
  }
  function drawAI(){
    if(!window.TBAIMode)return;
    window.TBAIHotfix?.showAITile?.();
    const canvas=$('live-ai-rival')?.querySelector('canvas');if(!canvas)return;
    const ctx=canvas.getContext('2d'),cell=canvas.width/W;
    ctx.clearRect(0,0,canvas.width,canvas.height);const bg=ctx.createLinearGradient(0,0,0,canvas.height);bg.addColorStop(0,'#17113c');bg.addColorStop(1,'#080817');ctx.fillStyle=bg;ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle='rgba(128,214,255,.08)';ctx.lineWidth=.8;
    for(let x=0;x<=W;x++){ctx.beginPath();ctx.moveTo(x*cell,0);ctx.lineTo(x*cell,canvas.height);ctx.stroke();}
    for(let y=0;y<=H;y++){ctx.beginPath();ctx.moveTo(0,y*cell);ctx.lineTo(canvas.width,y*cell);ctx.stroke();}
    aiBoard.forEach((row,y)=>row.forEach((c,x)=>drawCell(ctx,x,y,c,cell)));
    if(aiActive)aiActive.cells.forEach(([dx,dy])=>drawCell(ctx,aiActive.x+dx,aiActive.y+dy,aiActive.type,cell));
  }

  $('battleAIBtn')?.addEventListener('click',()=>setTimeout(()=>resetAIVisual(true),40));
  $('startBtn')?.addEventListener('click',()=>{if(window.TBAIMode)resetAIVisual(true);},true);
  setInterval(()=>{
    if(!window.TBAIMode)return;
    const ko=Number($('rivalKO')?.textContent||0);
    if(ko!==aiLastKO){aiLastKO=ko;resetAIVisual(false);}
    const now=performance.now();if(now-aiLastStep>135){aiLastStep=now;stepAI();}
    drawAI();
  },55);
})();
