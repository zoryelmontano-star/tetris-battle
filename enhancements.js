// Tetris Battle v2 enhancements: next 2 preview, combo/perfect callouts, and sound effects.
(() => {
  const $e = id => document.getElementById(id);

  // --- UI injection ---
  const topbar = document.querySelector('.topbar');
  if (topbar && !$e('soundBtn')) {
    const soundBtn = document.createElement('button');
    soundBtn.id = 'soundBtn';
    soundBtn.className = 'ghost';
    topbar.appendChild(soundBtn);
  }

  const boardWrap = document.querySelector('.board-wrap');
  if (boardWrap && !$e('next1')) {
    const playRow = document.createElement('div');
    playRow.className = 'play-row';
    boardWrap.parentNode.insertBefore(playRow, boardWrap);
    playRow.appendChild(boardWrap);

    const nextPanel = document.createElement('div');
    nextPanel.className = 'next-panel';
    nextPanel.innerHTML = `
      <div class="next-title">NEXT</div>
      <div class="next-piece"><span>1</span><canvas id="next1" width="96" height="72"></canvas></div>
      <div class="next-piece"><span>2</span><canvas id="next2" width="96" height="72"></canvas></div>`;
    playRow.appendChild(nextPanel);

    const toast = document.createElement('div');
    toast.id = 'gameToast';
    toast.className = 'game-toast hidden';
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = '<strong id="toastTitle"></strong><span id="toastSub"></span>';
    boardWrap.appendChild(toast);
  }

  const style = document.createElement('style');
  style.textContent = `
    .topbar{flex-wrap:wrap}.play-row{display:flex;justify-content:center;align-items:flex-start;gap:12px}
    .board-wrap{margin:0}.next-panel{width:114px;padding:10px 8px;background:#0e131b;border:1px solid #2d3441;border-radius:14px}
    .next-title{text-align:center;color:#8f98aa;font-size:11px;font-weight:900;letter-spacing:.14em;margin-bottom:8px}
    .next-piece{position:relative;border-radius:10px;background:#090c11;border:1px solid #222a37;margin-top:8px;padding:5px}
    .next-piece span{position:absolute;top:5px;left:7px;z-index:2;color:#5f6c80;font-size:10px;font-weight:800}
    .next-piece canvas{width:96px;height:72px;max-width:100%;display:block;image-rendering:pixelated}
    .game-toast{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);z-index:3;min-width:170px;text-align:center;padding:13px 16px;border-radius:14px;background:rgba(12,16,25,.92);border:1px solid rgba(255,255,255,.16);box-shadow:0 14px 35px rgba(0,0,0,.35);pointer-events:none}
    .game-toast strong{display:block;font-size:22px}.game-toast span{display:block;margin-top:3px;color:#b7c0d2;font-size:12px}.game-toast.perfect strong{font-size:28px}.game-toast.max strong{font-size:26px}
    .game-toast.pop{animation:tbToast .8s ease both}@keyframes tbToast{0%{opacity:0;transform:translate(-50%,-50%) scale(.65)}22%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}70%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-58%) scale(.95)}}
    @media(max-width:500px){.play-row{gap:7px}.next-panel{width:84px;padding:8px 5px}.next-piece canvas{width:70px;height:54px}.board-wrap{width:min(calc(100vw - 114px),330px)}}`;
  document.head.appendChild(style);

  // --- Next 2 queue ---
  let queue = [randomPiece(), randomPiece()];

  function renderMini(id, piece) {
    const c = $e(id);
    if (!c || !piece) return;
    const cctx = c.getContext('2d');
    cctx.clearRect(0,0,c.width,c.height);
    cctx.fillStyle = '#090c11';
    cctx.fillRect(0,0,c.width,c.height);
    const cell = 17;
    const shape = piece.shape;
    const w = shape[0].length * cell;
    const h = shape.length * cell;
    const ox = Math.floor((c.width-w)/2), oy = Math.floor((c.height-h)/2);
    shape.forEach((row,y)=>row.forEach((v,x)=>{
      if (!v) return;
      cctx.fillStyle = COLORS[piece.type];
      cctx.fillRect(ox+x*cell,oy+y*cell,cell,cell);
      cctx.strokeStyle='rgba(255,255,255,.16)';
      cctx.strokeRect(ox+x*cell+.5,oy+y*cell+.5,cell-1,cell-1);
    }));
  }

  function renderNext(){ renderMini('next1',queue[0]); renderMini('next2',queue[1]); }
  function resetQueue(){ queue=[randomPiece(),randomPiece()]; renderNext(); }
  renderNext();

  spawn = function(){
    if (queue.length < 2) resetQueue();
    current = queue.shift();
    current.x = Math.floor(COLS/2) - Math.ceil(current.shape[0].length/2);
    current.y = 0;
    queue.push(randomPiece());
    renderNext();
    if (collide(current)) endGame('Game Over');
  };

  // Reset previews before the original start-game click listener runs.
  const startBtn = $e('startBtn');
  if (startBtn) startBtn.addEventListener('click', resetQueue, true);

  // --- Toasts / scoring ---
  let toastTimer;
  function showToast(title, sub='', kind='') {
    const toast=$e('gameToast'); if(!toast) return;
    $e('toastTitle').textContent=title; $e('toastSub').textContent=sub;
    toast.className=`game-toast ${kind}`.trim();
    void toast.offsetWidth; toast.classList.add('pop');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(()=>toast.classList.add('hidden'),820);
    toast.classList.remove('hidden');
  }
  function emptyBoard(){ return board.every(row=>row.every(cell=>!cell)); }

  clearLines = function(){
    let lines=0;
    outer: for(let y=ROWS-1;y>=0;y--){
      for(let x=0;x<COLS;x++) if(!board[y][x]) continue outer;
      board.splice(y,1); board.unshift(Array(COLS).fill('')); lines++; y++;
    }
    if(lines>0){
      combo++;
      const base=[0,100,300,500,800][lines]||1200;
      const bonus=Math.max(0,combo-1)*50;
      score += base + bonus;
      clearSfx(lines,combo);
      if(emptyBoard()){
        score += 3500;
        showToast('PERFECT!','+3500 PERFECT CLEAR','perfect');
        perfectSfx();
      } else if(combo>=10){
        showToast(`MAX COMBO x${combo}!`,`+${bonus} combo bonus`,'max');
        maxComboSfx();
      } else {
        showToast(`COMBO x${combo}`,`${lines} line${lines>1?'s':''} cleared${bonus?` · +${bonus} bonus`:''}`);
      }
    } else combo=0;
    updateHud();
  };

  updateHud = function(){
    $e('score').textContent=score;
    $e('combo').textContent=`x${combo}`;
    $e('timer').textContent=timeLeft;
  };
  updateHud();

  // --- Web Audio sound effects (no audio files needed) ---
  let audioCtx=null;
  let soundOn=localStorage.getItem('tb_sound')!=='off';
  const soundBtn=$e('soundBtn');
  function audio(){
    if(!soundOn) return null;
    if(!audioCtx){ const C=window.AudioContext||window.webkitAudioContext; if(!C) return null; audioCtx=new C(); }
    if(audioCtx.state==='suspended') audioCtx.resume();
    return audioCtx;
  }
  function tone(freq,dur=.06,type='sine',vol=.035,delay=0){
    const ac=audio(); if(!ac||!soundOn) return;
    const t=ac.currentTime+delay, o=ac.createOscillator(), g=ac.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t);
    g.gain.setValueAtTime(.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.008); g.gain.exponentialRampToValueAtTime(.0001,t+dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t+dur+.02);
  }
  function updateSoundBtn(){ if(soundBtn) soundBtn.textContent=soundOn?'🔊 Sound':'🔇 Muted'; }
  function clearSfx(lines,streak){ const b=420+lines*70; tone(b,.08,'square',.035); tone(b+120,.09,'square',.035,.055); if(streak>1) tone(b+220+Math.min(streak,10)*12,.11,'sine',.04,.11); }
  function perfectSfx(){ [523,659,784,1047].forEach((f,i)=>tone(f,.18,'sine',.055,i*.08)); }
  function maxComboSfx(){ [660,760,880,990].forEach((f,i)=>tone(f,.10,'square',.045,i*.055)); }
  updateSoundBtn();
  if(soundBtn) soundBtn.addEventListener('click',()=>{ soundOn=!soundOn; localStorage.setItem('tb_sound',soundOn?'on':'off'); updateSoundBtn(); if(soundOn){audio();tone(520,.08,'sine',.04);} });

  // Wrap existing controls with lightweight SFX.
  const oldMove=move;
  move=function(dir){ const x=current&&current.x; oldMove(dir); if(gameRunning&&current&&current.x!==x) tone(180,.018,'square',.018); };
  const oldRotate=rotate;
  rotate=function(){ const before=current&&JSON.stringify(current.shape); oldRotate(); if(gameRunning&&current&&JSON.stringify(current.shape)!==before) tone(320,.04,'sine',.028); };
  const oldHardDrop=hardDrop;
  hardDrop=function(){ if(gameRunning) tone(95,.06,'triangle',.05); oldHardDrop(); };

  // First user interaction unlocks audio on mobile browsers.
  document.addEventListener('pointerdown',()=>audio(),{once:true});
})();
