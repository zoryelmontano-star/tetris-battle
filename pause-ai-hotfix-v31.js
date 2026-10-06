// v31: keep AI drawing on the real rival board and preserve battle state through pause/resume.
(() => {
  const $ = id => document.getElementById(id);

  // ---------- AI layout hotfix ----------
  // battle-polish-v25 draws into the first canvas inside the AI tile.
  // Keep the main AI board first in DOM while visually placing HOLD on the left.
  function fixAIDOMOrder(){
    const tile = $('live-ai-rival');
    if(!tile) return;
    const row = tile.querySelector('.remote-stage-with-hold');
    const shell = tile.querySelector('.ai-board-shell,.remote-board-shell');
    const side = tile.querySelector('.remote-hold-panel');
    if(row && shell && side){
      if(row.firstElementChild !== shell) row.insertBefore(shell, row.firstElementChild);
      shell.style.order = '2';
      side.style.order = '1';
    }
  }

  const aiStyle = document.createElement('style');
  aiStyle.textContent = `
    #live-ai-rival .remote-stage-with-hold{grid-template-columns:82px minmax(0,300px)!important;justify-content:center!important;align-items:start!important}
    #live-ai-rival .remote-hold-panel{order:1!important}
    #live-ai-rival .ai-board-shell,#live-ai-rival .remote-board-shell{order:2!important;width:100%!important;max-width:300px!important;margin:0!important}
    #live-ai-rival .ai-board-shell canvas,#live-ai-rival .remote-board-shell canvas{width:100%!important;height:100%!important;display:block!important}
    @media(max-width:720px){
      #live-ai-rival .remote-stage-with-hold{grid-template-columns:50px minmax(0,1fr)!important}
      #live-ai-rival .ai-board-shell,#live-ai-rival .remote-board-shell{max-width:none!important}
    }
  `;
  document.head.appendChild(aiStyle);
  setInterval(fixAIDOMOrder, 30);

  // ---------- Pause integrity ----------
  let pauseSnapshot = null;
  let restoring = false;
  let wasPaused = false;

  const clonePiece = p => p ? {
    type:p.type,
    shape:Array.isArray(p.shape) ? p.shape.map(r=>r.slice()) : [],
    x:Number(p.x||0), y:Number(p.y||0)
  } : null;

  function snapshotBattle(){
    if(!gameRunning || pauseSnapshot) return;
    pauseSnapshot = {
      board:Array.isArray(board) ? board.map(r=>r.slice()) : [],
      current:clonePiece(current),
      queue:Array.isArray(queue) ? queue.map(clonePiece) : [],
      bag:Array.isArray(bag) ? bag.slice() : [],
      score:Number(score||0),
      combo:Number(combo||0),
      clearStreak:Number(clearStreak||0),
      timeLeft:Number(timeLeft||0),
      attack:Number(attack||0),
      dropCounter:Number(dropCounter||0),
      panicMode:!!panicMode
    };
  }

  function restoreBattle(){
    if(!pauseSnapshot || !gameRunning || restoring) return;
    restoring = true;
    const s = pauseSnapshot;
    board = s.board.map(r=>r.slice());
    current = clonePiece(s.current);
    queue = s.queue.map(clonePiece);
    bag = s.bag.slice();
    score = s.score;
    combo = s.combo;
    clearStreak = s.clearStreak;
    timeLeft = s.timeLeft;
    attack = s.attack;
    dropCounter = s.dropCounter;
    panicMode = s.panicMode;
    try { renderNext(); } catch {}
    try { updateHud(); } catch {}
    try { draw(); } catch {}
    try { if(typeof setPanic==='function') setPanic(s.panicMode); } catch {}
    lastTime = performance.now();
    pauseSnapshot = null;
    restoring = false;
  }

  // Capture before either manual or shared pause changes anything.
  document.addEventListener('click', e => {
    if(e.target?.closest?.('#pauseBtn,#globalResumeBtn')){
      if(gameRunning && !paused) snapshotBattle();
    }
  }, true);
  document.addEventListener('keydown', e => {
    if((e.key==='p'||e.key==='P') && gameRunning && !paused) snapshotBattle();
  }, true);
  if(window.TBMultiplayer){
    TBMultiplayer.onMessage(msg=>{
      if(msg.type==='shared_pause' && gameRunning && !paused) snapshotBattle();
    });
  }

  // No full round reset is allowed while a pause snapshot exists.
  const priorStartGame = startGame;
  startGame = function(...args){
    if(pauseSnapshot && (paused || wasPaused)) return;
    pauseSnapshot = null;
    return priorStartGame(...args);
  };

  // Restore the exact frozen state only after READY 3 2 1 GO has finished.
  setInterval(()=>{
    if(!gameRunning){ pauseSnapshot=null; wasPaused=false; return; }
    if(paused){
      if(!pauseSnapshot) snapshotBattle();
      wasPaused = true;
      return;
    }
    if(wasPaused && pauseSnapshot){
      restoreBattle();
      wasPaused = false;
    }
  }, 25);

  window.TBPauseIntegrity = {
    get hasSnapshot(){ return !!pauseSnapshot; },
    restore:restoreBattle
  };
})();
