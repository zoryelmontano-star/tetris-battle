// v24: visible outgoing garbage stack for online and AI 2P battles.
(() => {
  const $ = id => document.getElementById(id);
  let lastAttack = Number($('attack')?.textContent || 0);
  let pendingVisual = 0;
  let clearTimer = null;

  function duelActive() {
    return gameMode === 'duel' && !game.classList.contains('hidden');
  }

  function ensureMeter() {
    const shell = $('localLiveTile')?.querySelector('.board-shell') || document.querySelector('#arenaCard .board-shell');
    if (!shell) return null;
    let meter = $('outgoingAttackMeter');
    if (meter && meter.parentElement !== shell) meter.remove();
    meter = $('outgoingAttackMeter');
    if (meter) return meter;

    meter = document.createElement('div');
    meter.id = 'outgoingAttackMeter';
    meter.className = 'outgoing-attack-meter hidden';
    meter.innerHTML = `
      <div class="outgoing-label">SEND</div>
      <div class="outgoing-count" id="outgoingAttackCount">0</div>
      <div class="outgoing-stack" id="outgoingAttackStack" aria-label="Outgoing garbage lines"></div>`;
    shell.appendChild(meter);
    return meter;
  }

  function renderMeter() {
    const meter = ensureMeter();
    if (!meter) return;
    const visible = duelActive() && (gameRunning || pendingVisual > 0 || window.TBAIMode);
    meter.classList.toggle('hidden', !visible);
    if (!visible) return;

    const count = $('outgoingAttackCount');
    const stack = $('outgoingAttackStack');
    if (!count || !stack) return;
    count.textContent = pendingVisual > 0 ? `+${pendingVisual}` : '0';
    stack.innerHTML = '';

    const cells = Math.min(12, pendingVisual);
    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('i');
      cell.className = i < cells ? 'filled' : '';
      stack.appendChild(cell);
    }
    meter.classList.toggle('hot', pendingVisual >= 4);
    meter.classList.toggle('danger', pendingVisual >= 8);
  }

  function resetVisual() {
    pendingVisual = 0;
    clearTimeout(clearTimer);
    renderMeter();
  }

  function showOutgoing(lines) {
    const n = Math.max(0, Number(lines) || 0);
    if (!n || gameMode !== 'duel') return;
    pendingVisual += n;
    renderMeter();
    clearTimeout(clearTimer);
    // Keep the stack visible long enough to read; consecutive clears accumulate.
    clearTimer = setTimeout(() => {
      pendingVisual = 0;
      renderMeter();
    }, 1650);
  }

  const attackEl = $('attack');
  if (attackEl) {
    new MutationObserver(() => {
      const next = Number(attackEl.textContent || 0);
      if (gameMode !== 'duel') {
        lastAttack = next;
        resetVisual();
        return;
      }
      if (next < lastAttack) {
        lastAttack = next;
        resetVisual();
        return;
      }
      const delta = next - lastAttack;
      lastAttack = next;
      if (delta > 0) showOutgoing(delta);
    }).observe(attackEl, {childList:true, characterData:true, subtree:true});
  }

  const style = document.createElement('style');
  style.textContent = `
    .board-shell{overflow:visible!important}
    .outgoing-attack-meter{position:absolute;right:7px;bottom:7px;z-index:7;width:31px;padding:5px 4px 6px;border-radius:10px;background:rgba(14,12,15,.82);border:1px solid rgba(229,190,111,.32);box-shadow:0 7px 20px rgba(0,0,0,.34);backdrop-filter:blur(4px);pointer-events:none}
    .outgoing-attack-meter.hidden{display:none!important}
    .outgoing-label{font-size:6px;font-weight:1000;letter-spacing:.11em;text-align:center;color:#bcae9b;margin-bottom:2px}
    .outgoing-count{text-align:center;font-size:11px;line-height:1;font-weight:1000;color:#eed18d;margin-bottom:4px;text-shadow:0 2px 6px rgba(0,0,0,.45)}
    .outgoing-stack{height:118px;display:flex;flex-direction:column-reverse;gap:2px}
    .outgoing-stack i{flex:1;min-height:4px;border-radius:2px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.045);transition:background .12s ease,transform .12s ease,box-shadow .12s ease}
    .outgoing-stack i.filled{background:linear-gradient(180deg,#e3c574,#b88b46);border-color:rgba(255,230,162,.45);box-shadow:inset 0 1px 0 rgba(255,255,255,.28),0 0 6px rgba(218,171,84,.18);transform:scaleX(1.04)}
    .outgoing-attack-meter.hot .outgoing-stack i.filled{background:linear-gradient(180deg,#dc9b70,#ba665c)}
    .outgoing-attack-meter.danger .outgoing-stack i.filled{background:linear-gradient(180deg,#df7f84,#a94d60);box-shadow:0 0 7px rgba(215,91,108,.25)}
    @media(max-width:720px){.outgoing-attack-meter{right:4px;bottom:4px;width:27px;padding:4px 3px 5px}.outgoing-stack{height:94px}.outgoing-count{font-size:10px}.outgoing-label{font-size:5px}}
  `;
  document.head.appendChild(style);

  $('startBtn')?.addEventListener('click', () => {
    lastAttack = 0;
    resetVisual();
    setTimeout(renderMeter, 50);
  }, true);
  $('quitBtn')?.addEventListener('click', resetVisual, true);
  document.querySelectorAll('.mode-card').forEach(btn => btn.addEventListener('click', () => setTimeout(() => {
    lastAttack = Number($('attack')?.textContent || 0);
    if (gameMode !== 'duel') resetVisual();
    else renderMeter();
  }, 180)));

  setInterval(renderMeter, 350);
  window.TBOutgoingMeter = { showOutgoing, reset:resetVisual, render:renderMeter };
})();
