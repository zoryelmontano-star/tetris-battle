// Tetris Battle v4: HOLD + ghost landing preview.
(() => {
  const $h = id => document.getElementById(id);
  let holdType = null;
  let holdLocked = false;

  // Build HOLD panel to the left of the board.
  const playStage = document.querySelector('.play-stage');
  const boardShell = document.querySelector('.board-shell');
  if (playStage && boardShell && !$h('holdCanvas')) {
    const holdPanel = document.createElement('aside');
    holdPanel.className = 'hold-panel';
    holdPanel.innerHTML = `
      <p>HOLD</p>
      <div class="hold-card">
        <span>C / H</span>
        <canvas id="holdCanvas" width="100" height="78"></canvas>
      </div>
      <button id="holdBtn" class="hold-touch-btn" type="button">HOLD / SWAP</button>
      <small>One hold per piece</small>
    `;
    playStage.insertBefore(holdPanel, boardShell);
  }

  // Arcade side-panel styling, matched to the current muted palette.
  const style = document.createElement('style');
  style.textContent = `
    .play-stage{display:grid!important;grid-template-columns:118px minmax(0,360px) 118px!important;justify-content:center!important;align-items:start!important;gap:12px!important}
    .hold-panel{width:118px;padding:10px;background:linear-gradient(180deg,#211b21,#171418);border:1px solid #3c333b;border-radius:16px}
    .hold-panel>p{text-align:center;margin:0 0 8px;color:#a696a1;font-size:10px;font-weight:900;letter-spacing:.14em}
    .hold-card{position:relative;border-radius:11px;background:#100d11;border:1px solid #322931;margin-bottom:9px;padding:5px;min-height:92px}
    .hold-card>span{position:absolute;left:7px;top:5px;color:#70636c;font-size:9px;font-weight:900;z-index:2}
    .hold-card canvas{display:block;width:100%;height:auto;margin-top:4px;image-rendering:pixelated}
    .hold-touch-btn{width:100%;padding:8px 5px;font-size:9px;letter-spacing:.05em;border-radius:10px;margin-bottom:7px;background:linear-gradient(180deg,#352c35,#241e25)}
    .hold-panel small{display:block;text-align:center;color:#756a72;font-size:9px;line-height:1.35}
    .hold-panel.locked{opacity:.62}
    .hold-panel.locked .hold-touch-btn{cursor:not-allowed}
    @media(max-width:840px){.play-stage{grid-template-columns:98px minmax(0,340px) 98px!important}.hold-panel,.next-panel{width:98px!important}}
    @media(max-width:620px){.play-stage{grid-template-columns:72px minmax(0,1fr) 72px!important;gap:5px!important}.hold-panel,.next-panel{width:72px!important;padding:5px!important}.hold-panel small{display:none}.hold-touch-btn{font-size:8px;padding:7px 3px}.board-shell{width:100%!important}.hold-card{min-height:72px;padding:2px}.hold-card>span{font-size:8px;left:4px;top:3px}.next-card{padding:2px!important}}
  `;
  document.head.appendChild(style);

  function renderHold() {
    const c = $h('holdCanvas');
    if (!c) return;
    const m = c.getContext('2d');
    m.clearRect(0, 0, c.width, c.height);
    m.fillStyle = '#100d11';
    m.fillRect(0, 0, c.width, c.height);

    const panel = document.querySelector('.hold-panel');
    if (panel) panel.classList.toggle('locked', holdLocked);
    const btn = $h('holdBtn');
    if (btn) btn.disabled = holdLocked || !gameRunning || paused;

    if (!holdType) return;
    const piece = makePiece(holdType);
    const cell = 18;
    const w = piece.shape[0].length * cell;
    const h = piece.shape.length * cell;
    const ox = Math.floor((c.width - w) / 2);
    const oy = Math.floor((c.height - h) / 2);

    piece.shape.forEach((row, y) => row.forEach((value, x) => {
      if (!value) return;
      const px = ox + x * cell;
      const py = oy + y * cell;
      const color = COLORS[holdType];
      const grad = m.createLinearGradient(px, py, px + cell, py + cell);
      grad.addColorStop(0, adjust(color, 32));
      grad.addColorStop(.48, color);
      grad.addColorStop(1, adjust(color, -30));
      m.fillStyle = grad;
      m.fillRect(px + 1, py + 1, cell - 2, cell - 2);
      m.fillStyle = 'rgba(255,255,255,.25)';
      m.fillRect(px + 3, py + 3, cell - 6, 2);
      m.strokeStyle = 'rgba(255,255,255,.15)';
      m.strokeRect(px + 1.5, py + 1.5, cell - 3, cell - 3);
    }));
  }

  function holdSfx() {
    if (typeof tone !== 'function') return;
    tone(235, .055, 'triangle', .025);
    tone(330, .075, 'sine', .025, .045);
  }

  function holdCurrent() {
    if (!gameRunning || paused || !current || holdLocked) return;
    const outgoing = current.type;

    if (!holdType) {
      holdType = outgoing;
      current = queue.shift() || makePiece();
      current.x = Math.floor(COLS / 2) - Math.ceil(current.shape[0].length / 2);
      current.y = 0;
      queue.push(makePiece());
      renderNext();
    } else {
      const incoming = holdType;
      holdType = outgoing;
      current = makePiece(incoming);
      current.x = Math.floor(COLS / 2) - Math.ceil(current.shape[0].length / 2);
      current.y = 0;
    }

    holdLocked = true;
    holdSfx();
    renderHold();
    if (collide(current)) endGame('lose');
    draw();
  }

  // A hold becomes available again only after the current piece locks.
  const originalLockPiece = lockPiece;
  lockPiece = function () {
    holdLocked = false;
    originalLockPiece();
    renderHold();
  };

  // Reset HOLD when a new battle or room starts.
  const originalStartGame = startGame;
  startGame = function () {
    holdType = null;
    holdLocked = false;
    const result = originalStartGame();
    renderHold();
    return result;
  };

  const originalOpenGame = openGame;
  openGame = function (code) {
    holdType = null;
    holdLocked = false;
    const result = originalOpenGame(code);
    renderHold();
    return result;
  };

  // Ghost piece / landing trace.
  function ghostDistance() {
    if (!current) return 0;
    let d = 0;
    while (!collide(current, 0, d + 1)) d++;
    return d;
  }

  function drawGhost() {
    if (!current) return;
    const d = ghostDistance();
    if (d <= 0) return;

    ctx.save();
    current.shape.forEach((row, y) => row.forEach((value, x) => {
      if (!value) return;
      const px = (current.x + x) * BLOCK;
      const py = (current.y + y + d) * BLOCK;
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      ctx.fillRect(px + 4, py + 4, BLOCK - 8, BLOCK - 8);
      ctx.strokeStyle = 'rgba(242,228,215,.42)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(px + 3.5, py + 3.5, BLOCK - 7, BLOCK - 7);
      ctx.setLineDash([]);
    }));
    ctx.restore();
  }

  const originalDraw = draw;
  draw = function () {
    originalDraw();
    drawGhost();
  };

  // Keyboard HOLD: C or H.
  document.addEventListener('keydown', event => {
    if (event.key === 'c' || event.key === 'C' || event.key === 'h' || event.key === 'H') {
      event.preventDefault();
      holdCurrent();
    }
  });

  const holdBtn = $h('holdBtn');
  if (holdBtn) holdBtn.addEventListener('pointerdown', event => {
    event.preventDefault();
    holdCurrent();
  });

  // Keep hold button enabled/disabled correctly around pause/resume.
  const originalPauseGame = pauseGame;
  pauseGame = function () {
    const result = originalPauseGame();
    renderHold();
    return result;
  };

  renderHold();
})();
